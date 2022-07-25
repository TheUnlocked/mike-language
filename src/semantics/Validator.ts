import { boundMethod } from 'autobind-decorator';
import { AnyNode, AssignField, AssignVar, ASTNodeKind, Block, IfElseChain, LetStatement, ListenerDefinition, Parameter, ParameterDefinition, Program, StateDefinition, Statement, StatementOrBlock, Type, TypeDefinition } from '../ast/Ast';
import { getVariableDefinitionIdentifier } from '../ast/AstUtils';
import { DiagnosticCodes } from '../diagnostics/DiagnosticCodes';
import { WithDiagnostics } from '../diagnostics/Mixin';
import { TypeAttributeKind } from '../types/Attribute';
import { KnownType, TypeKind } from '../types/KnownType';
import { Binder } from './Binder';
import { Typechecker } from './Typechecker';

export interface ValidatorOptions {
    isLegalParameterType(type: KnownType): boolean;
}

export default class Validator extends WithDiagnostics(class {}) {
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
                    return this.validateParameterDefinition(child);
                case ASTNodeKind.StateDefinition:
                    return this.validateStateDefinition(child);
                case ASTNodeKind.TypeDefinition:
                    return this.validateTypeDefinition(child);
                case ASTNodeKind.ListenerDefinition:
                    return this.validateListenerDefinition(child);
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
        const defaultType = ast.default ? this.typechecker.fetchType(ast.default) : undefined;

        this.focus(ast.type);
        const type = ast.type ? this.typechecker.fetchTypeOfTypeNode(ast.type) : undefined;
        
        this.focus(ast.default);
        this.validateTypesMatch(type, defaultType);

        const stateType = type ?? defaultType!;
        if (!this.checkSerializable(stateType)) {
            this.focus(ast.type ?? ast.default ?? ast);
            this.error(DiagnosticCodes.StateNotSerializable, stateType);
        }
    }

    private validateTypesMatch(targetType: KnownType | undefined, valueType: KnownType | undefined) {
        if (!valueType && !targetType) {
            // Diagnostic already issued by parser
            return;
        }
        if (valueType && targetType && !this.typechecker.fitsInType(valueType, targetType)) {
            this.error(DiagnosticCodes.AssignmentTypeMismatch, valueType, targetType);
        }
    }

    checkSerializable(type: KnownType) {
        const visited = new Set<string>();
        const rec = (type: KnownType): boolean => {
            switch (type.kind) {
                case TypeKind.Function:
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
        const defaultType = ast.value ? this.typechecker.fetchType(ast.value) : undefined;

        this.focus(ast.type);
        const type = ast.type ? this.typechecker.fetchTypeOfTypeNode(ast.type) : undefined;
        
        this.focus(ast.value);
        this.validateTypesMatch(type, defaultType);
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
        const valueType = this.typechecker.fetchType(ast.value);
        this.focus(ast.value);
        this.validateTypesMatch(varType, valueType);
    }

    private validateAssignField(ast: AssignField) {
        const objType = this.typechecker.fetchType(ast.obj);
        this.focus(ast.member);
        switch (objType.kind) {
            case TypeKind.Function:
                this.error(DiagnosticCodes.InvalidMember, objType, ast.member.name);
                return;
            case TypeKind.Toxic:
                return;
        }
        const typeInfo = this.typechecker.fetchTypeInfoFromSimpleType(objType)!;
        if (!typeInfo.attributes.some(x => x.kind === TypeAttributeKind.IsUserDefined)) {
            this.error(DiagnosticCodes.InvalidMember, objType, ast.member.name);
            return;
        }
        const memberType = typeInfo.members[ast.member.name];
        if (!memberType) {
            this.error(DiagnosticCodes.InvalidMember, objType, ast.member.name);
            return;
        }
        const valueType = this.typechecker.fetchType(ast.value);
        this.focus(ast.value);
        this.validateTypesMatch(memberType, valueType);
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