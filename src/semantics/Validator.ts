import { boundMethod } from 'autobind-decorator';
import { AnyNode, AssignField, AssignVar, ASTNodeKind, Block, Expression, IfElseChain, LetStatement, ListenerDefinition, Parameter, ParameterDefinition, Program, StateDefinition, Statement, StatementOrBlock, Type, TypeDefinition } from '../ast/Ast';
import { DUMMY_IDENTIFIER, getVariableDefinitionIdentifier } from '../ast/AstUtils';
import { DiagnosticCodes } from '../diagnostics/DiagnosticCodes';
import { DiagnosticsMixin } from '../diagnostics/DiagnosticsMixin';
import { TypeAttributeKind } from '../types/Attribute';
import { KnownType, TypeKind } from '../types/KnownType';
import { expectNever } from '../utils/types';
import { Typechecker } from './Typechecker';

export interface EventRegistration {
    readonly name: string;
    readonly required: boolean;
    readonly argumentTypes: readonly KnownType[];
}

export interface ValidatorOptions {
    events: readonly EventRegistration[];
    isLegalParameterType(type: KnownType): boolean;
}

export default class Validator extends DiagnosticsMixin {
    private validatedSet = new WeakSet<AnyNode>();

    constructor(private readonly typechecker: Typechecker, private readonly options: ValidatorOptions) {
        super();
    }

    validate(ast: Program) {
        if (this.testSetValidated(ast)) {
            return;
        }
        const scope = this.typechecker.binder.getScope(ast);
        for (const duplicate of scope.duplicateBindings) {
            const ident = getVariableDefinitionIdentifier(duplicate);
            this.focus(ident);
            if (duplicate.kind === ASTNodeKind.TypeDefinition) {
                if (scope.get(ident.name)!.kind === ASTNodeKind.TypeDefinition) {
                    this.error(DiagnosticCodes.TypeDefinedMultipleTimes, ident.name);
                }
                else {
                    this.error(DiagnosticCodes.TypeNameAlreadyDefinedAsVariable, ident.name);
                }
            }
            else {
                this.error(DiagnosticCodes.VariableDefinedMultipleTimes, ident.name);
            }
        }

        const requiredEventNames = new Set(this.options.events.filter(x => x.required).map(x => x.name));
        const registeredListenerEventNames = new Set<string>();
        for (const child of ast.definitions) {
            switch (child.kind) {
                case ASTNodeKind.ParameterDefinition:
                    this.validateParameterDefinition(child);
                    break;
                case ASTNodeKind.StateDefinition:
                    this.validateStateDefinition(child);
                    break;
                case ASTNodeKind.TypeDefinition:
                    this.validateTypeDefinition(child);
                    break;
                case ASTNodeKind.ListenerDefinition:
                    requiredEventNames.delete(child.event);
                    if (registeredListenerEventNames.has(child.event)) {
                        this.focus(child);
                        this.error(DiagnosticCodes.ListenerDefinedMultipleTimes, child.event);
                    }
                    else {
                        registeredListenerEventNames.add(child.event);
                    }
                    this.validateListenerDefinition(child);
                    break;
            }
        }

        for (const eventName of requiredEventNames) {
            this.focus(ast);
            this.error(DiagnosticCodes.MissingRequiredListener, eventName);
        }
    }

    private validateParameterDefinition(ast: ParameterDefinition) {
        if (this.testSetValidated(ast)) {
            return;
        }
        
        this.focus(ast.type);
        const type = this.typechecker.fetchTypeOfTypeNode(ast.type);
        if (!this.options.isLegalParameterType(type)) {
            this.focus(ast);
            this.error(DiagnosticCodes.InvalidParameterType, type);
        }
    }

    private validateStateDefinition(ast: StateDefinition) {
        if (this.testSetValidated(ast)) {
            return;
        }

        const type = ast.type ? this.typechecker.fetchTypeOfTypeNode(ast.type) : undefined;
        
        if (ast.default) {
            this.validateTypesMatch(type, ast.default);
        }

        const stateType = this.typechecker.fetchVariableDefinitionType(ast);
        if (!this.checkSerializable(stateType)) {
            this.focus(ast.type ?? ast.default ?? ast);
            this.error(DiagnosticCodes.StateNotSerializable, stateType);
        }
    }

    private validateTypesMatch(targetType: KnownType | undefined, valueAst: Expression) {
        const valueType = this.typechecker.fetchType(valueAst);
        if (targetType) {
            if (!this.typechecker.fitsInType(valueType, targetType)) {
                this.focus(valueAst);
                this.error(DiagnosticCodes.AssignmentTypeMismatch, valueType, targetType);
            }
        }
    }

    checkSerializable(type: KnownType) {
        const visited = new Set<string>();
        const rec = (type: KnownType): boolean => {
            switch (type.kind) {
                case TypeKind.Function:
                case TypeKind.TypeVariable:
                    return false;
                case TypeKind.Toxic:
                    return true;
                case TypeKind.Simple: {
                    const typeInfo = this.typechecker.fetchTypeInfoFromSimpleType(type)!;
                    if (typeInfo.attributes.some(x => x.kind === TypeAttributeKind.IsUserDefined)) {
                        if (visited.has(type.name)) {
                            return true;
                        }
                        visited.add(type.name);
                        return Object.values(typeInfo.members).every(rec);
                    }
                    if (type.name === 'unit') {
                        // Unit is a special case not serializable.
                        return false;
                    }
                    return type.typeArguments.every(rec);
                }
            }
        };
        return rec(type);
    }

    private validateTypeDefinition(ast: TypeDefinition) {
        // Validation should have already been done by typechecker
    }

