import { MiKeVisitor } from './generated/MiKeVisitor';
import { EventDeclContext, ParamDeclContext, ParamDefContext, StateDeclContext, TypeDefContext } from './generated/MiKeParser';
import { Expression, ListenerDefinition, ASTNodeKind, ParameterDefinition, StateDefinition, TypeDefinition, Block, Parameter, StatementOrBlock, TopLevelDefinition, Type } from '../ast/Ast';
import { WithDiagnostics } from '../diagnostics/Mixin';
import { AbstractMiKeVisitor } from './BaseVisitor';
import { boundMethod } from 'autobind-decorator';
import { DiagnosticCodes } from '../diagnostics/DiagnosticCodes';

export class TopLevelDefinitionAstGenVisitor extends WithDiagnostics(AbstractMiKeVisitor<TopLevelDefinition>) {

    constructor(
        private typeVisitor: MiKeVisitor<Type>,
        private exprVisitor: MiKeVisitor<Expression>,
        private statementVisitor: MiKeVisitor<StatementOrBlock>,
    ) {
        super();
    }

    override visitEventDecl(ctx: EventDeclContext): ListenerDefinition {
        return {
            kind: ASTNodeKind.ListenerDefinition,
            metadata: this.getMetadata(ctx),
            event: ctx.NAME().text,
            parameters: ctx.paramList().paramDef().map(this._visitParamDef),
            body: ctx.block().accept(this.statementVisitor) as Block,
        };
    }

    override visitParamDecl(ctx: ParamDeclContext): ParameterDefinition {
        const paramDef = ctx.paramDef();
        return {
            kind: ASTNodeKind.ParameterDefinition,
            metadata: this.getMetadata(ctx),
            name: this._visitIdentifier(paramDef.identifier()),
            type: paramDef.type().accept(this.typeVisitor),
        };
    }

    override visitStateDecl(ctx: StateDeclContext): StateDefinition {
        const varDef = ctx.varDef();
        const expr = varDef.expression()?.accept(this.exprVisitor);
        if (!expr) {
            this.error(DiagnosticCodes.NoStateInitialValue);
        }
        return {
            kind: ASTNodeKind.StateDefinition,
            metadata: this.getMetadata(ctx),
            name: this._visitIdentifier(varDef.identifier()),
            type: varDef.type()?.accept(this.typeVisitor),
            default: expr,
        };
    }

    override visitTypeDef(ctx: TypeDefContext): TypeDefinition {
        return {
            kind: ASTNodeKind.TypeDefinition,
            metadata: this.getMetadata(ctx),
            name: this._visitTypeIdentifier(ctx.typeIdentifier()),
            parameters: ctx.paramList().paramDef().map(this._visitParamDef),
        };
    }

    @boundMethod
    _visitParamDef(ctx: ParamDefContext): Parameter {
        return {
            kind: ASTNodeKind.Parameter,
            metadata: this.getMetadata(ctx),
            name: this._visitIdentifier(ctx.identifier()),
            type: ctx.type().accept(this.typeVisitor),
        }
    }
}