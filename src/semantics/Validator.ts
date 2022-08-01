import { boundMethod } from 'autobind-decorator';
import { AnyNode, AssignField, AssignVar, ASTNodeKind, Block, Expression, IfElseChain, LetStatement, ListenerDefinition, Parameter, ParameterDefinition, Program, StateDefinition, Statement, StatementOrBlock, Type, TypeDefinition } from '../ast/Ast';
import { DUMMY_IDENTIFIER, getVariableDefinitionIdentifier } from '../ast/AstUtils';
import { DiagnosticCodes } from '../diagnostics/DiagnosticCodes';
import { DiagnosticsMixin } from '../diagnostics/DiagnosticsMixin';
import { TypeAttributeKind } from '../types/Attribute';
import { KnownType, TypeKind } from '../types/KnownType';
import { Binder } from './Binder';
import { Typechecker } from './Typechecker';

export interface ValidatorOptions {
    isLegalParameterType(type: KnownType): boolean;
}

export default class Validator extends DiagnosticsMixin {
    private validatedSet = new WeakSet<AnyNode>();

    constructor(private binder: Binder, private typechecker: Typechecker, private options: ValidatorOptions) {
        super();
    }

    validate(ast: Program) {
        if (this.testSetValidated(ast)) {
            return;
        }
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
                    this.validateListenerDefinition(child);
                    break;
            }
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
        ast.parameters.forEach(this.validateParameter);
        this.validateBlock(ast.body);
    }

    private validateBlock(ast: Block) {
        if (this.testSetValidated(ast)) {
            return;
        }
        for (const duplicate of this.binder.getScope(ast).duplicateBindings) {
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
            default:
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
            this.typechecker.fetchType(x.condition);
            if (x.deconstruct) {
                this.typechecker.fetchSymbolType(x.deconstruct);
            }
            this.validateBlock(x.body);
        });
        if (ast.else) {
            this.validateBlock(ast.else);
        }
    }

    private validateAssignVar(ast: AssignVar) {
        const varType = this.typechecker.fetchSymbolType(ast.variable);
        this.validateTypesMatch(varType, ast.value);
    }

    private validateAssignField(ast: AssignField) {
        if (ast.member === DUMMY_IDENTIFIER) {
            // Already raised AssignToExpression diagnostics
            return;
        }

        const memberType = this.typechecker.fetchSymbolType(ast.member);
        this.validateTypesMatch(memberType, ast.value);
    }

    @boundMethod
    private validateParameter(ast: Parameter) {
        this.focus(ast);
        this.typechecker.fetchTypeOfTypeNode(ast.type);
    }

    private testSetValidated(node: AnyNode) {
        // if (this.validatedSet.has(node)) {
        //     return true;
        // }
        // this.validatedSet.add(node);
        return false;
    }
}