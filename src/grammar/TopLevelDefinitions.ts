import { MiKeVisitor } from './generated/MiKeVisitor';
import { EventDeclContext, ParamDeclContext, ParamDefContext, ProgramContext, StateDeclContext, TypeContext, TypeDefContext } from './generated/MiKeParser';
import { ParserRuleContext } from 'antlr4ts';
import { AstMetadata, Expression, ListenerDefinition, AnyNode, ASTNodeKind, ParamDefinition, StateDefinition, TypeDefinition, Block, ParameterFragment, StatementOrBlock, TopLevelDefinition } from '../ast/Ast';
import { KnownType, TypeKind } from '../types/KnownType';
import { boundMethod } from 'autobind-decorator';
import { WithDiagnostics } from '../diagnostics/Mixin';
import { AbstractMiKeVisitor } from './Parser';

export class TopLevelDefinitionAstGenVisitor extends WithDiagnostics(AbstractMiKeVisitor<TopLevelDefinition>) {

    constructor(
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

    override visitParamDecl(ctx: ParamDeclContext): ParamDefinition {
        const paramDef = ctx.paramDef();
        return {
            kind: ASTNodeKind.ParamDefinition,
            metadata: this.getMetadata(ctx),
            name: paramDef.NAME().text,
            type: this.resolveType(paramDef.type()),
        };
    }

    override visitStateDecl(ctx: StateDeclContext): StateDefinition {
        const varDef = ctx.varDef();
        const typeCtx = varDef.type();
        return {
            kind: ASTNodeKind.StateDefinition,
            metadata: this.getMetadata(ctx),
            name: varDef.NAME().text,
            type: typeCtx ? this.resolveType(typeCtx) : undefined,
            default: varDef.expression()?.accept(this.exprVisitor),
        };
    }

    override visitTypeDef(ctx: TypeDefContext): TypeDefinition {
        return {
            kind: ASTNodeKind.TypeDefinition,
            metadata: this.getMetadata(ctx),
            parameters: ctx.paramList().paramDef().map(this._visitParamDef),
        };
    }

    _visitParamDef(ctx: ParamDefContext): ParameterFragment {
        return {
            kind: ASTNodeKind.ParameterFragment,
            metadata: this.getMetadata(ctx),
            name: ctx.NAME().text,
            type: this.resolveType(ctx.type()),
        }
    }
    
    protected defaultResult(): TopLevelDefinition {
        return null!;
    }

    @boundMethod
    private resolveType(ctx: TypeContext): KnownType {
        if (ctx.DOUBLE_ARROW()) {
            return {
                kind: TypeKind.Function,
                parameters: ctx.typeList()!.type().map(this.resolveType),
                returnType: this.resolveType(ctx.type()!),
            }
        }
        else {
            return {
                kind: TypeKind.Simple,
                name: ctx.NAME()!.text,
                typeArguments: ctx.typeArguments()?.type().map(this.resolveType) ?? [],
            }
        }
    }

    private getMetadata(ctx: ParserRuleContext): AstMetadata {
        const start = { line: ctx.start.line, col: ctx.start.charPositionInLine };
        const end = ctx.stop ? { line: ctx.stop!.line, col: ctx.stop!.charPositionInLine } : start;
        return {
            extent: { start, end }
        };
    }
}