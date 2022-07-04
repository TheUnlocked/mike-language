import { MiKeVisitor } from './generated/MiKeVisitor';
import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor'
import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { MiKeLexer } from './generated/MiKeLexer';
import { DiagnosticsReporter } from '../diagnostics/Diagnostics';
import { DiagnosticCodes } from '../diagnostics/DiagnosticCodes';
import { MiKeParser } from './generated/MiKeParser';

export abstract class AbstractMiKeVisitor<T> extends AbstractParseTreeVisitor<T> implements MiKeVisitor<T> {};
export interface AbstractMiKeVisitor<T> extends MiKeVisitor<T> {};

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
