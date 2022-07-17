import { AddsubContext, ComparisonContext, DerefContext, FalseLiteralContext, FloatLiteralContext, IntLiteralContext, InvokeContext, LogicalContext, MapLiteralContext, MapLiteralPairContext, MuldivContext, SeqLiteralContext, StringLiteralContext, TrueLiteralContext, UnaryContext, VariableRefContext } from './generated/MiKeParser';
import { ParserRuleContext } from 'antlr4ts';
import { AnyNode, AstMetadata, ASTNodeKind, BinaryOp, Expression, InfixOperator, PairFragment, PrefixOperator } from '../ast/Ast';
import { WithDiagnostics } from '../diagnostics/Mixin';
import { AbstractMiKeVisitor } from './Parser';
import { DiagnosticCodes } from '../diagnostics/DiagnosticCodes';

export class ExprAstGenVisitor extends WithDiagnostics(AbstractMiKeVisitor<Expression>) {

    override visitLogical(ctx: LogicalContext): Expression {
        const op = ctx.AND_AND() ? InfixOperator.And : InfixOperator.Or;

        const node = {
            kind: ASTNodeKind.BinaryOp,
            metadata: this.getMetadata(ctx),
            op,
            lhs: ctx._left.accept(this),
            rhs: ctx._right.accept(this),
        } as BinaryOp;

        if (ctx._right instanceof LogicalContext &&
            (ctx._right.AND_AND() ? op !== InfixOperator.And : op !== InfixOperator.Or)
        ) {
            this.focus(node)
            this.error(DiagnosticCodes.MixedAndOr);
        }
        return node;
    }

    override visitComparison(ctx: ComparisonContext): Expression {
        return {
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
        };
    }

    override visitAddsub(ctx: AddsubContext): Expression {
        return {
            kind: ASTNodeKind.BinaryOp,
            metadata: this.getMetadata(ctx),
            op: ctx.PLUS() ? InfixOperator.Add : InfixOperator.Subtract,
            lhs: ctx._left.accept(this),
            rhs: ctx._right.accept(this),
        };
    }

    override visitMuldiv(ctx: MuldivContext): Expression {
        return {
            kind: ASTNodeKind.BinaryOp,
            metadata: this.getMetadata(ctx),
            op: ctx.STAR() ? InfixOperator.Multiply : InfixOperator.Divide,
            lhs: ctx._left.accept(this),
            rhs: ctx._right.accept(this),
        };
    }

    override visitUnary(ctx: UnaryContext): Expression {
        return {
            kind: ASTNodeKind.UnaryOp,
            metadata: this.getMetadata(ctx),
            op: ctx.MINUS() ? PrefixOperator.Minus : PrefixOperator.Not,
            expr: ctx.unaryPrec().accept(this),
        };
    }

    override visitInvoke(ctx: InvokeContext): Expression {
        const args = ctx.argumentList()?.expression();
        if (args) {
            return {
                kind: ASTNodeKind.Invoke,
                metadata: this.getMetadata(ctx),
                fn: ctx.derefPrec().accept(this),
                args: args.map(x => x.accept(this)),
            };
        }
        return ctx.derefPrec().accept(this);
    }

    override visitIntLiteral(ctx: IntLiteralContext): Expression {
        return {
            kind: ASTNodeKind.IntLiteral,
            metadata: this.getMetadata(ctx),
            value: +ctx.INT(),
        };
    }

    override visitFloatLiteral(ctx: FloatLiteralContext): Expression {
        return {
            kind: ASTNodeKind.FloatLiteral,
            metadata: this.getMetadata(ctx),
            value: +ctx.FLOAT(),
        };
    }
    
    override visitTrueLiteral(ctx: TrueLiteralContext): Expression {
        return {
            kind: ASTNodeKind.BoolLiteral,
            metadata: this.getMetadata(ctx),
            value: true,
        };
    }

    override visitFalseLiteral(ctx: FalseLiteralContext): Expression {
        return {
            kind: ASTNodeKind.BoolLiteral,
            metadata: this.getMetadata(ctx),
            value: false,
        };
    }

    override visitDeref(ctx: DerefContext): Expression {
        return {
            kind: ASTNodeKind.Dereference,
            metadata: this.getMetadata(ctx),
            obj: ctx.derefPrec().accept(this),
            memberName: ctx.NAME().text,
        };
    }

    override visitVariableRef(ctx: VariableRefContext): Expression {
        return {
            kind: ASTNodeKind.Variable,
            metadata: this.getMetadata(ctx),
            name: ctx.text,
        };
    }

    override visitSeqLiteral(ctx: SeqLiteralContext): Expression {
        return {
            kind: ASTNodeKind.SequenceLiteral,
            metadata: this.getMetadata(ctx),
            typeName: ctx.NAME()?.text,
            elements: ctx.expression().map(x => x.accept(this)),
        };
    }

    override visitMapLiteral(ctx: MapLiteralContext): Expression {
        return {
            kind: ASTNodeKind.MapLiteral,
            metadata: this.getMetadata(ctx),
            typeName: ctx.NAME()?.text,
            pairs: ctx.mapLiteralPair().map(this._visitPairFragment),
        };
    }

    private _visitPairFragment(ctx: MapLiteralPairContext): PairFragment {
        return {
            kind: ASTNodeKind.PairFragment,
            metadata: this.getMetadata(ctx),
            key: ctx._key.accept(this),
            value: ctx._value.accept(this),
        }
    }

    override visitStringLiteral(ctx: StringLiteralContext): Expression {
        return {
            kind: ASTNodeKind.StringLiteral,
            metadata: this.getMetadata(ctx),
            value: ctx.STRING().text
                .slice(1, -1)
                .replaceAll('\\"', '"')
                .replaceAll("\\'", "'")
                .replaceAll('\\\\', '\\')
                .replaceAll(/\r\n|\r|\n/g, '\n'),
        };
    }

    protected override defaultResult(): Expression {
        return null!;
    }

    protected override aggregateResult(aggregate: Expression, nextResult: Expression): Expression {
        return aggregate ?? nextResult;
    }

    private getMetadata(ctx: ParserRuleContext): AstMetadata {
        return {
            extent: {
                start: { line: ctx.start.line, col: ctx.start.charPositionInLine },
                end: { line: ctx.stop!.line, col: ctx.stop!.charPositionInLine },
            }
        };
    }
}
