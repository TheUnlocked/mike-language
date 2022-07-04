import { AddsubContext, ComparisonContext, DerefContext, FalseLiteralContext, FloatLiteralContext, IntLiteralContext, InvokeContext, LogicalContext, MapLiteralContext, MuldivContext, SeqLiteralContext, StringLiteralContext, TrueLiteralContext, UnaryContext, VariableRefContext } from './generated/MiKeParser';
import { ParserRuleContext } from 'antlr4ts';
import { AnyNode, AstMetadata, ASTNodeKind, Expression, InfixOperator, PrefixOperator } from '../ast/Ast';
import { WithDiagnostics } from '../diagnostics/Mixin';
import { AbstractMiKeVisitor } from './Parser';
import { DiagnosticCodes } from '../diagnostics/DiagnosticCodes';
import Poison from '../diagnostics/Poison';

export class ExprAstGenVisitor extends WithDiagnostics('mike', AbstractMiKeVisitor<Expression<undefined>>) {

    private makeExprNode<T>(node: T): T & { type: undefined } {
        return { ...node, type: undefined };
    }

    override visitLogical(ctx: LogicalContext): Expression<undefined> {
        const op = ctx.AND_AND() ? InfixOperator.And : InfixOperator.Or;
        if (ctx._right instanceof LogicalContext &&
            (ctx._right.AND_AND() ? op !== InfixOperator.And : op !== InfixOperator.Or)
        ) {
            this.nonfatal(DiagnosticCodes.MixedAndOr, ctx);
        }
        return this.makeExprNode({
            kind: ASTNodeKind.BinaryOp,
            metadata: this.getMetadata(ctx),
            op,
            lhs: ctx._left.accept(this),
            rhs: ctx._right.accept(this),
        });
    }

    override visitComparison(ctx: ComparisonContext): Expression<undefined> {
        return this.makeExprNode({
            kind: ASTNodeKind.BinaryOp,
            metadata: this.getMetadata(ctx),
            op: ctx.EQUALS_EQUALS() ? InfixOperator.Equals
                : ctx.BANG_EQUALS() ? InfixOperator.NotEquals
                : ctx.LANGLE() ? InfixOperator.LessThan
                : ctx.RANGLE() ? InfixOperator.GreaterThan
                : ctx.LANGLE_EQUALS() ? InfixOperator.LessThanEqual
                : /* ctx.RANGLE_EQUALS() */ InfixOperator.GreaterThanEqual,
            lhs: ctx._left.accept(this),
            rhs: ctx._right.accept(this),
        });
    }

    override visitAddsub(ctx: AddsubContext): Expression<undefined> {
        return this.makeExprNode({
            kind: ASTNodeKind.BinaryOp,
            metadata: this.getMetadata(ctx),
            op: ctx.PLUS() ? InfixOperator.Add : InfixOperator.Subtract,
            lhs: ctx._left.accept(this),
            rhs: ctx._right.accept(this),
        });
    }

    override visitMuldiv(ctx: MuldivContext): Expression<undefined> {
        return this.makeExprNode({
            kind: ASTNodeKind.BinaryOp,
            metadata: this.getMetadata(ctx),
            op: ctx.STAR() ? InfixOperator.Multiply : InfixOperator.Divide,
            lhs: ctx._left.accept(this),
            rhs: ctx._right.accept(this),
        });
    }

    override visitUnary(ctx: UnaryContext): Expression<undefined> {
        return this.makeExprNode({
            kind: ASTNodeKind.UnaryOp,
            metadata: this.getMetadata(ctx),
            op: ctx.MINUS() ? PrefixOperator.Minus : PrefixOperator.Not,
            expr: ctx.unaryPrec().accept(this),
        });
    }

    override visitInvoke(ctx: InvokeContext): Expression<undefined> {
        const args = ctx.argumentList()?.expression();
        if (args) {
            return this.makeExprNode({
                kind: ASTNodeKind.Invoke,
                metadata: this.getMetadata(ctx),
                fn: ctx.derefPrec().accept(this),
                args: args.map(x => x.accept(this)),
            })
        }
        return ctx.derefPrec().accept(this);
    }

    override visitIntLiteral(ctx: IntLiteralContext): Expression<undefined> {
        return this.makeExprNode({
            kind: ASTNodeKind.IntLiteral,
            metadata: this.getMetadata(ctx),
            value: +ctx.INT(),
        });
    }

    override visitFloatLiteral(ctx: FloatLiteralContext): Expression<undefined> {
        return this.makeExprNode({
            kind: ASTNodeKind.FloatLiteral,
            metadata: this.getMetadata(ctx),
            value: +ctx.FLOAT(),
        });
    }
    
    override visitTrueLiteral(ctx: TrueLiteralContext): Expression<undefined> {
        return this.makeExprNode({
            kind: ASTNodeKind.BoolLiteral,
            metadata: this.getMetadata(ctx),
            value: true,
        });
    }

    override visitFalseLiteral(ctx: FalseLiteralContext): Expression<undefined> {
        return this.makeExprNode({
            kind: ASTNodeKind.BoolLiteral,
            metadata: this.getMetadata(ctx),
            value: false,
        });
    }

    override visitDeref(ctx: DerefContext): Expression<undefined> {
        return this.makeExprNode({
            kind: ASTNodeKind.Dereference,
            metadata: this.getMetadata(ctx),
            obj: ctx.derefPrec().accept(this),
            memberName: ctx.NAME().text,
        });
    }

    override visitVariableRef(ctx: VariableRefContext): Expression<undefined> {
        return this.makeExprNode({
            kind: ASTNodeKind.Variable,
            metadata: this.getMetadata(ctx),
            name: ctx.text,
        });
    }

    override visitSeqLiteral(ctx: SeqLiteralContext): Expression<undefined> {
        return this.makeExprNode({
            kind: ASTNodeKind.SequenceLiteral,
            metadata: this.getMetadata(ctx),
            typeName: ctx.NAME()?.text,
            elements: ctx.expression().map(x => x.accept(this)),
        });
    }

    override visitMapLiteral(ctx: MapLiteralContext): Expression<undefined> {
        const pairs = ctx.mapLiteralPair();

        return this.makeExprNode({
            kind: ASTNodeKind.MapLiteral,
            metadata: this.getMetadata(ctx),
            typeName: ctx.NAME()?.text,
            pairs: pairs.map(x => [x._key.accept(this), x._value.accept(this)] as const)
        });
    }

    override visitStringLiteral(ctx: StringLiteralContext): Expression<undefined> {
        return this.makeExprNode({
            kind: ASTNodeKind.StringLiteral,
            metadata: this.getMetadata(ctx),
            value: ctx.STRING().text
                .slice(1, -1)
                .replaceAll('\\"', '"')
                .replaceAll("\\'", "'")
                .replaceAll('\\\\', '\\')
                .replaceAll(/\r\n|\r|\n/g, '\n'),
        });
    }

    protected defaultResult(): Expression<undefined> {
        return null!;
    }

    protected aggregateResult(aggregate: Expression<undefined>, nextResult: Expression<undefined>): Expression<undefined> {
        return aggregate ?? nextResult;
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
