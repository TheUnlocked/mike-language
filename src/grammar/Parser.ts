import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { MiKeLexer } from './generated/MiKeLexer';
import { DiagnosticsReporter } from '../diagnostics/Diagnostics';
import { DiagnosticCodes } from '../diagnostics/DiagnosticCodes';
import { MiKeParser } from './generated/MiKeParser';
import { ASTNodeKind, Program } from '../ast/Ast';
import { ExprAstGenVisitor } from './Expressions';
import { StatementAstGenVisitor } from './Statements';
import { TopLevelDefinitionAstGenVisitor } from './TopLevelDefinitions';
import { CommentsAstGenVisitor } from './Comments';
import { TypeAstGenVisitor } from './Types';
import { AstUtils } from '../ast/AstUtils';

export function getLexer(str: string, diagnostics: DiagnosticsReporter) {
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

    return lexer;
}

export function getParser(lexer: MiKeLexer, diagnostics: DiagnosticsReporter) {
    lexer.reset();
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

export function getCommentParser(lexer: MiKeLexer): MiKeParser {
    lexer.reset();
    const tokenStream = new CommonTokenStream(lexer, 2);
    const parser = new MiKeParser(tokenStream);

    return parser;
}

export function parseMiKe(source: string, diagnostics: DiagnosticsReporter): Program {
    const lexer = getLexer(source, diagnostics);
    const parser = getParser(lexer, diagnostics);
    
    const typeVisitor = new TypeAstGenVisitor();
    const exprVisitor = new ExprAstGenVisitor();
    exprVisitor.setDiagnostics(diagnostics);
    const statementVisitor = new StatementAstGenVisitor(typeVisitor, exprVisitor);
    statementVisitor.setDiagnostics(diagnostics);
    const topLevelDefinitionVisitor = new TopLevelDefinitionAstGenVisitor(typeVisitor, exprVisitor, statementVisitor);
    topLevelDefinitionVisitor.setDiagnostics(diagnostics);
    const definitions = parser.program().topLevelDecl().map(x => x.accept(topLevelDefinitionVisitor));

    const commentParser = getCommentParser(lexer);
    const comments = commentParser.comments().accept(new CommentsAstGenVisitor());

    return {
        kind: ASTNodeKind.Program,
        metadata: {
            extent: {
                start: { line: 1, col: 0 },
                end: AstUtils.getLastPosition(source)
            }
        },
        definitions,
        comments,
    };
}