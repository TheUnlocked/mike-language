import { MiKeVisitor } from './generated/MiKeVisitor';
import { EventDeclContext, ParamDeclContext, ParamListContext, ProgramContext, StateDeclContext, TypeContext, TypeDefContext } from './generated/MiKeParser';
import { ParserRuleContext } from 'antlr4ts';
import { AstMetadata, Expression, ListenerDefinition, Statement, AnyNode, ASTNodeKind, ParamDefinition, StateDefinition, TypeDefinition, Block } from '../ast/Ast';
import { ExactType, TypeKind } from '../types/TypeReference';
import { boundMethod } from 'autobind-decorator';
import { WithDiagnostics } from '../diagnostics/Mixin';
import { AbstractMiKeVisitor } from './Parser';

export class ProgramAstGenVisitor extends WithDiagnostics(AbstractMiKeVisitor<AnyNode<undefined>>) {

    constructor(
        private exprVisitor: MiKeVisitor<Expression<undefined>>,
        private statementVisitor: MiKeVisitor<Statement<undefined>>,
    ) {
        super();
    }

    override visitProgram(ctx: ProgramContext): AnyNode<undefined> {
        return {
            kind: ASTNodeKind.Program,
            metadata: this.getMetadata(ctx),
            listeners: ctx.eventDecl().map(this.visitEventDecl),
            params: ctx.paramDecl().map(this.visitParamDecl),
            state: ctx.stateDecl().map(this.visitStateDecl),
            types: ctx.typeDef().map(this.visitTypeDef),
        };
    }

    @boundMethod
    override visitEventDecl(ctx: EventDeclContext): ListenerDefinition<undefined> {
        return {
            kind: ASTNodeKind.ListenerDefinition,
            metadata: this.getMetadata(ctx),
            event: ctx.NAME().text,
            parameters: this.resolveParamList(ctx.paramList()),
            body: ctx.block().accept(this.statementVisitor) as Block<undefined>,
        };
    }

    @boundMethod
    override visitParamDecl(ctx: ParamDeclContext): ParamDefinition<undefined> {
        const paramDef = ctx.paramDef();
        return {
            kind: ASTNodeKind.ParamDefinition,
            metadata: this.getMetadata(ctx),
            name: paramDef.NAME().text,
            type: this.resolveType(paramDef.type()),
        };
    }

    @boundMethod
    override visitStateDecl(ctx: StateDeclContext): StateDefinition<undefined> {
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

    @boundMethod
    override visitTypeDef(ctx: TypeDefContext): TypeDefinition<undefined> {
        return {
            kind: ASTNodeKind.TypeDefinition,
            metadata: this.getMetadata(ctx),
            parameters: this.resolveParamList(ctx.paramList()),
        };
    }

    protected aggregateResult(aggregate: AnyNode<undefined>, nextResult: AnyNode<undefined>): AnyNode<undefined> {
        return aggregate ?? nextResult;
    }
    
    protected defaultResult(): AnyNode<undefined> {
        return null!;
    }

    @boundMethod
    private resolveType(ctx: TypeContext): ExactType {
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

    private resolveParamList(ctx: ParamListContext) {
        return ctx.paramDef().map(paramDef => ({
            name: paramDef.NAME().text,
            type: this.resolveType(paramDef.type()),
        }));
    }

    private getMetadata(ctx: ParserRuleContext): AstMetadata {
        return {
            location: {
                start: { line: ctx.start.line, col: ctx.start.charPositionInLine },
                end: { line: ctx.stop!.line, col: ctx.stop!.charPositionInLine },
            }
        };
    }
}