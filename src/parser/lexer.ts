import { Range, isAfter, isAfterOrEquals, positionEquals } from '../ast';
import { BasicDiagnosticsReporter, DiagnosticCodes, DiagnosticDescription, DiagnosticsMixin, DiagnosticsReporter } from '../diagnostics';
import { AnyType } from '../types';
import { InterpolatedStringArgumentList } from '../utils';
import { TrackingReporter } from './TrackingReporter';
import { EditChain } from './EditChain';

export enum TokenType {
    TRIVIA_WHITESPACE = 0,
    TRIVIA_NEWLINE,
    TRIVIA_COMMENT,

    LIT_IDENT = 1000,
    LIT_INT,
    LIT_FLOAT,
    LIT_STRING,

    OP_LT = 2000,
    OP_GT,
    OP_LE,
    OP_GE,
    OP_EQ,
    OP_NEQ,
    OP_AND,
    OP_OR,
    OP_ADD,
    OP_SUB,
    OP_MUL,
    OP_DIV,
    OP_NOT,

    SYNTAX_COLON = 3000,
    SYNTAX_EQUAL,
    SYNTAX_SEMI,
    SYNTAX_COMMA,
    SYNTAX_DOT,
    SYNTAX_LPAREN,
    SYNTAX_RPAREN,
    SYNTAX_LBRACE,
    SYNTAX_RBRACE,
    SYNTAX_LSQUARE,
    SYNTAX_RSQUARE,
    SYNTAX_PIPE,
    SYNTAX_ARROW,

    KW_PARAM = 4000,
    KW_STATE,
    KW_TYPE,
    KW_ON,
    KW_LET,
    KW_DEBUG,
    KW_IF,
    KW_ELSE,
    KW_TRUE,
    KW_FALSE,
    KW_RESERVED = 4999,
}

export function isTrivia(token: Token) {
    return token.type >= 0 && token.type < 1000;
}

export function isLiteral(token: Token) {
    return token.type >= 1000 && token.type < 2000;
}

export function isOperator(token: Token) {
    return token.type >= 2000 && token.type < 3000;
}

export function isSyntax(token: Token) {
    return token.type >= 3000 && token.type < 4000;
}

export function isKeyword(token: Token) {
    return token.type >= 4000 && token.type < 5000;
}

export interface Mutation {
    /** The byte position after which (inclusive) tokens should shift their byte position */
    bytePos: number;
    /** The byte distance that should be shifted */
    byteOffset: number;
    
    /** The line number after which (inclusive) tokens should shift their line number */
    linePos: number;
    /** The number of lines that tokens should be shifted */
    lineOffset: number;
    /** The column distance that tokens on the specified line should be shifted */
    colOffset: number;
}

export interface Token {
    readonly _token: true;

    readonly type: TokenType;
    readonly content: string;

    /** The byte position of the first character in the token */
    readonly start: number;
    /** The byte position directly after the token */
    readonly end: number;
    
    /** The span from the first character to directly after the last character */
    readonly range: Range;

    /** @internal */
    _edits: EditChain<Mutation>;
}

enum CharType {
    WHITESPACE,
    NEWLINE,
    DIGIT,
    SQUOTE,
    DQUOTE,
    COLON,
    SEMI,
    COMMA,
    // ., .123
    DOT,
    // !, !=
    BANG,
    // |, ||
    PIPE,
    AMP,
    // +, +123
    PLUS,
    // -, -123
    MINUS,
    STAR,
    // /, //
    SLASH,
    // ==, =>
    EQUAL,
    // <, <=
    LANGLE,
    // >, >=
    RANGLE,
    LPAREN,
    RPAREN,
    LSQUARE,
    RSQUARE,
    LBRACE,
    RBRACE,
}

const CHAR_TABLE = Object.fromEntries(Object.entries({
    ' \r': CharType.WHITESPACE,
    '\n': CharType.NEWLINE,
    '0123456789': CharType.DIGIT,
    '\'': CharType.SQUOTE,
    '"': CharType.DQUOTE,
    ':': CharType.COLON,
    ';': CharType.SEMI,
    ',': CharType.COMMA,
    '.': CharType.DOT,
    '!': CharType.BANG,
    '|': CharType.PIPE,
    '&': CharType.AMP,
    '+': CharType.PLUS,
    '-': CharType.MINUS,
    '*': CharType.STAR,
    '/': CharType.SLASH,
    '=': CharType.EQUAL,
    '<': CharType.LANGLE,
    '>': CharType.RANGLE,
    '(': CharType.LPAREN,
    ')': CharType.RPAREN,
    '[': CharType.LSQUARE,
    ']': CharType.RSQUARE,
    '{': CharType.LBRACE,
    '}': CharType.RBRACE,
}).flatMap(([chars, type]) => chars.split('').map(c => [c, type])));

