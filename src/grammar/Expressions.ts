import { MiKeVisitor } from './generated/MiKeVisitor';
import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor'
import { AddsubContext, DerefContext, FalseLiteralContext, FloatLiteralContext, IntLiteralContext, InvokeContext, MapLiteralContext, MiKeParser, MuldivContext, SeqLiteralContext, StringLiteralContext, TrueLiteralContext, VariableRefContext, WrappedExprContext } from './generated/MiKeParser';
import { CharStreams, CommonTokenStream, ParserRuleContext } from 'antlr4ts';
import { MiKeLexer } from './generated/MiKeLexer';
import { AstMetadata, ASTNodeKind, Expression, InfixOperator } from '../ast/Ast';
import { DiagnosticsReporter } from '../diagnostics/Diagnostics';
import { DiagnosticCodes } from '../diagnostics/DiagnosticCodes';

abstract class AbstractMiKeVisitor<T> extends AbstractParseTreeVisitor<T> implements MiKeVisitor<T> {};
interface AbstractMiKeVisitor<T> extends MiKeVisitor<T> {};

export class ExprAstGenVisitor extends AbstractMiKeVisitor<Expression<undefined>> {

    override visitAddsub(ctx: AddsubContext): Expression<undefined> {
        return {
            kind: ASTNodeKind.BinaryOp,
            type: undefined,
            metadata: this.getMetadata(ctx),
            op: ctx.PLUS() ? InfixOperator.Add : InfixOperator.Subtract,
            lhs: ctx._left.accept(this),
            rhs: ctx._right.accept(this),
        };
    }

    override visitMuldiv(ctx: MuldivContext): Expression<undefined> {
        return {
            kind: ASTNodeKind.BinaryOp,
            type: undefined,
            metadata: this.getMetadata(ctx),
            op: ctx.STAR() ? InfixOperator.Multiply : InfixOperator.Divide,
            lhs: ctx._left.accept(this),
            rhs: ctx._right.accept(this),
        };
    }

    override visitInvoke(ctx: InvokeContext): Expression<undefined> {
        const args = ctx.argumentList()?.expression();
        if (args) {
            return {
                kind: ASTNodeKind.Invoke,
                type: undefined,
            metadata: this.getMetadata(ctx),
                fn: ctx.derefPrec().accept(this),
                args: args.map(x => x.accept(this)),
            }
        }
        return ctx.derefPrec().accept(this);
    }

    override visitIntLiteral(ctx: IntLiteralContext): Expression<undefined> {
        return {
            kind: ASTNodeKind.IntLiteral,
            type: undefined,
            metadata: this.getMetadata(ctx),
            value: +ctx.INT() * (ctx.MINUS() ? -1 : 1),
        };
    }

    override visitFloatLiteral(ctx: FloatLiteralContext): Expression<undefined> {
        return {
            kind: ASTNodeKind.FloatLiteral,
            type: undefined,
            metadata: this.getMetadata(ctx),
            value: +ctx.FLOAT() * (ctx.MINUS() ? -1 : 1),
        };
    }
    
    override visitTrueLiteral(ctx: TrueLiteralContext): Expression<undefined> {
        return {
            kind: ASTNodeKind.BoolLiteral,
            type: undefined,
            metadata: this.getMetadata(ctx),
            value: true,
        };
    }

    override visitFalseLiteral(ctx: FalseLiteralContext): Expression<undefined> {
        return {
            kind: ASTNodeKind.BoolLiteral,
            type: undefined,
            metadata: this.getMetadata(ctx),
            value: false,
        };
    }

    override visitDeref(ctx: DerefContext): Expression<undefined> {
        return {
            kind: ASTNodeKind.Dereference,
            type: undefined,
            metadata: this.getMetadata(ctx),
            obj: ctx.derefPrec().accept(this),
            memberName: ctx.NAME().text,
        };
    }

    override visitVariableRef(ctx: VariableRefContext): Expression<undefined> {
        return {
            kind: ASTNodeKind.Variable,
            type: undefined,
            metadata: this.getMetadata(ctx),
            name: ctx.text,
        };
    }

    override visitSeqLiteral(ctx: SeqLiteralContext): Expression<undefined> {
        return {
            kind: ASTNodeKind.SequenceLiteral,
            type: undefined,
            metadata: this.getMetadata(ctx),
            typeName: ctx.NAME()?.text,
            elements: ctx.expression().map(x => x.accept(this)),
        };
    }

    override visitMapLiteral(ctx: MapLiteralContext): Expression<undefined> {
        const pairs = ctx.mapLiteralPair();

        return {
            kind: ASTNodeKind.MapLiteral,
            type: undefined,
            metadata: this.getMetadata(ctx),
            typeName: ctx.NAME()?.text,
            pairs: pairs.map(x => [x._key.accept(this), x._value.accept(this)] as const)
        };
    }

    override visitStringLiteral(ctx: StringLiteralContext): Expression<undefined> {
        return {
            kind: ASTNodeKind.StringLiteral,
            type: undefined,
            metadata: this.getMetadata(ctx),
            value: ctx.STRING().text
                .slice(1, -1)
                .replaceAll('\\"', '"')
                .replaceAll("\\'", "'")
                .replaceAll('\\\\', '\\')
                .replaceAll(/\r\n|\r|\n/g, '\n'),
        };
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
}

export function getParser(str: string, diagnostics: DiagnosticsReporter) {
    const charStream = CharStreams.fromString(str);
    const lexer = new MiKeLexer(charStream);

    lexer.removeErrorListeners();
    lexer.addErrorListener({
        syntaxError(recognizer, offendingSymbol, line, charPositionInLine, msg, e) {
            diagnostics.focus({
                start: { line, col: charPositionInLine },
                end: { line: line + 1, col: charPositionInLine + 1 }
            });
            diagnostics.report(DiagnosticCodes.GenericLexError, msg);
        },
    });

    const tokenStream = new CommonTokenStream(lexer);
    const parser = new MiKeParser(tokenStream);

    parser.removeErrorListeners();
    parser.addErrorListener({
        syntaxError(recognizer, offendingSymbol, line, charPositionInLine, msg, e) {
            diagnostics.focus({
                start: { line, col: charPositionInLine },
                end: { line: line + 1, col: charPositionInLine + 1 }
            });
            diagnostics.report(DiagnosticCodes.GenericParseError, msg);
        },
    });

    return parser;
}
