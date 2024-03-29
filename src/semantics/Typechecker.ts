import { boundMethod } from 'autobind-decorator';
import { groupBy, isEqual, spread, zip } from 'lodash';
import { ASTNodeKind, BinaryOp, Dereference, Expression, Identifier, InfixOperator, Invoke, isVariableDefinition, MapLiteral, PrefixOperator, SequenceLiteral, Type, TypeDefinition, UnaryOp, Variable as Variable, VariableDefinition } from '../ast/Ast';
import { DiagnosticCodes } from '../diagnostics/DiagnosticCodes';
import { DiagnosticsMixin } from '../diagnostics/DiagnosticsMixin';
import { CanIfDestructAttribute, TypeAttributeKind } from '../types/Attribute';
import { booleanType, floatType, intType, primitiveTypes, stringType } from '../types/Primitives';
import { TypeInfo } from '../types/TypeInfo';
import { KnownType, FunctionType, IncompleteType, MapLike, SequenceLike, SimpleType, TypeKind, TOXIC, ToxicType, matchesSequenceLike, matchesMapLike, TypeVariable, replaceTypeVariables, optionOf, simpleTypeOf, functionOf } from '../types/KnownType';
import { SymbolTable } from './SymbolTable';
import { withCache } from '../utils/cache';

export class Typechecker extends DiagnosticsMixin {
    private typeCache = new Map<Expression | Identifier | VariableDefinition | Type, KnownType>();

    private types!: Map<string, TypeInfo>;

    constructor(private readonly stdlibTypes: readonly TypeInfo[], public readonly symbolTable: SymbolTable) {
        super();
        this.notifyChange();
    }

    notifyChange() {
        this.types = new Map(primitiveTypes.concat(this.stdlibTypes).map(x => [x.name, x]));
        this.clearCache();
    }

    private clearCache() {
        this.typeCache.clear();
    }

    loadTypes(types: readonly TypeDefinition[]) {
        const groupedTypesByName = Object.values(groupBy(types, x => x.name.name));

        types = groupedTypesByName.flatMap(types => {
            const type = types[0];
            const name = type.name.name;
            if (this.types.has(name)) {
                this.focus(type.name);
                this.error(DiagnosticCodes.TypeDefinedMultipleTimes, name);
                return [];
            }
            if (types.length > 1) {
                this.focus(type.name);
                this.error(DiagnosticCodes.TypeDefinedMultipleTimes, name);
            }
            // The errors for the other type declarations will be handled by the validator.
            return type;
        });

        // forward declarations to resolve cycles
        for (const typeDef of types) {
            const name = typeDef.name.name;
            this.types.set(name, {
                name,
                numParameters: 0,
                definedBy: typeDef,
                quantify: () => ({ attributes: [], members: {} })
            });
        }
        // actual declarations
        for (const typeDef of types) {
            const name = typeDef.name.name;

            const members = typeDef.parameters.map(({ name, type }) => [
                name.name,
                this.fetchTypeOfTypeNode(type)
            ] as const);

            this.types.set(name, {
                name,
                numParameters: 0,
                definedBy: typeDef,
                quantify: () => ({
                    attributes: [
                        { kind: TypeAttributeKind.IsUserDefined },
                    ],
                    members: Object.fromEntries(members)
                })
            });
        }
        this.clearCache();
    }

    fetchTypeInfoFromSimpleType(type: SimpleType) {
        const info = this.types.get(type.name);
        if (!info || type.typeArguments.length !== info.numParameters) {
            return;
        }
        return this.types.get(type.name)?.quantify(type.typeArguments);
    }

    fetchTypeInfoFromSimpleTypeWithDiagnostics(type: SimpleType, source: Type) {
        const info = this.types.get(type.name);
        if (!info) {
            this.focus(source);
            this.error(DiagnosticCodes.TypeDoesNotExist, type.name);
            return;
        }
        if (type.typeArguments.length !== info.numParameters) {
            this.focus(source);
            this.error(DiagnosticCodes.WrongNumberOfTypeArguments, info.numParameters, type.typeArguments.length);
            return;
        }
        return this.types.get(type.name)?.quantify(type.typeArguments);
    }

    @boundMethod
    fetchType(ast: Expression): KnownType {
        return withCache(ast, this.typeCache, () => {
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
        });
    }
    
