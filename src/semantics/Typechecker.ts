import { boundMethod } from 'autobind-decorator';
import { isEqual, spread, zip, zipWith } from 'lodash';
import { ASTNodeKind, Expression } from '../ast/Ast';
import { DiagnosticCodes } from '../diagnostics/DiagnosticCodes';
import { WithDiagnostics } from '../diagnostics/Mixin';
import { stdlibTypes } from '../stdlib';
import { IsMapLikeAttribute, IsSequenceLikeAttribute, TypeAttributeKind } from '../types/Attribute';
import { booleanType, floatType, intType, primitiveTypes, stringType } from '../types/Primitives';
import { TypeInfo } from '../types/Type';
import { AnyType, ExactType, FunctionType, KnownType, SimpleType, stringifyType, TypeKind } from '../types/TypeReference';
import Scope from './Scope';


/**
 * Poison lets us escape processing an expression once we find a fatal error
 * to avoid spitting out a bunch of other confusing errors.
 */
class Poison extends Error {

}

export class Typechecker extends WithDiagnostics('mike', class {}) {
    private types = new Map(primitiveTypes.map(x => [x.name, x]));

    private currentScope;

    constructor(private readonly options?: {
        rootScope?: Scope;
        omitStdlib?: boolean;
    }) {
        super();
        this.currentScope = this.options?.rootScope ?? new Scope();

        if (!this.options?.omitStdlib) {
            this.addType(...stdlibTypes);
        }
    }

    addType(...types: TypeInfo[]) {
        for (const type of types) {
            if (this.types.has(type.name)) {
                this.diagnostics.report(DiagnosticCodes.TypeDefinedMultipleTimes);
                continue;
            }
            this.types.set(type.name, type);
        }
    }

    @boundMethod
    private fitsInType(other: KnownType, target: KnownType): boolean {
        if (isEqual(target, floatType) && isEqual(other, intType)) {
            return true;
        }
        switch (target.kind) {
            case TypeKind.Simple: {
                if (other.kind === TypeKind.SequenceLike) {
                    return Boolean(this.types.get(target.name)
                            ?.quantify(target.typeArguments).attributes
                            .find(x => x.kind === TypeAttributeKind.IsSequenceLike))
                        && target.typeArguments.length === 1
                        && (!other.element || this.fitsInType(other.element, target.typeArguments[0]));
                }
                else if (other.kind === TypeKind.MapLike) {
                    return Boolean(this.types.get(target.name)
                            ?.quantify(target.typeArguments).attributes
                            .find(x => x.kind === TypeAttributeKind.IsMapLike))
                        && target.typeArguments.length === 2
                        && (!other.typeArguments || (
                            this.fitsInType(other.typeArguments[0], target.typeArguments[0]) &&
                            this.fitsInType(other.typeArguments[1], target.typeArguments[1])
                        ));
                }
                else if (other.kind === TypeKind.Simple) {
                    return target.name === other.name
                        && target.typeArguments.length === other.typeArguments.length
                        && zip(other.typeArguments, target.typeArguments)
                            .every(spread(this.fitsInType));
                }
                return false;
            }
            case TypeKind.SequenceLike: {
                if (other.kind === TypeKind.SequenceLike) {
                    if (target.element) {
                        if (other.element) {
                            return this.fitsInType(other.element, target.element);
                        }
                        return true;
                    }
                    return !Boolean(other.element);
                }
                return false;
            }
            case TypeKind.MapLike: {
                if (other.kind === TypeKind.MapLike) {
                    if (target.typeArguments) {
                        if (other.typeArguments) {
                            return this.fitsInType(other.typeArguments[0], target.typeArguments[0])
                                && this.fitsInType(other.typeArguments[1], target.typeArguments[1]);
                        }
                        return true;
                    }
                    return !Boolean(other.typeArguments);
                }
                return false;
            }
            case TypeKind.Function: {
                if (other.kind === TypeKind.Function) {
                    if (!this.fitsInType(other.returnType, target.returnType)) {
                        return false;
                    }
                    return zip(target.parameters, other.parameters)
                        .every(spread(this.fitsInType));
                }
                return false;
            }
        }
    }