const KW_MAP = {
    'param': TokenType.KW_PARAM,
    'state': TokenType.KW_STATE,
    'type': TokenType.KW_TYPE,
    'on': TokenType.KW_ON,
    'let': TokenType.KW_LET,
    'debug': TokenType.KW_DEBUG,
    'if': TokenType.KW_IF,
    'else': TokenType.KW_ELSE,
    'true': TokenType.KW_TRUE,
    'false': TokenType.KW_FALSE,
    'function': TokenType.KW_RESERVED,
    'export': TokenType.KW_RESERVED,
    'import': TokenType.KW_RESERVED,
    'new': TokenType.KW_RESERVED,
    'null': TokenType.KW_RESERVED,
    'undefined': TokenType.KW_RESERVED,
    'const': TokenType.KW_RESERVED,
    'var': TokenType.KW_RESERVED,
    'val': TokenType.KW_RESERVED,
} as Record<string, TokenType>;

export interface ILexer extends DiagnosticsMixin {
    readonly isComplete: boolean;
    /**
     * Read the next token.
     * The caller is responsible for checking if the token stream is complete before calling this method.
     * @returns The next token in the stream
     */
    readToken(): Token;

    mutate(firstTokenIndex: number, numTokens: number, insert: string): {
        readonly insertedTokens: Token[],
        readonly removedTokens: Token[],
    };
}

function isIdentChar(c: string) {
    return c === undefined
        ? false
        : /[\p{Lu}\p{Ll}\p{Lt}\p{Lm}\p{Lo}\p{Nd}_]/u.test(c);
}

function countLines(str: string) {
    let ct = 0;
    for (let i = 0; i < str.length; i++) {
        if (str[i] === '\n') {
            ct++;
        }
    }
    return ct;
}

export class StringLexer extends DiagnosticsMixin implements ILexer {
    private tailPtr = 0;
    private headPtr = 0;
    private byteOffset: number;

    private startLine = 1;
    private startCol = 1;
    private line: number;
    private col: number;

    private edits: EditChain<Mutation>;

    private tokens: Token[] = [];

    constructor(private input: string, initialParams = {
        byteOffset: 0,
        line: 1,
        col: 1,
        edits: EditChain.createEditChain<Mutation>(),
    }) {
        super();
        this.byteOffset = initialParams.byteOffset;
        this.line = initialParams.line;
        this.col = initialParams.col;
        this.edits = initialParams.edits;
    }

    private _diagnostics = new TrackingReporter(this.diagnostics);

    override setDiagnostics(diagnostics: DiagnosticsReporter): void {
        this._diagnostics.setBaseReporter(diagnostics);
        this.diagnostics = this._diagnostics;
    }

    private peek() {
        return this.input[this.headPtr];
    }

    private token(type: TokenType): Token {
        const length = this.headPtr - this.tailPtr;
        let start = this.tailPtr + this.byteOffset;

        let startLine = this.startLine;
        let startCol = this.startCol;
        let endLine = this.line;
        let endCol = this.col;

        function applyEdit(mutation: Mutation) {
            if (start >= mutation.bytePos) {
                start += mutation.byteOffset;

                if (startLine >= mutation.linePos) {
                    if (startLine === mutation.linePos) {
                        // The token is on the affected line so the start column needs to be shifted
                        startCol += mutation.colOffset;
                        if (endLine === mutation.linePos) {
                            // The token is entirely on one line so both the start and end column need to be shifted
                            endCol += mutation.colOffset;
                        }
                    }
                    startLine += mutation.lineOffset;
                    endLine += mutation.lineOffset;
                }
            }
        }

        // Mutations can adjust the position, so we need to rectify it.
        // We use an EditChain to apply position updates lazily when properties are accessed.
        function commit() {
            token._edits = token._edits.apply(applyEdit);
        }

        const token: Token = {
            _token: true,
            type,
            content: this.input.slice(this.tailPtr, this.headPtr),

            get start() { commit(); return start; },
            get end() { commit(); return this.start + length; },

            get range() {
                commit();
                return {
                    start: { line: startLine, col: startCol },
                    end: { line: endLine, col: endCol },
                };
            },

            _edits: this.edits,
        };

        return token;
    }

