import { MiKeVisitor } from './generated/MiKeVisitor';
import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor'
import { untypedExprNode, makeBinaryOpNode_, makeInvokeNode_, makeIntLiteralNode_, makeFloatLiteralNode_, makeBoolLiteralNode_, makeDereferenceNode_, makeVariableNode_, makeSequenceLiteralNode_, makeMapLiteralNode_, makeStringLiteralNode_ } from '../ast/Ast.gen';
import { AddsubContext, DerefContext, ExpressionContext, FalseLiteralContext, FloatLiteralContext, IntLiteralContext, InvokeContext, MapLiteralContext, MiKeParser, MuldivContext, SeqLiteralContext, StringLiteralContext, TrueLiteralContext, VariableRefContext, WrappedExprContext } from './generated/MiKeParser';
import { CharStreams, CommonTokenStream, ParserRuleContext, RecognitionException } from 'antlr4ts';
import { MiKeLexer } from './generated/MiKeLexer';
import { DummyMetadataManager, IMetadataManager } from '../metadata/MetadataManager';
import { MiKeSyntaxError } from '../exception/Exception';

abstract class AbstractMiKeVisitor<T> extends AbstractParseTreeVisitor<T> implements MiKeVisitor<T> {};
interface AbstractMiKeVisitor<T> extends MiKeVisitor<T> {};

class ExprAstGenVisitor extends AbstractMiKeVisitor<untypedExprNode> {

    constructor(private metadata: IMetadataManager<ParserRuleContext> = new DummyMetadataManager()) {
        super();
    }

    override visitAddsub(ctx: AddsubContext): untypedExprNode {
        return this.metadata.withContext(ctx, () => makeBinaryOpNode_(
            ctx.PLUS() ? 'Add' : 'Subtract',
            ctx._left.accept(this),
            ctx._right.accept(this)
        ));
    }

    override visitMuldiv(ctx: MuldivContext): untypedExprNode {
        return this.metadata.withContext(ctx, () => makeBinaryOpNode_(
            ctx.STAR() ? 'Multiply' : 'Divide',
            ctx._left.accept(this),
            ctx._right.accept(this)
        ));
    }

    override visitInvoke(ctx: InvokeContext): untypedExprNode {
        const args = ctx.argumentList()?.expression();
        if (args) {
            return this.metadata.withContext(ctx, () => {
                return makeInvokeNode_(
                    ctx.derefPrec().accept(this),
                    args.map(x => x.accept(this))
                );
            });
        }
        return ctx.derefPrec().accept(this);
    }

    override visitIntLiteral(ctx: IntLiteralContext): untypedExprNode {
        return this.metadata.withContext(ctx, () =>
            makeIntLiteralNode_(+ctx.INT() * (ctx.MINUS() ? -1 : 1)));
    }

    override visitFloatLiteral(ctx: FloatLiteralContext): untypedExprNode {
        return this.metadata.withContext(ctx, () =>
            makeFloatLiteralNode_(+ctx.FLOAT() * (ctx.MINUS() ? -1 : 1)));
    }
    
    override visitTrueLiteral(ctx: TrueLiteralContext): untypedExprNode {
        return this.metadata.withContext(ctx, () =>
            makeBoolLiteralNode_(true));
    }

    override visitFalseLiteral(ctx: FalseLiteralContext): untypedExprNode {
        return this.metadata.withContext(ctx, () =>
            makeBoolLiteralNode_(false));
    }

    override visitDeref(ctx: DerefContext): untypedExprNode {
        return this.metadata.withContext(ctx, () =>
            makeDereferenceNode_(
                ctx.derefPrec().accept(this),
                ctx.NAME().text
            ));
    }

    override visitVariableRef(ctx: VariableRefContext): untypedExprNode {
        return this.metadata.withContext(ctx, () =>
            makeVariableNode_(ctx.text));
    }

    override visitSeqLiteral(ctx: SeqLiteralContext): untypedExprNode {
        return this.metadata.withContext(ctx, () =>
            makeSequenceLiteralNode_(
                ctx.NAME()?.text,
                ctx.expression().map(x => x.accept(this))
            ));
    }

    override visitMapLiteral(ctx: MapLiteralContext): untypedExprNode {
        return this.metadata.withContext(ctx, () => {
            const pairs = ctx.mapLiteralPair();
    
            return makeMapLiteralNode_(
                ctx.NAME()?.text,
                pairs.map(x => x._key.accept(this)),
                pairs.map(x => x._value.accept(this))
            );
        });
    }

    override visitStringLiteral(ctx: StringLiteralContext): untypedExprNode {
        return this.metadata.withContext(ctx, () =>
            makeStringLiteralNode_(
                ctx.STRING().text
                    .slice(1, -1)
                    .replaceAll('\\"', '"')
                    .replaceAll("\\'", "'")
                    .replaceAll('\\\\', '\\')
                    .replaceAll(/\r\n|\r|\n/g, '\n')
            ));
    }

    protected defaultResult(): untypedExprNode {
        return null!;
    }

    protected aggregateResult(aggregate: untypedExprNode, nextResult: untypedExprNode): untypedExprNode {
        return aggregate ?? nextResult;
    }

}

function getParser(str: string) {
    const charStream = CharStreams.fromString(str);
    const lexer = new MiKeLexer(charStream);

    lexer.removeErrorListeners();
    lexer.addErrorListener({
        syntaxError(recognizer, offendingSymbol, line, charPositionInLine, msg, e) {
            throw new MiKeSyntaxError(e?.message ?? '', { cause: e });
        },
    });

    const tokenStream = new CommonTokenStream(lexer);
    const parser = new MiKeParser(tokenStream);

    parser.removeErrorListeners();
    parser.addErrorListener({
        syntaxError(recognizer, offendingSymbol, line, charPositionInLine, msg, e) {
            throw new MiKeSyntaxError(e?.message ?? '', { cause: e });
        },
    });

    return parser;
}

export function parseExpression(expr: string | ExpressionContext, options?: { metadata?: IMetadataManager<ParserRuleContext> }): untypedExprNode {
    if (typeof expr === 'string') {
        const parser = getParser(expr);
        const tree = parser.expression();
        const ast = tree.accept(new ExprAstGenVisitor(options?.metadata));

        if (parser.currentToken.type !== MiKeParser.EOF) {
            throw new MiKeSyntaxError('Unexpected trailing input'); 
        }

        return ast;
    }
    else {
        return expr.accept(new ExprAstGenVisitor(options?.metadata));
    }
}