    private getCommonSupertype(exprs: Expression<KnownType>[]): KnownType | undefined {
        if (exprs.length <= 1) {
            return exprs[0]?.type;
        }
        return exprs.slice(1).reduce((acc, next) => {
            if (this.fitsInType(acc, next.type)) {
                return next.type;
            }
            else if (this.fitsInType(next.type, acc)) {
                return acc;
            }
            this.diagnostics.focus(next);
            this.fatal(DiagnosticCodes.NoCommonType, next.type, acc);
        }, exprs[0].type);
    }

    @boundMethod
    resolveKnownTypes(ast: Expression<undefined>): Expression<KnownType> {
        this.diagnostics.focus(ast);
        switch (ast.kind) {
            case ASTNodeKind.Invoke: {
                const fn = this.resolveKnownTypes(ast.fn);
                const args = ast.args.map(this.resolveKnownTypes);
                if (fn.type.kind === TypeKind.Function) {
                    if (fn.type.parameters.length !== args.length) {
                        this.nonfatal(DiagnosticCodes.WrongNumberOfArguments, fn.type.parameters.length, args.length);
                    }
                    for (const [t, arg] of zip(fn.type.parameters, args)) {
                        if (!t || !arg) {
                            break;
                        }
                        if (!this.fitsInType(arg.type, t)) {
                            this.nonfatal(DiagnosticCodes.ArgumentParameterTypeMismatch, arg.type, t);
                        }
                    }
                    return { ...ast, type: fn.type.returnType, fn, args };
                }
                else {
                    this.fatal(DiagnosticCodes.Uninvokable, fn.type);
                }
            }
            case ASTNodeKind.BinaryOp: {
                const lhs = this.resolveKnownTypes(ast.lhs);
                const rhs = this.resolveKnownTypes(ast.rhs);

                if (isEqual(lhs.type, intType)) {
                    if (isEqual(rhs.type, intType)) {
                        return { ...ast, type: intType, lhs, rhs };
                    }
                    else if (isEqual(rhs.type, floatType)) {
                        return { ...ast, type: floatType, lhs, rhs };
                    }
                    this.diagnostics.focus(rhs);
                    this.fatal(DiagnosticCodes.BadBinaryTypeArgumentType, rhs.type);
                }
                else if (isEqual(lhs.type, floatType)) {
                    if (isEqual(rhs.type, intType) || isEqual(rhs.type, floatType)) {
                        return { ...ast, type: floatType, lhs, rhs };
                    }
                    this.diagnostics.focus(rhs);
                    this.fatal(DiagnosticCodes.BadBinaryTypeArgumentType, rhs.type);
                }
                this.diagnostics.focus(lhs);
                this.fatal(DiagnosticCodes.BadBinaryTypeArgumentType, lhs.type);
            }
            case ASTNodeKind.Dereference: {
                const obj = this.resolveKnownTypes(ast.obj);
                switch (obj.type.kind) {
                    case TypeKind.Simple: {
                        const objType = this.types.get(obj.type.name)!;
                        const memberType = objType.quantify(obj.type.typeArguments).members[ast.memberName];
                        if (!memberType) {
                            this.fatal(DiagnosticCodes.InvalidMember, obj.type, ast.memberName);
                        }
                        return { ...ast, type: memberType, obj };
                    }
                    case TypeKind.SequenceLike:
                        this.fatal(DiagnosticCodes.DereferenceLiteral);
                    case TypeKind.MapLike:
                        this.fatal(DiagnosticCodes.DereferenceLiteral);
                    case TypeKind.Function:
                        this.fatal(DiagnosticCodes.InvalidMember, obj.type, ast.memberName);
                }
            }
            case ASTNodeKind.Variable: {
                const type = this.currentScope.get(ast.name);
                if (type) {
                    return { ...ast, type };
                }
                this.fatal(DiagnosticCodes.UnknownIdentifier, ast.name);
            }
            case ASTNodeKind.FloatLiteral:
                return { ...ast, type: floatType };
            case ASTNodeKind.IntLiteral:
                return { ...ast, type: intType };
            case ASTNodeKind.BoolLiteral:
                return { ...ast, type: booleanType };
            case ASTNodeKind.StringLiteral:
                return { ...ast, type: stringType };
            case ASTNodeKind.SequenceLiteral: {
                const elements = ast.elements.map(this.resolveKnownTypes);
                const eltType = this.getCommonSupertype(elements);
                return { ...ast, elements, type: { kind: TypeKind.SequenceLike, element: eltType } };
            }
            case ASTNodeKind.MapLiteral: {
                const pairs = ast.pairs.map(([key, val]) => [this.resolveKnownTypes(key), this.resolveKnownTypes(val)] as const);
                const keyType = this.getCommonSupertype(pairs.map(x => x[0]));
                const valueType = this.getCommonSupertype(pairs.map(x => x[1]));
                const typeArguments = (keyType && valueType) ? [keyType, valueType] as const : undefined;
                return { ...ast, pairs, type: { kind: TypeKind.MapLike, typeArguments } };
            }
        }
    }

