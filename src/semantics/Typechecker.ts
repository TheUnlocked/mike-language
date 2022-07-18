import { boundMethod } from 'autobind-decorator';
import { isEqual, spread, zip } from 'lodash';
import { ASTNodeKind, BinaryOp, Dereference, Expression, Identifier, InfixOperator, Invoke, MapLiteral, PrefixOperator, SequenceLiteral, Type, UnaryOp, Variable as Variable, VariableDefinition } from '../ast/Ast';
import { DiagnosticCodes } from '../diagnostics/DiagnosticCodes';
import { WithDiagnostics } from '../diagnostics/Mixin';
import { CanIfDestructAttribute, TypeAttributeKind } from '../types/Attribute';
import { booleanType, floatType, intType, primitiveTypes, stringType } from '../types/Primitives';
import { TypeInfo } from '../types/Type';
import { KnownType, FunctionType, IncompleteType, MapLike, SequenceLike, SimpleType, TypeKind, TOXIC, ToxicType, matchesSequenceLike, matchesMapLike } from '../types/KnownType';
import { Binder } from './Binder';

export class Typechecker extends WithDiagnostics(class {}) {
    private types = new Map(primitiveTypes.map(x => [x.name, x]));

    constructor(private binder: Binder) {
        super();
    }

    addType(...types: TypeInfo[]) {
        for (const type of types) {
            if (this.types.has(type.name)) {
                this.error(DiagnosticCodes.TypeDefinedMultipleTimes, type.name);
                continue;
            }
            this.types.set(type.name, type);
        }
    }

    @boundMethod
    fetchType(ast: Expression): KnownType {
        this.focus(ast);
        switch (ast.kind) {
            case ASTNodeKind.Invoke:
                return this.fetchInvokeType(ast);
            case ASTNodeKind.BinaryOp:
                return this.fetchBinaryOpType(ast);
            case ASTNodeKind.UnaryOp:
                return this.fetchUnaryOpType(ast);
            case ASTNodeKind.Dereference:
                return this.fetchDereferenceType(ast);
            case ASTNodeKind.Variable:
                return this.fetchVariableType(ast);
            case ASTNodeKind.FloatLiteral:
                return floatType;
            case ASTNodeKind.IntLiteral:
                return intType;
            case ASTNodeKind.BoolLiteral:
                return booleanType;
            case ASTNodeKind.StringLiteral:
                return stringType;
            case ASTNodeKind.SequenceLiteral:
                return this.fetchSequenceLiteralType(ast);
            case ASTNodeKind.MapLiteral:
                return this.fetchMapLiteralType(ast);
        }
    }
    