    private validateListenerDefinition(ast: ListenerDefinition) {
        if (this.testSetValidated(ast)) {
            return;
        }

        const event = this.options.events.find(evt => evt.name === ast.event);
        if (!event) {
            this.focus(ast);
            this.error(DiagnosticCodes.UnknownEvent, ast.event);
        }

        ast.parameters.forEach((param, i) => {
            const paramType = this.validateParameter(param);
            if (event) {
                if (i < event.argumentTypes.length) {
                    const argumentType = event.argumentTypes[i];
                    if (!this.typechecker.fitsInType(argumentType, paramType)) {
                        this.focus(param.type);
                        this.error(DiagnosticCodes.ListenerParameterTypeMismatch, paramType, argumentType);
                    }
                }
                else if (i === event.argumentTypes.length) {
                    this.focus(param);
                    this.error(DiagnosticCodes.TooManyListenerParameters, ast.event);
                }
            }
        });
        this.validateBlock(ast.body);
    }

    private validateBlock(ast: Block) {
        if (this.testSetValidated(ast)) {
            return;
        }
        for (const duplicate of this.typechecker.binder.getScope(ast).duplicateBindings) {
            const ident = getVariableDefinitionIdentifier(duplicate);
            this.focus(ident);
            this.error(DiagnosticCodes.VariableDefinedMultipleTimes, ident.name);
        }
        ast.statements.forEach(this.validateStatementOrBlock);
    }

    @boundMethod
    private validateStatementOrBlock(ast: StatementOrBlock) {
        if (this.testSetValidated(ast)) {
            return;
        }
        switch (ast.kind) {
            default: expectNever(ast);
            case ASTNodeKind.Block:
                return this.validateBlock(ast);
            case ASTNodeKind.LetStatement:
                return this.validateLetStatement(ast);
            case ASTNodeKind.IfElseChain:
                return this.validateIfElseChain(ast);
            case ASTNodeKind.ExpressionStatement:
                return this.typechecker.fetchType(ast.expr);
            case ASTNodeKind.AssignVar:
                return this.validateAssignVar(ast);
            case ASTNodeKind.AssignField:
                return this.validateAssignField(ast);
            case ASTNodeKind.DebugStatement:
                return ast.arguments.forEach(this.typechecker.fetchType);
        }
    }

    private validateLetStatement(ast: LetStatement) {
        const type = ast.type ? this.typechecker.fetchTypeOfTypeNode(ast.type) : undefined;
        
        if (ast.value) {
            this.validateTypesMatch(type, ast.value);
        }
    }

    private validateIfElseChain(ast: IfElseChain) {
        ast.cases.forEach(x => {
            const conditionType = this.typechecker.fetchType(x.condition);

            if (conditionType.kind !== TypeKind.Simple ||
                !this.typechecker
                    .fetchTypeInfoFromSimpleType(conditionType)
                    ?.attributes
                    .some(x => x.kind === TypeAttributeKind.IsLegalCondition)
            ) {
                this.focus(x.condition);
                this.error(DiagnosticCodes.TypeCannotBeUsedAsACondition, conditionType);
            }

            if (x.deconstruct) {
                this.typechecker.fetchTypeFromIdentifier(x.deconstruct);
            }
            this.validateBlock(x.body);
        });
        if (ast.else) {
            this.validateBlock(ast.else);
        }
    }

    private validateAssignVar(ast: AssignVar) {
        const varDef = this.typechecker.binder.getVariableDefinition(ast.variable);
        if (!varDef) {
            this.focus(ast.variable);
            this.error(DiagnosticCodes.UnknownIdentifier, ast.variable.name);
            return;
        }

        if (varDef.kind === ASTNodeKind.ParameterDefinition || varDef.kind === ASTNodeKind.OutOfTree) {
            this.focus(ast.variable);
            this.error(DiagnosticCodes.CannotAssignToReadonlyVariable, ast.variable.name);
        }
        else if (varDef.kind === ASTNodeKind.LetStatement) {
            const block = this.typechecker.binder.getParent(varDef);
            const defPos = this.typechecker.binder.getPositionInParent(varDef, block);
            const varPos = this.typechecker.binder.getStatementPositionInBlock(ast, block);
            if (varPos === undefined || varPos <= defPos) {
                this.focus(ast.variable);
                this.error(DiagnosticCodes.NotYetDefined, ast.variable.name);
            }
        }
        const varType = this.typechecker.fetchVariableDefinitionType(varDef);
        this.validateTypesMatch(varType, ast.value);
    }

    private validateAssignField(ast: AssignField) {
        if (ast.member === DUMMY_IDENTIFIER) {
            // Already raised AssignToExpression diagnostics
            return;
        }

        const objType = this.typechecker.fetchType(ast.obj);
        if (objType && objType.kind === TypeKind.Simple) {
            const objTypeInfo = this.typechecker.fetchTypeInfoFromSimpleType(objType);
            if (objTypeInfo?.attributes.some(x => x.kind === TypeAttributeKind.IsUserDefined) === false) {
                this.focus(ast.member);
                this.error(DiagnosticCodes.CannotAssignToReadonlyField, ast.member.name, objType);
            }
        }
        const memberType = this.typechecker.fetchTypeFromIdentifier(ast.member);
        this.validateTypesMatch(memberType, ast.value);
    }

    @boundMethod
    private validateParameter(ast: Parameter) {
        return this.typechecker.fetchTypeOfTypeNode(ast.type);
    }

    private testSetValidated(node: AnyNode) {
        // if (this.validatedSet.has(node)) {
        //     return true;
        // }
        // this.validatedSet.add(node);
        return false;
    }
}