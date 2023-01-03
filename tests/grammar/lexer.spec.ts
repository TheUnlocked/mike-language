import { StringLexer, TokenType } from '../../src/parser/lexer';
import { expect } from 'chai';
import { createMiKeDiagnosticsManager } from '../../src/diagnostics';


const SINGLE_TOKEN_TEST_CASES = [
    ['   ', TokenType.TRIVIA_WHITESPACE],
    ['\n', TokenType.TRIVIA_NEWLINE],
    ['// abc', TokenType.TRIVIA_COMMENT],
    ['abc', TokenType.LIT_IDENT],
    ['abc1', TokenType.LIT_IDENT],
    ['1abc', TokenType.LIT_IDENT, true],
    ['12', TokenType.LIT_INT],
    ['1e10', TokenType.LIT_FLOAT],
    ['1e+10', TokenType.LIT_FLOAT],
    ['.1e+10', TokenType.LIT_FLOAT],
    ['.1', TokenType.LIT_FLOAT],
    ['1.', TokenType.LIT_FLOAT],
    ['1.0e-4', TokenType.LIT_FLOAT],
    [`""`, TokenType.LIT_STRING],
    [`''`, TokenType.LIT_STRING],
    [`"abc"`, TokenType.LIT_STRING],
    [`"\\'"`, TokenType.LIT_STRING],
    [`"\\""`, TokenType.LIT_STRING],
    [`'\\''`, TokenType.LIT_STRING],
    [`'\\"'`, TokenType.LIT_STRING],
    ['<', TokenType.OP_LT],
    ['>', TokenType.OP_GT],
    ['<=', TokenType.OP_LE],
    ['>=', TokenType.OP_GE],
    ['==', TokenType.OP_EQ],
    ['!=', TokenType.OP_NEQ],
    ['&&', TokenType.OP_AND],
    ['||', TokenType.OP_OR],
    ['+', TokenType.OP_ADD],
    ['-', TokenType.OP_SUB],
    ['*', TokenType.OP_MUL],
    ['/', TokenType.OP_DIV],
    ['!', TokenType.OP_NOT],
    [':', TokenType.SYNTAX_COLON],
    ['=', TokenType.SYNTAX_EQUAL],
    [';', TokenType.SYNTAX_SEMI],
    [',', TokenType.SYNTAX_COMMA],
    ['.', TokenType.SYNTAX_DOT],
    ['(', TokenType.SYNTAX_LPAREN],
    [')', TokenType.SYNTAX_RPAREN],
    ['[', TokenType.SYNTAX_LSQUARE],
    [']', TokenType.SYNTAX_RSQUARE],
    ['|', TokenType.SYNTAX_PIPE],
    ['=>', TokenType.SYNTAX_ARROW],
    ['param', TokenType.KW_PARAM],
    ['state', TokenType.KW_STATE],
    ['type', TokenType.KW_TYPE],
    ['on', TokenType.KW_ON],
    ['let', TokenType.KW_LET],
    ['debug', TokenType.KW_DEBUG],
    ['if', TokenType.KW_IF],
    ['else', TokenType.KW_ELSE],
    ['true', TokenType.KW_TRUE],
    ['false', TokenType.KW_FALSE],
    ['function', TokenType.KW_RESERVED],
    ['export', TokenType.KW_RESERVED],
    ['import', TokenType.KW_RESERVED],
    ['new', TokenType.KW_RESERVED],
    ['null', TokenType.KW_RESERVED],
    ['undefined', TokenType.KW_RESERVED],
    ['const', TokenType.KW_RESERVED],
    ['var', TokenType.KW_RESERVED],
    ['val', TokenType.KW_RESERVED],
] as [input: string, type: TokenType, expectFail?: boolean][];

function* parseTokens(input: string, expectFail?: boolean) {
    const diagnostics = createMiKeDiagnosticsManager();
    const lexer = new StringLexer(input);
    lexer.setDiagnostics(diagnostics.getReporter('mike'));
    while (!lexer.isComplete) {
        yield lexer.readToken();
        if (!expectFail) {
            expect(diagnostics.getDiagnostics()).has.length(0, diagnostics.getDiagnostics().map(x => x.toString()).join('\n'));
        }
    }
    if (expectFail) {
        expect(diagnostics.getDiagnostics()).does.not.have.length(0);
    }
}

export default () => describe('lexer', () => {
    describe('single tokens', () => {
        for (const [str, tokenType, expectFail] of SINGLE_TOKEN_TEST_CASES) {
            it(`${TokenType[tokenType].padEnd(18)}\t${JSON.stringify(str)}`, () => {
                const tokens = [...parseTokens(str, expectFail)];
                expect(tokens).to.have.length(1);
                const { type, content } = tokens[0];
                expect(type).to.equal(tokenType);
                expect(content).to.equal(str);
            });
        }
    });
});