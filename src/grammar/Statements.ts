import { MiKeVisitor } from './generated/MiKeVisitor';
import { BlockContext, DebugStatementContext, ExpressionStatementContext, FieldAssignmentStatementContext, IfStatementContext, LetStatementContext, TypeContext, VarAssignmentStatementContext } from './generated/MiKeParser';
import { ParserRuleContext } from 'antlr4ts';
import { AstMetadata, ASTNodeKind, Expression, Statement, Block, AnyNode } from '../ast/Ast';
import { DiagnosticCodes } from '../diagnostics/DiagnosticCodes';
import { ExactType, TypeKind } from '../types/TypeReference';
import { boundMethod } from 'autobind-decorator';
import { WithDiagnostics } from '../diagnostics/Mixin';
import Poison from '../diagnostics/Poison';
import { AbstractMiKeVisitor } from './Parser';

export class StatementAstGenVisitor extends WithDiagnostics('mike', AbstractMiKeVisitor<Statement<undefined>>) {

    constructor(private exprVisitor: MiKeVisitor<Expression<undefined>>) {
        super();
    }

    visitExpressionStatement(ctx: ExpressionStatementContext): Statement<undefined> {
        return {
            kind: ASTNodeKind.ExpressionStatement,
            metadata: this.getMetadata(ctx),
            expr: ctx.expression().accept(this.exprVisitor),
        };
    }

    visitLetStatement(ctx: LetStatementContext): Statement<undefined> {
        const varDef = ctx.varDef();
        const type = varDef.type();
        const expr = varDef.expression();
        if (!expr && !type) {
            this.fatal(DiagnosticCodes.LetIsEmpty, ctx);
        }
        return {
            kind: ASTNodeKind.DeclareVar,
            metadata: this.getMetadata(ctx),
            name: varDef.NAME().text,
            type: type ? this.resolveType(type) : undefined,
            value: expr?.accept(this.exprVisitor),
        };
    }

    visitVarAssignmentStatement(ctx: VarAssignmentStatementContext): Statement<undefined> {
        return {
            kind: ASTNodeKind.AssignVar,
            metadata: this.getMetadata(ctx),
            name: ctx.NAME().text,
            value: ctx.expression().accept(this.exprVisitor),
        }
    }

    visitFieldAssignmentStatement(ctx: FieldAssignmentStatementContext): Statement<undefined> {
        const [lhs, value] = ctx.expression().map(x => x.accept(this.exprVisitor));

        if (lhs.kind !== ASTNodeKind.Dereference) {
            this.fatal(DiagnosticCodes.AssignToExpression, lhs);
        }

        return {
            kind: ASTNodeKind.AssignField,
            metadata: this.getMetadata(ctx),
            memberName: lhs.memberName,
            obj: lhs.obj,
            value,
        }
    }

    visitIfStatement(ctx: IfStatementContext): Statement<undefined> {
        const elseCtx = ctx.block();
        return {
            kind: ASTNodeKind.IfElseChain,
            metadata: this.getMetadata(ctx),
            cases: ctx.ifCase().map(x => ({
                condition: x.expression().accept(this.exprVisitor),
                deconstructName: x.NAME()?.text,
                body: this.visitBlock(x.block()),
            } as const)),
            else: elseCtx ? this.visitBlock(elseCtx) : undefined,
        }
    }

    visitDebugStatement(ctx: DebugStatementContext): Statement<undefined> {
        return {
            kind: ASTNodeKind.DebugStatement,
            metadata: this.getMetadata(ctx),
            arguments: ctx.expression().map(x => x.accept(this.exprVisitor)),
        }
    }

    visitBlock(ctx: BlockContext): Block<undefined> {
        return {
            kind: ASTNodeKind.Block,
            metadata: this.getMetadata(ctx),
            statements: ctx.statement().map(x => x.accept(this)),
        }
    }

    protected aggregateResult(aggregate: Statement<undefined>, nextResult: Statement<undefined>): Statement<undefined> {
        return aggregate ?? nextResult;
    }
    
    protected defaultResult(): Statement<undefined> {
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

    private getMetadata(ctx: ParserRuleContext): AstMetadata {
        return {
            location: {
                start: { line: ctx.start.line, col: ctx.start.charPositionInLine },
                end: { line: ctx.stop!.line, col: ctx.stop!.charPositionInLine },
            }
        };
    }

    private fatal(code: DiagnosticCodes, ctx: ParserRuleContext | AnyNode<undefined>, ...args: (string | number)[]): never {
        this.nonfatal(code, ctx, ...args);
        throw new Poison();
    }

    private nonfatal(code: DiagnosticCodes, ctx: ParserRuleContext | AnyNode<undefined>, ...args: (string | number)[]): void {
        if (ctx instanceof ParserRuleContext) {
            this.diagnostics.focus(this.getMetadata(ctx).location);
        }
        else {
            this.diagnostics.focus(ctx);
        }
        this.diagnostics.report(code, ...args.map(x => {
            return x.toString();
        }));
    }
}