    protected error<D extends DiagnosticCodes>(
        code: D,
        ...args: InterpolatedStringArgumentList<string | number | Token | AnyType, DiagnosticDescription<D>>
    ) {
        this.focus({
            start: { line: this.startLine, col: this.startCol },
            end: { line: this.line, col: this.col },
        });
        super.error(code, ...args);
    }

    private advance() {
        if (this.peek() === '\n') {
            this.line++;
            this.col = 1;
        }
        else {
            this.col++;
        }
        this.headPtr++;
    }

    private readDigitSequence() {
        for (; this.headPtr < this.input.length && CHAR_TABLE[this.peek()] === CharType.DIGIT; this.advance());
    }

    private tryReadDigitSequence() {
        if (CHAR_TABLE[this.peek()] === CharType.DIGIT) {
            this.advance();
            this.readDigitSequence();
            return 1;
        }
        return 0;
    }

    private tryReadDecimal() {
        if (this.peek() === '.') {
            this.advance();
            if (this.tryReadDigitSequence()) {
                this.tryReadExponential();
            }
            return 1;
        }
        return 0;
    }

    private tryReadExponential() {
        if ('eE'.includes(this.peek())) {
            this.advance();
            if ('+-'.includes(this.peek())) {
                this.advance();
            }
            if (!this.tryReadDigitSequence()) {
                this.error(DiagnosticCodes.InvalidNumberFormat);
            }
            return 1;
        }
        return 0;
    }