    private fitsInSimpleType(other: IncompleteType, target: SimpleType) {
        if (other.kind === TypeKind.SequenceLike) {
            return target.typeArguments.length === 1
                && Boolean(this.fetchTypeInfoFromSimpleType(target)
                    ?.attributes.some(x => x.kind === TypeAttributeKind.IsSequenceLike))
                && (!other.element || this.fitsInType(other.element, target.typeArguments[0]));
        }
        else if (other.kind === TypeKind.MapLike) {
            return target.typeArguments.length === 2
                && Boolean(this.fetchTypeInfoFromSimpleType(target)
                    ?.attributes.some(x => x.kind === TypeAttributeKind.IsMapLike))
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

    @boundMethod
    private generateConstraints(t1: KnownType, t2: KnownType): (false | [TypeVariable, KnownType])[] {
        if (t2.kind === TypeKind.TypeVariable) {
            if (t1.kind === TypeKind.TypeVariable) {
                return [[t1, t2], [t2, t1]];
            }
            return [[t2, t1]];
        }
        switch (t1.kind) {
            case TypeKind.TypeVariable:
                return [[t1, t2]];
            case TypeKind.Simple:
                if (t2.kind !== TypeKind.Simple || t1.name !== t2.name) {
                    return [false];
                }
                return zip(t1.typeArguments, t2.typeArguments).flatMap(spread(this.generateConstraints));
            case TypeKind.Function:
                if (t2.kind !== TypeKind.Function) {
                    return [false];
                }
                if (t1.typeParameters.length > 0 || t2.typeParameters.length > 0) {
                    // Types like <T>(T) => (<U>(U) => Map<T, U>) are not currently supported
                    return [false];
                }
                return [
                    ...this.generateConstraints(t1.returnType, t2.returnType),
                    ...zip(t1.parameters, t2.parameters).flatMap(spread(this.generateConstraints))
                ];
            case TypeKind.Toxic:
                return [];
        }
    }

    private solveTypeVariables(fn: FunctionType, args: readonly KnownType[]) {
        if (fn.parameters.length !== args.length) {
            return undefined;
        }
        const rawConstraints = zip(fn.parameters, args).flatMap(spread(this.generateConstraints));
        const constraints = rawConstraints.filter(Boolean) as ([TypeVariable, KnownType] & { seen?: true })[];
        if (rawConstraints.length !== constraints.length) {
            // Some non-generic type constraint failed.
            return undefined;
        }
        const map = new Map<symbol, KnownType>();

        while (constraints.length > 0) {
            const constraint = constraints.pop()!;
            const [{ symbol }, type] = constraint;
            const priorConstraint = map.get(symbol);
            if (priorConstraint) {
                if (!this.fitsInType(type, priorConstraint)) {
                    // Constraint failed
                    return undefined;
                }
            }
            else if (type.kind === TypeKind.TypeVariable) {
                if (constraint.seen) {
                    // Type variable cannot be resolved.
                    // Not totally sure if it's safe to abandon after just one cycle.
                    return undefined;
                }
                constraint.seen = true;
                constraints.unshift(constraint);
            }
            else {
                map.set(symbol, type);
            }
        }

        return map;
    }

    private fitsInFunctionType(other: IncompleteType, target: FunctionType) {
        if (other.kind === TypeKind.Function) {
            if (isEqual(other, target)) {
                // Edge case for supporting things like some === some
                return true;
            }
            const constraints = this.solveTypeVariables(target, other.parameters);
            return Boolean(constraints) && this.fitsInType(other.returnType, target.returnType);
        }
        return false;
    }

    @boundMethod
    fitsInType(other: IncompleteType, target: KnownType): boolean {
        if (other.kind === TypeKind.Toxic) {
            return true;
        }
        switch (target.kind) {
            case TypeKind.Simple:
                return this.fitsInSimpleType(other, target);
            case TypeKind.Function:
                return this.fitsInFunctionType(other, target);
            case TypeKind.TypeVariable:
                return other.kind === TypeKind.TypeVariable && other.symbol === target.symbol;
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

        let retToxic = false;
        const result = exprs.slice(1).reduce((acc, next) => {
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
            retToxic = true;
            return acc;
        }, this.fetchType(exprs[0]));

        return retToxic ? TOXIC : result;
    }

    private fetchInvokeType(ast: Invoke): KnownType {
        let fnType = this.fetchType(ast.fn);
        
        if (fnType.kind === TypeKind.Function) {
            if (fnType.parameters.length !== ast.args.length) {
                this.focus(ast);
                this.error(DiagnosticCodes.WrongNumberOfArguments, fnType.parameters.length, ast.args.length);
            }
            if (fnType.typeParameters.length > 0) {
                const argTypes = ast.args.map(this.fetchType);
                const typeParamMappings = this.solveTypeVariables(fnType, argTypes);
                if (typeParamMappings) {
                    fnType = replaceTypeVariables(fnType, typeParamMappings);
                }
            }
            for (const [t, arg] of zip(fnType.parameters, ast.args)) {
                if (!t || !arg) {
                    break;
                }
                const argType = this.fetchType(arg);
                if (!this.fitsInType(argType, t)) {
                    this.focus(arg);
                    this.error(DiagnosticCodes.ArgumentParameterTypeMismatch, argType, t);
                }
            }
            return fnType.returnType;
        }
        else if (fnType.kind !== TypeKind.Toxic) {
            this.focus(ast.fn);
            this.error(DiagnosticCodes.Uninvokable, fnType);
        }
        return TOXIC;
    }

    private resolveArithmeticBinaryOpType(ast: BinaryOp): KnownType {
        const lhs = this.fetchType(ast.lhs);
        const rhs = this.fetchType(ast.rhs);

        if (isEqual(lhs, intType)) {
            if (isEqual(rhs, intType)) {
                if (ast.op === InfixOperator.Divide) {
                    return optionOf(intType);
                }
                return intType;
            }
            this.focus(ast.rhs);
            this.error(DiagnosticCodes.BadArithmeticOpArgumentType, rhs);
        }
        else if (isEqual(lhs, floatType)) {
            if (isEqual(rhs, floatType)) {
                return floatType;
            }
            this.focus(ast.rhs);
            this.error(DiagnosticCodes.BadArithmeticOpArgumentType, rhs);
        }
        else {
            this.focus(ast.lhs);
            this.error(DiagnosticCodes.BadArithmeticOpArgumentType, lhs);
            if (!isEqual(rhs, intType) && !isEqual(rhs, floatType)) {
                this.focus(ast.rhs);
                this.error(DiagnosticCodes.BadArithmeticOpArgumentType, rhs);
            }
        }
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

        if (!this.fitsInType(lhs, rhs) && !this.fitsInType(rhs, lhs)) {
            this.focus(ast);
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
            this.focus(ast.lhs);
            this.error(DiagnosticCodes.BadLogicalOpArgumentType, lhs);
        }
        if (!isEqual(rhs, booleanType)) {
            this.focus(ast.rhs);
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
        this.focus(ast.expr);
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

    private fetchMemberType(obj: Expression, member: Identifier): KnownType {
        const objType = this.fetchType(obj);
        switch (objType.kind) {
            case TypeKind.Simple: {
                const memberType = this.fetchTypeInfoFromSimpleType(objType)!.members[member.name];
                if (!memberType) {
                    this.focus(member);
                    this.error(DiagnosticCodes.InvalidMember, objType, member.name);
                    return TOXIC;
                }
                return memberType;
            }
            case TypeKind.Function:
            case TypeKind.TypeVariable:
                this.focus(member);
                this.error(DiagnosticCodes.InvalidMember, objType, member.name);
                return TOXIC;
            case TypeKind.Toxic:
                return TOXIC;
        }
    }

    private fetchDereferenceType(ast: Dereference): KnownType {
        return this.fetchMemberType(ast.obj, ast.member);
    }

    @boundMethod
    fetchTypeOfTypeNode(ast: Type): KnownType {
        return withCache(ast, this.typeCache, (): KnownType => {
            let result: KnownType;
            switch (ast.kind) {
                case ASTNodeKind.TypeIdentifier:
                    result = simpleTypeOf(ast.name);
                    if (!this.fetchTypeInfoFromSimpleTypeWithDiagnostics(result, ast)) {
                        result = TOXIC;
                    }
                    break;
                case ASTNodeKind.GenericType: {
                    result = simpleTypeOf(ast.name.name, ast.typeArguments.map(this.fetchTypeOfTypeNode));
                    if (!this.fetchTypeInfoFromSimpleTypeWithDiagnostics(result, ast)) {
                        result = TOXIC;
                    }
                    break;
                }
                case ASTNodeKind.FunctionType:
                    result = functionOf(
                        ast.parameters.map(this.fetchTypeOfTypeNode),
                        this.fetchTypeOfTypeNode(ast.returnType),
                    );
                    break;
            }
            return result;
        });
    }

    fetchVariableDefinitionType(ast: VariableDefinition): KnownType {
        return withCache(ast, this.typeCache, () => {

            switch (ast.kind) {
                case ASTNodeKind.ParameterDefinition:
                case ASTNodeKind.Parameter:
                    return this.fetchTypeOfTypeNode(ast.type);
                case ASTNodeKind.StateDefinition:
                    if (ast.type) {
                        return this.fetchTypeOfTypeNode(ast.type);
                    }
                    else if (ast.default) {
                        const defaultType = this.fetchType(ast.default);
                        if (defaultType.isNotInferrable) {
                            this.focus(ast);
                            this.error(DiagnosticCodes.CannotInferVariableType);
                            return { ...defaultType, isNotInferrable: false };
                        }
                        return defaultType;
                    }
                    return TOXIC;
                case ASTNodeKind.TypeDefinition:
                    return functionOf(
                        ast.parameters.map(x => this.fetchTypeOfTypeNode(x.type)),
                        simpleTypeOf(ast.name.name),
                    );
                case ASTNodeKind.IfCase: {
                    const conditionType = this.fetchType(ast.condition);
                    if (conditionType.kind === TypeKind.Simple) {
                        const deconstructAttr = this.fetchTypeInfoFromSimpleType(conditionType)!.attributes
                            .find((x): x is CanIfDestructAttribute => x.kind === TypeAttributeKind.IsLegalCondition);
                        
                        if (deconstructAttr?.destructInto) {
                            return deconstructAttr.destructInto;
                        }
                        this.focus(ast.deconstruct!);
                        this.error(DiagnosticCodes.TypeCannotBeDestructured, conditionType);
                    }
                    return TOXIC;
                }
                case ASTNodeKind.LetStatement:
                    if (ast.type) {
                        return this.fetchTypeOfTypeNode(ast.type);
                    }
                    else if (ast.value) {
                        const valueType = this.fetchType(ast.value);
                        if (valueType.isNotInferrable) {
                            this.focus(ast);
                            this.error(DiagnosticCodes.CannotInferVariableType);
                            return { ...valueType, isNotInferrable: false };
                        }
                        return valueType;
                    }
                    return TOXIC;
                case ASTNodeKind.OutOfTree:
                    return ast.type;
            }
        });
    }

    fetchTypeFromIdentifier(ast: Identifier): KnownType {
        return withCache(ast, this.typeCache, () => {
            const parent = ast.parent!;
            if (parent.kind === ASTNodeKind.Dereference) {
                return this.fetchType(parent);
            }
            if (parent.kind === ASTNodeKind.AssignField) {
                return this.fetchMemberType(parent.obj, parent.member);
            }
            const varDef = this.symbolTable.getVariableDefinition(ast);
            if (varDef) {
                return this.fetchVariableDefinitionType(varDef);
            }
            this.focus(ast);
            this.error(DiagnosticCodes.UnknownIdentifier, ast.name);
            return TOXIC;
        });
    }
 
    private fetchVariableType(ast: Variable): KnownType {
        // We also want to cache this as the type of the identifier itself
        // Caching of the variable node is automatically handled by fetchType.
        return withCache(ast.identifier, this.typeCache, () => {
            this.focus(ast);
            const varDef = this.symbolTable.getVariableDefinition(ast.identifier);
            if (varDef) {
                if (varDef.kind === ASTNodeKind.LetStatement) {
                    // This is a local, so we need to make sure it has been assigned.
                    const block = varDef.parent!;
                    const defPos = this.symbolTable.getPositionInParent(varDef);
                    const varPos = this.symbolTable.getExpressionPositionInBlock(ast, block);
                    if (varPos === undefined || varPos <= defPos) {
                        this.error(DiagnosticCodes.NotYetDefined, ast.identifier.name);
                    }
                    else {
                        const assignmentPos = this.symbolTable.getFirstAssignmentPositionInBlock(ast.identifier.name, block);
                        if (assignmentPos === undefined || varPos <= assignmentPos) {
                            this.error(DiagnosticCodes.NotYetInitialized, ast.identifier.name);
                        }
                    }
                }
                const statement = this.symbolTable.getParentStatement(ast);
                if (statement.kind === ASTNodeKind.StateDefinition &&
                    ![ASTNodeKind.OutOfTree, ASTNodeKind.TypeDefinition].includes(varDef.kind)
                ) {
                    this.error(DiagnosticCodes.NotYetDefined, ast.identifier.name);
                }
                return this.fetchVariableDefinitionType(varDef);
            }
            this.error(DiagnosticCodes.UnknownIdentifier, ast.identifier.name);
            return TOXIC;
        });
    }

    private fetchSequenceLiteralType(ast: SequenceLiteral): KnownType {
        let targetType: SimpleType<1> | ToxicType | undefined;

        if (ast.type) {
            const eltTypeInfo = this.types.get(ast.type.name);
            if (!eltTypeInfo) {
                this.focus(ast.type);
                this.error(DiagnosticCodes.TypeDoesNotExist, ast.type.name);
                return TOXIC;
            }
            
            const eltType = this.getCommonSupertype(ast.elements);
            if (eltType) {
                if (!eltTypeInfo) {
                    this.focus(ast.type);
                    this.error(DiagnosticCodes.TypeDoesNotExist, ast.type.name);
                    return TOXIC;
                }
                if (eltTypeInfo.numParameters !== 1 || !eltTypeInfo.quantify([eltType]).attributes.some(x => x.kind === TypeAttributeKind.IsSequenceLike)) {
                    this.focus(ast.type);
                    this.error(DiagnosticCodes.TypeIsNotSequenceLike, ast.type.name);
                }
                return simpleTypeOf(ast.type.name, [eltType]);
            }

            targetType = this.fetchSequenceLiteralTargetType({
                _type: true,
                kind: TypeKind.SequenceLike,
                name: ast.type.name
            }, ast);
        }
        else {
            targetType = this.fetchSequenceLiteralTargetType({
                _type: true,
                kind: TypeKind.SequenceLike,
                element: this.getCommonSupertype(ast.elements)
            }, ast);
        }

        if (!targetType) {
            this.focus(ast);
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
                this.focus(ast.type);
                this.error(DiagnosticCodes.TypeDoesNotExist, ast.type.name);
                return TOXIC;
            }
            
            const keyType = this.getCommonSupertype(ast.pairs.map(x => x.key));
            if (keyType) {
                const valType = this.getCommonSupertype(ast.pairs.map(x => x.value));
                if (valType) {
                    if (!eltTypeInfo) {
                        this.focus(ast.type);
                        this.error(DiagnosticCodes.TypeDoesNotExist, ast.type.name);
                        return TOXIC;
                    }
                    if (eltTypeInfo.numParameters !== 2 || !eltTypeInfo.quantify([keyType, valType]).attributes.some(x => x.kind === TypeAttributeKind.IsMapLike)) {
                        this.focus(ast.type);
                        this.error(DiagnosticCodes.TypeIsNotMapLike, ast.type.name);
                    }
                    return simpleTypeOf(ast.type.name, [keyType, valType]);
                }
            }
            
            targetType = this.fetchMapLiteralTargetType({
                _type: true,
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
                        _type: true,
                        kind: TypeKind.MapLike,
                        typeArguments: [keyType, valType]
                    }, ast);
                }
            }
            else {
                targetType = this.fetchMapLiteralTargetType({
                    _type: true,
                    kind: TypeKind.MapLike
                }, ast);
            }
        }

        if (!targetType) {
            this.focus(ast);
            this.error(DiagnosticCodes.CannotInferMapLiteralType);
            return TOXIC;
        }
        return targetType;
    }

    private fetchTargetType(ast: Expression): KnownType | undefined {
        const parent = ast.parent!;
        
        switch (parent.kind) {
            case ASTNodeKind.LetStatement:
            case ASTNodeKind.StateDefinition:
                return parent.type ? this.fetchVariableDefinitionType(parent) : undefined;
            case ASTNodeKind.AssignVar:
                return this.fetchTypeFromIdentifier(parent.variable);
            case ASTNodeKind.AssignField:
                return this.fetchTypeFromIdentifier(parent.member);
            case ASTNodeKind.Invoke: {
                // - 1 since the first child will be the function itself
                const position = this.symbolTable.getPositionInParent(ast) - 1;
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
                    if (matchesSequenceLike(sequenceType, { _type: true, kind: TypeKind.SequenceLike })) {
                        return sequenceType.typeArguments[0];
                    }
                    return TOXIC;
                }
                return;
            }
            case ASTNodeKind.Pair: {
                const mapType = this.fetchTargetType(parent.parent!);
                if (mapType) {
                    if (matchesMapLike(mapType, { _type: true, kind: TypeKind.MapLike })) {
                        const positionInPair = ast === parent.key ? 0 : 1;
                        return mapType.typeArguments[positionInPair];
                    }
                    return TOXIC;
                }
            }
        }
    }

    private fetchSequenceLiteralTargetType(constraint: SequenceLike, ast: SequenceLiteral): SimpleType<1> | ToxicType | undefined {
        const targetType = this.fetchTargetType(ast);

        if (targetType && matchesSequenceLike(targetType, constraint)) {
            const typeInfo = this.types.get(targetType.name);
            if (typeInfo!.quantify(targetType.typeArguments).attributes.some(x => x.kind === TypeAttributeKind.IsSequenceLike)) {
                return targetType;
            }
            this.focus(ast);
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
            this.focus(ast);
            this.error(DiagnosticCodes.PresumedTypeIsNotMapLike, targetType, targetType.name);
            return TOXIC;
        }

        return;
    }
}