    @boundMethod
    resolveTargetTyped(target: ExactType, ast: Expression<KnownType>): Expression<ExactType> {
        if (!this.fitsInType(ast.type, target)) {
            this.fatal(DiagnosticCodes.TargetTypeMismatch, target, ast.type);
        }

        switch (ast.kind) {
            case ASTNodeKind.Invoke: {
                const fnType = ast.fn.type as FunctionType;
                if (this.fitsInType(fnType.returnType, target)) {
                    const fn = this.resolveTargetTyped(fnType, ast.fn);
                    const args = zipWith(fnType.parameters, ast.args, this.resolveTargetTyped);
                    return { ...ast, type: target, fn, args };
                }
                this.fatal(DiagnosticCodes.TargetTypeMismatch, target, ast.type);
            }
            case ASTNodeKind.BinaryOp: {
                const lhs = this.resolveTargetTyped(target, ast.lhs);
                const rhs = this.resolveTargetTyped(target, ast.rhs);
                return { ...ast, type: target, lhs, rhs };
            }
            case ASTNodeKind.Dereference: {
                const obj = this.resolveTargetTyped(ast.obj.type as SimpleType, ast.obj);
                return { ...ast, type: target, obj };
            }
            case ASTNodeKind.Variable:
            case ASTNodeKind.FloatLiteral:
            case ASTNodeKind.IntLiteral:
            case ASTNodeKind.BoolLiteral:
            case ASTNodeKind.StringLiteral:
                return { ...ast, type: target };
            case ASTNodeKind.SequenceLiteral: {
                if (!ast.typeName || ast.typeName === (target as SimpleType).name) {
                    const eltType = (target as SimpleType).typeArguments[0];
                    const elements = ast.elements.map(x => this.resolveTargetTyped(eltType, x));
                    return { ...ast, type: target, elements };
                }
                this.fatal(DiagnosticCodes.TargetTypeMismatch, target, ast.type);
            }
            case ASTNodeKind.MapLiteral: {
                if (!ast.typeName || ast.typeName === (target as SimpleType).name) {
                    const keyType = (target as SimpleType).typeArguments[0];
                    const valueType = (target as SimpleType).typeArguments[1];
                    const pairs = ast.pairs.map(([key, value]) => [
                        this.resolveTargetTyped(keyType, key),
                        this.resolveTargetTyped(valueType, value)
                    ] as const);
                    return { ...ast, type: target, pairs };
                }
                this.fatal(DiagnosticCodes.TargetTypeMismatch, target, ast.type);
            }
        }
    }

    private fatal(code: DiagnosticCodes, ...args: (string | number | AnyType)[]): never {
        this.nonfatal(code, ...args);
        throw new Poison();
    }

    private nonfatal(code: DiagnosticCodes, ...args: (string | number | AnyType)[]): void {
        this.diagnostics.report(code, ...args.map(x => {
            if (typeof x === 'object') {
                return stringifyType(x);
            }
            else {
                return x.toString();
            }
        }));
    }
}