    private readUntilQuote(type: string) {
        for (; this.headPtr < this.input.length; this.advance()) {
            if (this.peek() === '\\') {
                this.advance();
            }
            else if (this.peek() === type) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    private readIdentifier() {
        for (; this.headPtr < this.input.length && isIdentChar(this.peek()); this.advance());
    }

    get isComplete() {
        return this.headPtr >= this.input.length;
    }

    readToken() {
        const token = this.readNextToken();
        this.tokens.push(token);
        return token;
    }

    readAllTokens() {
        while (!this.isComplete) {
            this.readToken();
        }
        return [...this.tokens];
    }

    private readNextToken() {
        this.tailPtr = this.headPtr;
        this.startLine = this.line;
        this.startCol = this.col;
        this.advance();

        const firstChar = this.input[this.tailPtr];

        switch (CHAR_TABLE[firstChar]) {
            case CharType.WHITESPACE:
                for (; this.headPtr < this.input.length; this.advance()) {
                    if (CHAR_TABLE[this.peek()] !== CharType.WHITESPACE) {
                        break;
                    }
                }
                return this.token(TokenType.TRIVIA_WHITESPACE);
            case CharType.NEWLINE:
                return this.token(TokenType.TRIVIA_NEWLINE);
            case CharType.DIGIT:
                this.readDigitSequence();
                // Intentional logical OR
                if (this.tryReadDecimal() || this.tryReadExponential()) {
                    // 123abc should lex into a single (invalid) token rather than two tokens
                    if (isIdentChar(this.peek())) {
                        this.readIdentifier();
                        this.error(DiagnosticCodes.IdentifierCannotStartWithDigit);
                        return this.token(TokenType.LIT_IDENT);
                    }
                    return this.token(TokenType.LIT_FLOAT);
                }
                if (isIdentChar(this.peek())) {
                    this.readIdentifier();
                    this.error(DiagnosticCodes.IdentifierCannotStartWithDigit);
                    return this.token(TokenType.LIT_IDENT);
                }
                return this.token(TokenType.LIT_INT);
            case CharType.DOT:
                if (this.tryReadDigitSequence()) {
                    this.tryReadExponential();
                    return this.token(TokenType.LIT_FLOAT);
                }
                else {
                    return this.token(TokenType.SYNTAX_DOT);
                }
            case CharType.SQUOTE:
                if (!this.readUntilQuote("'")) {
                    this.error(DiagnosticCodes.NoTrailingQuote);
                }
                return this.token(TokenType.LIT_STRING);
            case CharType.DQUOTE:
                if (!this.readUntilQuote('"')) {
                    this.error(DiagnosticCodes.NoTrailingQuote);
                }
                return this.token(TokenType.LIT_STRING);
            case CharType.COLON:
                return this.token(TokenType.SYNTAX_COLON);
            case CharType.SEMI:
                return this.token(TokenType.SYNTAX_SEMI);
            case CharType.COMMA:
                return this.token(TokenType.SYNTAX_COMMA);
            case CharType.BANG:
                if (this.peek() === '=') {
                    this.advance();
                    return this.token(TokenType.OP_NEQ);
                }
                else {
                    return this.token(TokenType.OP_NOT);
                }
            case CharType.PIPE:
                if (this.peek() === '|') {
                    this.advance();
                    return this.token(TokenType.OP_OR);
                }
                else {
                    return this.token(TokenType.SYNTAX_PIPE);
                }
            case CharType.AMP:
                if (this.peek() === '&') {
                    this.advance();
                }
                else {
                    this.error(DiagnosticCodes.SingleAmp);
                }
                return this.token(TokenType.OP_AND);
            case CharType.PLUS:
                return this.token(TokenType.OP_ADD);
            case CharType.MINUS:
                return this.token(TokenType.OP_SUB);
            case CharType.STAR:
                return this.token(TokenType.OP_MUL);
            case CharType.SLASH:
                if (this.peek() === '/') {
                    this.advance();
                    for (; this.headPtr < this.input.length; this.advance()) {
                        if (this.peek() === '\n') {
                            // Intentionally do not advance so that the newline is picked up as its own token
                            break;
                        }
                    }
                    return this.token(TokenType.TRIVIA_COMMENT);
                }
                else {
                    return this.token(TokenType.OP_DIV);
                }
            case CharType.EQUAL:
                switch (this.peek()) {
                    case '=':
                        this.advance();
                        return this.token(TokenType.OP_EQ);
                    case '>':
                        this.advance();
                        return this.token(TokenType.SYNTAX_ARROW);
                    default:
                        return this.token(TokenType.SYNTAX_EQUAL);
                }
            case CharType.LANGLE:
                if (this.peek() === '=') {
                    this.advance();
                    return this.token(TokenType.OP_LE);
                }
                else {
                    return this.token(TokenType.OP_LT);
                }
            case CharType.RANGLE:
                if (this.peek() === '=') {
                    this.advance();
                    return this.token(TokenType.OP_GE);
                }
                else {
                    return this.token(TokenType.OP_GT);
                }
            case CharType.LPAREN:
                return this.token(TokenType.SYNTAX_LPAREN);
            case CharType.RPAREN:
                return this.token(TokenType.SYNTAX_RPAREN);
            case CharType.LSQUARE:
                return this.token(TokenType.SYNTAX_LSQUARE);
            case CharType.RSQUARE:
                return this.token(TokenType.SYNTAX_RSQUARE);
            case CharType.LBRACE:
                return this.token(TokenType.SYNTAX_LBRACE);
            case CharType.RBRACE:
                return this.token(TokenType.SYNTAX_RBRACE);
            default:
                if (!isIdentChar(firstChar)) {
                    // invalid character -- consume all and emit it as whitespace trivia
                    while (CHAR_TABLE[this.peek()] === undefined) {
                        this.advance();
                    }
                    this.error(DiagnosticCodes.IllegalCharacter, this.input.slice(this.tailPtr, this.headPtr));
                    return this.token(TokenType.TRIVIA_WHITESPACE);
                }
                // ident or keyword
                this.readIdentifier();
                const content = this.input.slice(this.tailPtr, this.headPtr);
                return this.token(KW_MAP[content] ?? TokenType.LIT_IDENT);
        }
    }

    mutate(firstTokenIndex: number, numTokens: number, insert: string): {
        readonly insertedTokens: Token[],
        readonly removedTokens: Token[],
    } {
        // console.log(this.tokens.length, firstTokenIndex, numTokens);
        // console.log(this.tokens.slice(firstTokenIndex, numTokens + firstTokenIndex).map(x => x.content), insert);
        
        if (firstTokenIndex < 0) {
            numTokens += firstTokenIndex;
            firstTokenIndex = 0;
        }
        if (numTokens < 0) {
            numTokens = 0;
        }
        if (this.input === '') {
            // Special case for previously empty input
            this.input = insert;
            return {
                insertedTokens: this.readAllTokens(),
                removedTokens: [],
            };
        }
        if (this.tokens.length === 0) {
            // Special case for non-empty input but there are unread tokens (i.e. original lexing hasn't finished yet)
            const baseReporter = this._diagnostics.baseReporter;
            this.setDiagnostics(new BasicDiagnosticsReporter(() => {}));
            this.readAllTokens();
            this.setDiagnostics(baseReporter);
            return this.mutate(firstTokenIndex, numTokens, insert);
        }

        const oldReports = this._diagnostics.reports;
        this._diagnostics.clearReports();

        // Insert all our diagnostics from before the altered token
        for (const report of oldReports) {
            if (isAfter(report.range!.end, this.tokens[firstTokenIndex].range.start)) {
                break;
            }
            this.diagnostics.focus(report.range);
            this.diagnostics.report(...report.reportArgs);
        }

        // Even in the case of appending, we still need to re-lex the last token since it may have changed.

        /** The first token which is mutated/removed */
        const firstToken = this.tokens[firstTokenIndex] ?? this.tokens.at(-1);
        /** The last token which is mutated/removed */
        const lastToken = this.tokens[firstTokenIndex + numTokens] ?? this.tokens.at(-1);
        /** The start byte position of the first token which is mutated/removed */
        const removalStart = firstToken.start;
        /** The end byte position of the last token which is mutated/removed */
        const removalEnd = lastToken.end;
        /** The byte length of the span of tokens which are mutated/removed */
        const removalLength = removalEnd - removalStart;
        /** The change in byte length */
        const byteDelta = insert.length - removalLength;

        // using endLine is okay because lines are always terminanted with a newline token
        const linesRemoved = lastToken.range.end.line - firstToken.range.start.line;
        const linesAdded = countLines(insert);
        const lineDelta = linesAdded - linesRemoved;
        /** The column directly after the inserted content */
        const endColumn =
            lineDelta === 0
                // If the edit doesn't include any newlines, add the byte delta to the starting column 
                ? lastToken.range.end.col + byteDelta
                : insert.length - insert.lastIndexOf('\n') - 1;

        // Push onto the edit change so that tokens can update their position
        this.edits = this.edits.push({
            bytePos: removalStart + insert.length,
            byteOffset: byteDelta,

            // The line to change column numbers on is one off if the last token ends in a newline.
            linePos: lastToken.range.end.line - (lastToken.range.end.col === 1 ? 1 : 0),
            lineOffset: lineDelta,
            colOffset: endColumn - lastToken.range.end.col,
        });
        // console.log({ insert, linesAdded, linesRemoved, byteDelta, startCol: firstToken.startCol, endCol: lastToken.endCol })
        // console.log(this.edits.edit);

        // We also have to include the rest of the input after the removed area.
        // Example:
        //  Before: foo(1, 2);
        //  After:  foo("1, 2);
        // Only " was inserted but it changes how the rest of the input lexes.
        const subLexer = new StringLexer(
            insert + this.input.slice(removalEnd),
            {
                byteOffset: firstToken.start,
                line: firstToken.range.start.line,
                col: firstToken.range.start.col,
                edits: this.edits,
            },
        );
        subLexer.setDiagnostics(this.diagnostics);
        
        // We should only match the existing token if it appears after the tokens being removed
        let checkExistingTokenIndex = firstTokenIndex + numTokens;

        const matchesExistingToken = (token: Token) => {
            for (;; checkExistingTokenIndex++) {

                const existingToken = this.tokens[checkExistingTokenIndex];
                if (!existingToken || existingToken.start > token.start) {
                    return false;
                }

                // An existing token should be in the same position with the same type and same content.
                // Offsets aren't an issue because we already pushed to the edit chain.
                if (existingToken.type === token.type
                    && existingToken.start === token.start
                    && existingToken.content === token.content
                ) {
                    return true;
                }
            }
        };

        while (!subLexer.isComplete) {
            const token = subLexer.readToken();

            // If the new token matches an existing token exactly, we can stop there.
            if (matchesExistingToken(token)) {
                // Because this is definitely after the removed area,
                // if we match an existing token then it's safe to stop lexing
                // and reuse our previous work.

                // Slice off the existing token
                const insertedTokens = subLexer.tokens.slice(0, -1);

                const removedTokens = this.tokens.slice(firstTokenIndex, checkExistingTokenIndex);

                // Update local fields
                this.tokens.splice(firstTokenIndex, removedTokens.length, ...insertedTokens);
                this.input = this.input.slice(0, removalStart)
                    + insert
                    + this.input.slice(removedTokens.at(-1)!.end);

                // Add any diagnostics from the existing tokens
                for (const report of oldReports) {
                    if (isAfterOrEquals(report.range!.start, token.range.start)) {
                        this.diagnostics.focus(report.range);
                        this.diagnostics.report(...report.reportArgs);
                    }
                }

                return {
                    insertedTokens,
                    removedTokens,
                }
            }
        }

        // Did not find matching token

        const removedTokens = this.tokens.slice(firstTokenIndex);

        // Update local fields
        this.tokens.splice(firstTokenIndex, removedTokens.length, ...subLexer.tokens);
        this.input = this.input.slice(0, removalStart)
            + insert
            + this.input.slice(removedTokens.at(-1)!.end);
        
        return {
            insertedTokens: subLexer.tokens,
            removedTokens,
        }
    }
}
