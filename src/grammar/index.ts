import { MiKeVisitor } from './generated/MiKeVisitor';
import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor'
import { untypedExprNode, makeBinaryOpNode_, makeInvokeNode_, makeIntLiteralNode_, makeFloatLiteralNode_, makeBoolLiteralNode_, makeDereferenceNode_, makeVariableNode_, makeSequenceLiteralNode_, makeMapLiteralNode_ } from '../ast/Ast.gen';
import { AddsubContext, DerefContext, FalseLiteralContext, FloatLiteralContext, IntLiteralContext, InvokeContext, MapLiteralContext, MiKeParser, MuldivContext, SeqLiteralContext, StringLiteralContext, TrueLiteralContext, VariableRefContext, WrappedExprContext } from './generated/MiKeParser';
import { CharStreams, CommonTokenStream, ParserRuleContext, RecognitionException } from 'antlr4ts';
import { MiKeLexer } from './generated/MiKeLexer';

abstract class AbstractMiKeVisitor<T> extends AbstractParseTreeVisitor<T> implements MiKeVisitor<T> {};
interface AbstractMiKeVisitor<T> extends MiKeVisitor<T> {};

class ExprAstGenVisitor extends AbstractMiKeVisitor<untypedExprNode> {

    override visitAddsub(ctx: AddsubContext): untypedExprNode {
        return makeBinaryOpNode_(
            ctx.PLUS() ? 'Add' : 'Subtract',
            ctx._left.accept(this),
            ctx._right.accept(this)
        );
    }

    override visitMuldiv(ctx: MuldivContext): untypedExprNode {
        return makeBinaryOpNode_(
            ctx.STAR() ? 'Multiply' : 'Divide',
            ctx._left.accept(this),
            ctx._right.accept(this)
        );
    }

    override visitInvoke(ctx: InvokeContext): untypedExprNode {
        const args = ctx.argumentList()?.expression();
        if (args) {
            return makeInvokeNode_(
                ctx.derefPrec().accept(this),
                args.map(x => x.accept(this))
            );
        }
        return ctx.derefPrec().accept(this);
    }

    override visitIntLiteral(ctx: IntLiteralContext): untypedExprNode {
        return makeIntLiteralNode_(+ctx.INT() * (ctx.MINUS() ? -1 : 1));
    }

    override visitFloatLiteral(ctx: FloatLiteralContext): untypedExprNode {
        return makeFloatLiteralNode_(+ctx.FLOAT() * (ctx.MINUS() ? -1 : 1));
    }
    
    override visitTrueLiteral(ctx: TrueLiteralContext): untypedExprNode {
        return makeBoolLiteralNode_(true);
    }

    override visitFalseLiteral(ctx: FalseLiteralContext): untypedExprNode {
        return makeBoolLiteralNode_(false);
    }

    override visitDeref(ctx: DerefContext): untypedExprNode {
        return makeDereferenceNode_(
            ctx.derefPrec().accept(this),
            ctx.NAME().text
        );
    }

    override visitVariableRef(ctx: VariableRefContext): untypedExprNode {
        return makeVariableNode_(ctx.text);
    }

    override visitSeqLiteral(ctx: SeqLiteralContext): untypedExprNode {
        return makeSequenceLiteralNode_(ctx.expression().map(x => x.accept(this)));
    }

    override visitMapLiteral(ctx: MapLiteralContext): untypedExprNode {
        const pairs = ctx.mapLiteralPair();

        return makeMapLiteralNode_(
            pairs.map(x => x._key.accept(this)),
            pairs.map(x => x._value.accept(this))
        );
    }

    override visitStringLiteral(ctx: StringLiteralContext): untypedExprNode {
        throw new MiKeSyntaxError('', { context: ctx });
    }

    protected defaultResult(): untypedExprNode {
        return null!;
    }

    protected aggregateResult(aggregate: untypedExprNode, nextResult: untypedExprNode): untypedExprNode {
        return aggregate ?? nextResult;
    }

}

class MiKeSyntaxError extends Error {
    context?: ParserRuleContext;

    constructor(message: string, options?: {
        cause?: RecognitionException,
        context?: ParserRuleContext
    }) {
        super(message, options);
        this.name = 'MiKeSyntaxError';

        this.context = options?.context;
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

export function parseExpression(expr: string): untypedExprNode {
    const parser = getParser(expr);
    const tree = parser.expression();
    const visitor = new ExprAstGenVisitor();
    const ast = tree.accept(visitor);

    if (parser.currentToken.type !== MiKeParser.EOF) {
        throw new MiKeSyntaxError('Unexpected trailing input'); 
    }

    return ast;
}