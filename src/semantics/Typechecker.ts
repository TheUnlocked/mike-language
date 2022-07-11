import { boundMethod } from 'autobind-decorator';
import { isEqual, spread, zip, zipWith } from 'lodash';
import { ASTNodeKind, BinaryOp, Dereference, Expression, InfixOperator, Invoke, MapLiteral, PrefixOperator, SequenceLiteral, UnaryOp, Variable } from '../ast/Ast';
import { DiagnosticCodes } from '../diagnostics/DiagnosticCodes';
import { WithDiagnostics } from '../diagnostics/Mixin';
import Poison from '../diagnostics/Poison';
import { stdlibTypes } from '../stdlib';
import { TypeAttributeKind } from '../types/Attribute';
import { booleanType, floatType, intType, primitiveTypes, stringType } from '../types/Primitives';
import { TypeInfo } from '../types/Type';
import { AnyType, ExactType, FunctionType, isExactType, KnownType, MapLike, SequenceLike, SimpleType, stringifyType, TypeKind } from '../types/TypeReference';
import Scope from './Scope';

export class Typechecker extends WithDiagnostics(class {}) {
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
    
    private fitsInSimpleType(other: KnownType, target: SimpleType) {
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

    private fitsInSequenceLikeType(other: KnownType, target: SequenceLike) {
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

    private fitsInMapLikeType(other: KnownType, target: MapLike) {
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

    private fitsInFunctionType(other: KnownType, target: FunctionType) {
        if (other.kind === TypeKind.Function) {
            if (!this.fitsInType(other.returnType, target.returnType)) {
                return false;
            }
            return zip(target.parameters, other.parameters)
                .every(spread(this.fitsInType));
        }
        return false;
    }

    @boundMethod
    private fitsInType(other: KnownType, target: KnownType): boolean {
        if (isEqual(target, floatType) && isEqual(other, intType)) {
            return true;
        }
        switch (target.kind) {
            case TypeKind.Simple:
                return this.fitsInSimpleType(other, target);
            case TypeKind.SequenceLike:
                return this.fitsInSequenceLikeType(other, target);
            case TypeKind.MapLike:
                return this.fitsInMapLikeType(other, target);
            case TypeKind.Function:
                return this.fitsInFunctionType(other, target);
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

    private resolveInvokeType(ast: Invoke<undefined>): Expression<KnownType> {
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

    private resolveArithmeticBinaryOpType(ast: BinaryOp<undefined>): Expression<KnownType> {
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
            this.fatal(DiagnosticCodes.BadArithmeticOpArgumentType, rhs.type);
        }
        else if (isEqual(lhs.type, floatType)) {
            if (isEqual(rhs.type, intType) || isEqual(rhs.type, floatType)) {
                return { ...ast, type: floatType, lhs, rhs };
            }
            this.diagnostics.focus(rhs);
            this.fatal(DiagnosticCodes.BadArithmeticOpArgumentType, rhs.type);
        }
        this.diagnostics.focus(lhs);
        this.fatal(DiagnosticCodes.BadArithmeticOpArgumentType, lhs.type);
    }

    private resolveRelationalBinaryOpType(ast: BinaryOp<undefined>): Expression<KnownType> {
        const lhs = this.resolveKnownTypes(ast.lhs);
        const rhs = this.resolveKnownTypes(ast.rhs);

        if (!isEqual(lhs.type, intType) && !isEqual(lhs.type, floatType)) {
            this.diagnostics.focus(lhs);
            this.nonfatal(DiagnosticCodes.BadInequalityOpArgumentType, lhs.type);
        }
        if (!isEqual(rhs.type, intType) && !isEqual(rhs.type, floatType)) {
            this.diagnostics.focus(rhs);
            this.nonfatal(DiagnosticCodes.BadInequalityOpArgumentType, rhs.type);
        }
        return { ...ast, type: booleanType, lhs, rhs };
    }

    private resolveEqualityBinaryOpType(ast: BinaryOp<undefined>): Expression<KnownType> {
        const lhs = this.resolveKnownTypes(ast.lhs);
        const rhs = this.resolveKnownTypes(ast.rhs);

        if (!isEqual(lhs.type, rhs.type)) {
            this.nonfatal(DiagnosticCodes.EqualityArgumentTypeMismatch, lhs.type, rhs.type);
        }
        if ([ASTNodeKind.SequenceLiteral, ASTNodeKind.MapLiteral].includes(lhs.kind)) {
            this.diagnostics.focus(lhs);
            this.nonfatal(DiagnosticCodes.EqualityArgumentIsLiteral);
        }
        if ([ASTNodeKind.SequenceLiteral, ASTNodeKind.MapLiteral].includes(rhs.kind)) {
            this.diagnostics.focus(rhs);
            this.nonfatal(DiagnosticCodes.EqualityArgumentIsLiteral);
        }
        if ([TypeKind.SequenceLike, TypeKind.MapLike].includes(lhs.type.kind)) {
            this.diagnostics.focus(lhs);
            this.nonfatal(DiagnosticCodes.CannotInferIntermediateLiteralType);
        }
        if ([TypeKind.SequenceLike, TypeKind.MapLike].includes(rhs.type.kind)) {
            this.diagnostics.focus(rhs);
            this.nonfatal(DiagnosticCodes.CannotInferIntermediateLiteralType);
        }
        return { ...ast, type: booleanType, lhs, rhs };
    }

    private resolveLogicalBinaryOpType(ast: BinaryOp<undefined>): Expression<KnownType> {
        const lhs = this.resolveKnownTypes(ast.lhs);
        const rhs = this.resolveKnownTypes(ast.rhs);

        if (!isEqual(lhs.type, booleanType)) {
            this.nonfatal(DiagnosticCodes.BadLogicalOpArgumentType, lhs.type);
        }
        if (!isEqual(rhs.type, booleanType)) {
            this.nonfatal(DiagnosticCodes.BadLogicalOpArgumentType, rhs.type);
        }
        return { ...ast, type: booleanType, lhs, rhs };
    }

    private resolveBinaryOpType(ast: BinaryOp<undefined>): Expression<KnownType> {
        switch (ast.op) {
            case InfixOperator.Add:
            case InfixOperator.Subtract:
            case InfixOperator.Multiply:
            case InfixOperator.Divide:
                return this.resolveArithmeticBinaryOpType(ast);
            case InfixOperator.GreaterThan:
            case InfixOperator.LessThan:
            case InfixOperator.GreaterThanEqual:
            case InfixOperator.LessThanEqual:
                return this.resolveRelationalBinaryOpType(ast);
            case InfixOperator.Equals:
            case InfixOperator.NotEquals:
                return this.resolveEqualityBinaryOpType(ast);
            case InfixOperator.And:
            case InfixOperator.Or:
                return this.resolveLogicalBinaryOpType(ast);
        }
    }

    private resolveUnaryOpType(ast: UnaryOp<undefined>): Expression<KnownType> {
        const expr = this.resolveKnownTypes(ast.expr);
        switch (ast.op) {
            case PrefixOperator.Minus:
                if (!isEqual(expr.type, intType) && !isEqual(expr.type, floatType)) {
                    this.nonfatal(DiagnosticCodes.BadArithmeticOpArgumentType, expr.type);
                }
                return { ...ast, type: expr.type, expr };
            case PrefixOperator.Not:
                if (!isEqual(expr.type, booleanType)) {
                    this.nonfatal(DiagnosticCodes.BadLogicalOpArgumentType, expr.type);
                }
                return { ...ast, type: booleanType, expr };
        }
    }

    private resolveDereferenceType(ast: Dereference<undefined>): Expression<KnownType> {
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

    private resolveVariableType(ast: Variable<undefined>): Expression<KnownType> {
        const type = this.currentScope.get(ast.name);
        if (type) {
            return { ...ast, type };
        }
        this.fatal(DiagnosticCodes.UnknownIdentifier, ast.name);
    }

    private resolveSequenceLiteralType(ast: SequenceLiteral<undefined>): Expression<KnownType> {
        const elements = ast.elements.map(this.resolveKnownTypes);
        const eltType = this.getCommonSupertype(elements);
        if (ast.typeName && eltType && isExactType(eltType)) {
            return { ...ast, elements, type: { kind: TypeKind.Simple, name: ast.typeName, typeArguments: [eltType] } };
        }
        return { ...ast, elements, type: { kind: TypeKind.SequenceLike, element: eltType } };
    }

    private resolveMapLiteralType(ast: MapLiteral<undefined>): Expression<KnownType> {
        const pairs = ast.pairs.map(([key, val]) => [
            this.resolveKnownTypes(key),
            this.resolveKnownTypes(val)
        ] as const);
        const keyType = this.getCommonSupertype(pairs.map(x => x[0]));
        const valueType = this.getCommonSupertype(pairs.map(x => x[1]));
        const typeArguments = (keyType && valueType) ? [keyType, valueType] as const : undefined;
        if (ast.typeName && typeArguments && typeArguments.every(isExactType)) {
            return { ...ast, pairs, type: { kind: TypeKind.Simple, name: ast.typeName, typeArguments } };
        }
        return { ...ast, pairs, type: { kind: TypeKind.MapLike, typeArguments } };
    }

    @boundMethod
    resolveKnownTypes(ast: Expression<undefined>): Expression<KnownType> {
        this.diagnostics.focus(ast);
        switch (ast.kind) {
            case ASTNodeKind.Invoke:
                return this.resolveInvokeType(ast);
            case ASTNodeKind.BinaryOp:
                return this.resolveBinaryOpType(ast);
            case ASTNodeKind.UnaryOp:
                return this.resolveUnaryOpType(ast);
            case ASTNodeKind.Dereference:
                return this.resolveDereferenceType(ast);
            case ASTNodeKind.Variable:
                return this.resolveVariableType(ast);
            case ASTNodeKind.FloatLiteral:
                return { ...ast, type: floatType };
            case ASTNodeKind.IntLiteral:
                return { ...ast, type: intType };
            case ASTNodeKind.BoolLiteral:
                return { ...ast, type: booleanType };
            case ASTNodeKind.StringLiteral:
                return { ...ast, type: stringType };
            case ASTNodeKind.SequenceLiteral:
                return this.resolveSequenceLiteralType(ast);
            case ASTNodeKind.MapLiteral:
                return this.resolveMapLiteralType(ast);
        }
    }

    private targetTypeInvoke(target: ExactType, ast: Invoke<KnownType>): Expression<ExactType> {
        const fnType = ast.fn.type as FunctionType;
        if (this.fitsInType(fnType.returnType, target)) {
            const fn = this.resolveTargetTyped(fnType, ast.fn);
            const args = zipWith(fnType.parameters, ast.args, this.resolveTargetTyped);
            return { ...ast, type: target, fn, args };
        }
        this.fatal(DiagnosticCodes.TargetTypeMismatch, target, ast.type);
    }

    private targetTypeBinaryOp(target: ExactType, ast: BinaryOp<KnownType>): Expression<ExactType> {
        const lhs = this.resolveTargetTyped(target, ast.lhs);
        const rhs = this.resolveTargetTyped(target, ast.rhs);
        return { ...ast, type: target, lhs, rhs };
    }

    private targetTypeUnaryOp(target: ExactType, ast: UnaryOp<KnownType>): Expression<ExactType> {
        const expr = this.resolveTargetTyped(target, ast.expr);
        return { ...ast, type: target, expr };
    }

    private targetTypeDereference(target: ExactType, ast: Dereference<KnownType>): Expression<ExactType> {
        const obj = this.resolveTargetTyped(ast.obj.type as SimpleType, ast.obj);
        return { ...ast, type: target, obj };
    }

    private targetTypeSequenceLiteral(target: ExactType, ast: SequenceLiteral<KnownType>): Expression<ExactType> {
        if (!ast.typeName || ast.typeName === (target as SimpleType).name) {
            const eltType = (target as SimpleType).typeArguments[0];
            const elements = ast.elements.map(x => this.resolveTargetTyped(eltType, x));
            return { ...ast, type: target, elements };
        }
        this.fatal(DiagnosticCodes.TargetTypeMismatch, target, ast.type);
    }

    private targetTypeMapLiteral(target: ExactType, ast: MapLiteral<KnownType>): Expression<ExactType> {
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

    @boundMethod
    resolveTargetTyped(target: ExactType, ast: Expression<KnownType>): Expression<ExactType> {
        if (!this.fitsInType(ast.type, target)) {
            this.fatal(DiagnosticCodes.TargetTypeMismatch, target, ast.type);
        }

        switch (ast.kind) {
            case ASTNodeKind.Invoke:
                return this.targetTypeInvoke(target, ast);
            case ASTNodeKind.BinaryOp:
                return this.targetTypeBinaryOp(target, ast);
            case ASTNodeKind.UnaryOp:
                return this.targetTypeUnaryOp(target, ast);
            case ASTNodeKind.Dereference:
                return this.targetTypeDereference(target, ast);
            case ASTNodeKind.Variable:
            case ASTNodeKind.FloatLiteral:
            case ASTNodeKind.IntLiteral:
            case ASTNodeKind.BoolLiteral:
            case ASTNodeKind.StringLiteral:
                return { ...ast, type: target };
            case ASTNodeKind.SequenceLiteral:
                return this.targetTypeSequenceLiteral(target, ast);
                case ASTNodeKind.MapLiteral:
                return this.targetTypeMapLiteral(target, ast);
        }
    }

    inferTypeOf(ast: Expression<KnownType>): ExactType {
        switch (ast.type.kind) {
            case TypeKind.SequenceLike:
                if (ast.type.element) {
                    this.fatal(DiagnosticCodes.CannotInferLiteralType);
                }
                this.fatal(DiagnosticCodes.CannotInferEmptyLiteralType);
            case TypeKind.MapLike:
                if (ast.type.typeArguments) {
                    this.fatal(DiagnosticCodes.CannotInferLiteralType);
                }
                this.fatal(DiagnosticCodes.CannotInferEmptyLiteralType);
        }

        return ast.type;
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