    private fitsInSimpleType(other: IncompleteType, target: SimpleType) {
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

    private fitsInFunctionType(other: IncompleteType, target: FunctionType) {
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
    private fitsInType(other: IncompleteType, target: KnownType): boolean {
        if (other.kind === TypeKind.Toxic) {
            return true;
        }
        if (isEqual(target, floatType) && isEqual(other, intType)) {
            return true;
        }
        switch (target.kind) {
            case TypeKind.Simple:
                return this.fitsInSimpleType(other, target);
            case TypeKind.Function:
                return this.fitsInFunctionType(other, target);
            case TypeKind.Toxic:
                return true;
        }
    }

    private getCommonSupertype(exprs: readonly Expression[]): KnownType | undefined {
        if (exprs.length === 0) {
            return;
        }
        if (exprs.length === 1) {
            return this.fetchType(exprs[0]);
        }
        return exprs.slice(1).reduce((acc, next) => {
            const nextType = this.fetchType(next)
            if (this.fitsInType(acc, nextType)) {
                if (nextType.kind === TypeKind.Toxic) {
                    return acc;
                }
                return nextType;
            }
            else if (this.fitsInType(nextType, acc)) {
                return acc;
            }
            this.focus(next);
            this.error(DiagnosticCodes.NoCommonType, nextType, acc);
            return TOXIC;
        }, this.fetchType(exprs[0]));
    }

    private fetchInvokeType(ast: Invoke): KnownType {
        const fnType = this.fetchType(ast.fn);
        
        if (fnType.kind === TypeKind.Function) {
            if (fnType.parameters.length !== ast.args.length) {
                this.error(DiagnosticCodes.WrongNumberOfArguments, fnType.parameters.length, ast.args.length);
            }
            for (const [t, arg] of zip(fnType.parameters, ast.args)) {
                if (!t || !arg) {
                    break;
                }
                const argType = this.fetchType(arg);
                if (!this.fitsInType(argType, t)) {
                    this.error(DiagnosticCodes.ArgumentParameterTypeMismatch, argType, t);
                }
            }
            return fnType.returnType;
        }
        else {
            this.error(DiagnosticCodes.Uninvokable, fnType);
            return TOXIC;
        }
    }

    private resolveArithmeticBinaryOpType(ast: BinaryOp): KnownType {
        const lhs = this.fetchType(ast.lhs);
        const rhs = this.fetchType(ast.rhs);

        if (isEqual(lhs, intType)) {
            if (isEqual(rhs, intType)) {
                return intType;
            }
            else if (isEqual(rhs, floatType)) {
                return floatType;
            }
            this.focus(ast.rhs);
            this.error(DiagnosticCodes.BadArithmeticOpArgumentType, rhs);
            return TOXIC;
        }
        else if (isEqual(lhs, floatType)) {
            if (isEqual(rhs, intType) || isEqual(rhs, floatType)) {
                return floatType;
            }
            this.focus(ast.rhs);
            this.error(DiagnosticCodes.BadArithmeticOpArgumentType, rhs);
            return TOXIC;
        }
        this.focus(ast.lhs);
        this.error(DiagnosticCodes.BadArithmeticOpArgumentType, lhs);
        return TOXIC;
    }

    private resolveRelationalBinaryOpType(ast: BinaryOp): KnownType {
        const lhs = this.fetchType(ast.lhs);
        const rhs = this.fetchType(ast.rhs);

        if (!isEqual(lhs, intType) && !isEqual(lhs, floatType)) {
            this.focus(ast.lhs);
            this.error(DiagnosticCodes.BadInequalityOpArgumentType, lhs);
        }
        if (!isEqual(rhs, intType) && !isEqual(rhs, floatType)) {
            this.focus(ast.rhs);
            this.error(DiagnosticCodes.BadInequalityOpArgumentType, rhs);
        }
        return booleanType;
    }

    private resolveEqualityBinaryOpType(ast: BinaryOp): KnownType {
        const lhs = this.fetchType(ast.lhs);
        const rhs = this.fetchType(ast.rhs);

        if (!isEqual(lhs, rhs)) {
            this.error(DiagnosticCodes.EqualityArgumentTypeMismatch, lhs, rhs);
        }
        if ([ASTNodeKind.SequenceLiteral, ASTNodeKind.MapLiteral].includes(ast.lhs.kind)) {
            this.focus(ast.lhs);
            this.error(DiagnosticCodes.EqualityArgumentIsNewObject);
        }
        if ([ASTNodeKind.SequenceLiteral, ASTNodeKind.MapLiteral].includes(ast.rhs.kind)) {
            this.focus(ast.rhs);
            this.error(DiagnosticCodes.EqualityArgumentIsNewObject);
        }
        return booleanType;
    }

    private resolveLogicalBinaryOpType(ast: BinaryOp): KnownType {
        const lhs = this.fetchType(ast.lhs);
        const rhs = this.fetchType(ast.rhs);

        if (!isEqual(lhs, booleanType)) {
            this.error(DiagnosticCodes.BadLogicalOpArgumentType, lhs);
        }
        if (!isEqual(rhs, booleanType)) {
            this.error(DiagnosticCodes.BadLogicalOpArgumentType, rhs);
        }
        return booleanType;
    }

    private fetchBinaryOpType(ast: BinaryOp): KnownType {
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

    private fetchUnaryOpType(ast: UnaryOp): KnownType {
        const exprType = this.fetchType(ast.expr);
        switch (ast.op) {
            case PrefixOperator.Minus:
                if (!isEqual(exprType, intType) && !isEqual(exprType, floatType)) {
                    this.error(DiagnosticCodes.BadArithmeticOpArgumentType, exprType);
                }
                return exprType;
            case PrefixOperator.Not:
                if (!isEqual(exprType, booleanType)) {
                    this.error(DiagnosticCodes.BadLogicalOpArgumentType, exprType);
                }
                return booleanType;
        }
    }

    private fetchDereferenceType(ast: Dereference): KnownType {
        const objType = this.fetchType(ast.obj);
        switch (objType.kind) {
            case TypeKind.Simple: {
                const objTypeInfo = this.types.get(objType.name)!;
                const memberType = objTypeInfo.quantify(objType.typeArguments).members[ast.member.name];
                if (!memberType) {
                    this.error(DiagnosticCodes.InvalidMember, objType, ast.member.name);
                    return TOXIC;
                }
                return memberType;
            }
            case TypeKind.Function:
                this.error(DiagnosticCodes.InvalidMember, objType, ast.member.name);
                return TOXIC;
            case TypeKind.Toxic:
                return TOXIC;
        }
    }

    @boundMethod
    getTypeOfTypeNode(ast: Type): KnownType {
        switch (ast.kind) {
            case ASTNodeKind.TypeIdentifier:
                return { kind: TypeKind.Simple, name: ast.name, typeArguments: [] };
            case ASTNodeKind.GenericType:
                return {
                    kind: TypeKind.Simple,
                    name: ast.name.name,
                    typeArguments: ast.typeArguments.map(this.getTypeOfTypeNode)
                };
            case ASTNodeKind.FunctionType:
                return {
                    kind: TypeKind.Function,
                    parameters: ast.parameters.map(this.getTypeOfTypeNode),
                    returnType: this.getTypeOfTypeNode(ast.returnType)
                };
        }
    }

    private fetchVariableDefinitionType(ast: VariableDefinition): KnownType {
        switch (ast.kind) {
            case ASTNodeKind.ParameterDefinition:
            case ASTNodeKind.Parameter:
                return this.getTypeOfTypeNode(ast.type);
            case ASTNodeKind.StateDefinition:
                if (ast.type) {
                    return this.getTypeOfTypeNode(ast.type);
                }
                return ast.default ? this.fetchType(ast.default) : TOXIC;
            case ASTNodeKind.IfCase: {
                const conditionType = this.fetchType(ast.condition);
                if (conditionType.kind === TypeKind.Simple) {
                    const typeInfo = this.types.get(conditionType.name);
                    const deconstructAttr = typeInfo!
                        .quantify(conditionType.typeArguments).attributes
                        .find((x): x is CanIfDestructAttribute => x.kind === TypeAttributeKind.CanIfDestruct);
                    
                    if (deconstructAttr) {
                        return deconstructAttr.into;
                    }
                }
                return TOXIC;
            }
            case ASTNodeKind.LetStatement:
                if (ast.type) {
                    return this.getTypeOfTypeNode(ast.type);
                }
                return ast.value ? this.fetchType(ast.value) : TOXIC;
            case ASTNodeKind.OutOfTree:
                return ast.type;
        }
    }

    fetchSymbolType(ast: Identifier): KnownType {
        const varDef = this.binder.getScope(ast).get(ast.name);
        if (varDef) {
            return this.fetchVariableDefinitionType(varDef);
        }
        this.error(DiagnosticCodes.UnknownIdentifier, ast.name);
        return TOXIC;
    }
 
    private fetchVariableType(ast: Variable): KnownType {
        const varDef = this.binder.getScope(ast).get(ast.identifier.name);
        if (varDef) {
            return this.fetchVariableDefinitionType(varDef);
        }
        this.error(DiagnosticCodes.UnknownIdentifier, ast.identifier.name);
        return TOXIC;
    }

    private fetchSequenceLiteralType(ast: SequenceLiteral): KnownType {
        let targetType: SimpleType<1> | ToxicType | undefined;

        if (ast.type) {
            const eltTypeInfo = this.types.get(ast.type.name);
            if (!eltTypeInfo) {
                this.error(DiagnosticCodes.TypeDoesNotExist, ast.type.name);
                return TOXIC;
            }
            
            const eltType = this.getCommonSupertype(ast.elements);
            if (eltType) {
                if (!eltTypeInfo) {
                    this.error(DiagnosticCodes.TypeDoesNotExist, ast.type.name);
                    return TOXIC;
                }
                if (eltTypeInfo.numParameters !== 1 || !eltTypeInfo.quantify([eltType]).attributes.some(x => x.kind === TypeAttributeKind.IsSequenceLike)) {
                    this.error(DiagnosticCodes.TypeIsNotSequenceLike, ast.type.name);
                }
                return { kind: TypeKind.Simple, name: ast.type.name, typeArguments: [eltType] };
            }

            targetType = this.fetchSequenceLiteralTargetType({
                kind: TypeKind.SequenceLike,
                name: ast.type.name
            }, ast);
        }
        else {
            targetType = this.fetchSequenceLiteralTargetType({
                kind: TypeKind.SequenceLike,
                element: this.getCommonSupertype(ast.elements)
            }, ast);
        }

        if (!targetType) {
            this.error(DiagnosticCodes.CannotInferSequenceLiteralType);
            return TOXIC;
        }
        return targetType;
    }

    private fetchMapLiteralType(ast: MapLiteral): KnownType {
        let targetType: SimpleType<2> | ToxicType | undefined;

        if (ast.type) {
            const eltTypeInfo = this.types.get(ast.type.name);
            if (!eltTypeInfo) {
                this.error(DiagnosticCodes.TypeDoesNotExist, ast.type.name);
                return TOXIC;
            }
            
            const keyType = this.getCommonSupertype(ast.pairs.map(x => x.key));
            if (keyType) {
                const valType = this.getCommonSupertype(ast.pairs.map(x => x.value));
                if (valType) {
                    if (!eltTypeInfo) {
                        this.error(DiagnosticCodes.TypeDoesNotExist, ast.type.name);
                        return TOXIC;
                    }
                    if (eltTypeInfo.numParameters !== 2 || !eltTypeInfo.quantify([keyType, valType]).attributes.some(x => x.kind === TypeAttributeKind.IsMapLike)) {
                        this.error(DiagnosticCodes.TypeIsNotMapLike, ast.type.name);
                    }
                    return { kind: TypeKind.Simple, name: ast.type.name, typeArguments: [keyType, valType] };
                }
            }
            
            targetType = this.fetchMapLiteralTargetType({
                kind: TypeKind.MapLike,
                name: ast.type.name
            }, ast);
        }
        else {
            const keyType = this.getCommonSupertype(ast.pairs.map(x => x.key));
            if (keyType) {
                const valType = this.getCommonSupertype(ast.pairs.map(x => x.value));
                if (valType) {
                    targetType = this.fetchMapLiteralTargetType({
                        kind: TypeKind.MapLike,
                        typeArguments: [keyType, valType]
                    }, ast);
                }
            }
            else {
                targetType = this.fetchMapLiteralTargetType({
                    kind: TypeKind.MapLike
                }, ast);
            }
        }

        if (!targetType) {
            this.error(DiagnosticCodes.CannotInferMapLiteralType);
            return TOXIC;
        }
        return targetType;
    }

    private fetchTargetType(ast: Expression): KnownType | undefined {
        const parent = this.binder.getParent(ast);
        switch (parent.kind) {
            case ASTNodeKind.LetStatement:
                return parent.type ? this.getTypeOfTypeNode(parent.type) : undefined;
            case ASTNodeKind.Invoke: {
                const position = this.binder.getPositionInParent(ast, parent);
                if (position === -1) {
                    return;
                }
                const fnType = this.fetchType(parent.fn);
                if (fnType.kind === TypeKind.Function) {
                    return fnType.parameters[position];
                }
                return;
            }
            case ASTNodeKind.SequenceLiteral: {
                const sequenceType = this.fetchTargetType(parent);
                if (sequenceType) {
                    if (matchesSequenceLike(sequenceType, { kind: TypeKind.SequenceLike })) {
                        return sequenceType.typeArguments[0];
                    }
                    return TOXIC;
                }
                return;
            }
            case ASTNodeKind.Pair: {
                const mapType = this.fetchTargetType(this.binder.getParent(parent));
                if (mapType) {
                    if (matchesMapLike(mapType, { kind: TypeKind.MapLike })) {
                        const positionInPair = this.binder.getPositionInParent(ast, parent);
                        return mapType.typeArguments[positionInPair];
                    }
                    return TOXIC;
                }
            }
            default:
                return;
        }
    }

    private fetchSequenceLiteralTargetType(constraint: SequenceLike, ast: SequenceLiteral): SimpleType<1> | ToxicType | undefined {
        const targetType = this.fetchTargetType(ast);

        if (targetType && matchesSequenceLike(targetType, constraint)) {
            const typeInfo = this.types.get(targetType.name);
            if (typeInfo!.quantify(targetType.typeArguments).attributes.some(x => x.kind === TypeAttributeKind.IsSequenceLike)) {
                return targetType;
            }
            this.error(DiagnosticCodes.PresumedTypeIsNotSequenceLike, targetType, targetType.name);
            return TOXIC;
        }

        return;
    }

    private fetchMapLiteralTargetType(constraint: MapLike, ast: MapLiteral): SimpleType<2> | ToxicType | undefined {
        const targetType = this.fetchTargetType(ast);
        
        if (targetType && matchesMapLike(targetType, constraint)) {
            const typeInfo = this.types.get(targetType.name);
            if (typeInfo!.quantify(targetType.typeArguments).attributes.some(x => x.kind === TypeAttributeKind.IsMapLike)) {
                return targetType;
            }
            this.error(DiagnosticCodes.PresumedTypeIsNotMapLike, targetType, targetType.name);
            return TOXIC;
        }

        return;
    }
}