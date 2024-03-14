import { AnyNode, ASTNodeKind, Block, DUMMY_IDENTIFIER, Expression, GenericType, getChildren, Identifier, IfCase, InfixOperator, Invoke, isAfter, ListenerDefinition, Pair, Parameter, ParameterDefinition, PrefixOperator, Program, StateDefinition, StatementOrBlock, TopLevelDefinition, Trivia, Type, TypeDefinition, TypeIdentifier, Variable } from '../ast';
import { DiagnosticCodes, DiagnosticsMixin, DiagnosticsReporter } from '../diagnostics';
import { Mutable } from '../utils';
import { hasFlag } from '../utils/flags';
import { TrackingReporter } from './TrackingReporter';
import { isTrivia, StringLexer, Token, TokenType } from './lexer';

/** @internal */
interface Rules {
    program(): Program;
    topLevelDef(): TopLevelDefinition | undefined;
    paramDef(): ParameterDefinition;
    stateDef(): StateDefinition;
    listenerDef(): ListenerDefinition;
    typeDef(): TypeDefinition;

    block(): Block | undefined;
    statement(): StatementOrBlock | undefined;
    ifCase(): IfCase | undefined;
    
    expression(): Expression | undefined;
    logical(): Expression | undefined;
    comparison(): Expression | undefined;
    addsub(): Expression | undefined;
    muldiv(): Expression | undefined;
    unary(): Expression | undefined;
    derefInvoke(): Expression | undefined;
    atom(): Expression | undefined;
    
    seqLiteral(): Expression | undefined;
    mapLiteral(): Expression | undefined;
    mapPair(): Pair | undefined;

    parameter(): Parameter | undefined;
    identifier(): Identifier | undefined;
    typeIdentifier(): TypeIdentifier | undefined;
    type(): Type | undefined;
}

// Public API since the main interface is internal
interface Rules {}

/** @internal */
type ExpressionRuleNames = keyof { [R in keyof Rules as Expression extends ReturnType<Rules[R]> ? R : never]: 1 };

function NO_IDENT(): Mutable<Identifier> {
    return {
        kind: ASTNodeKind.Identifier,
        name: '',
    };
}

function NO_TYPE_IDENT(): Mutable<TypeIdentifier> {
    return {
        kind: ASTNodeKind.TypeIdentifier,
        name: '',
    };
}

function NO_TYPE(): Mutable<Type> {
    return {
        kind: ASTNodeKind.TypeIdentifier,
        name: '',
    };
}

function NO_EXPR(): Mutable<Expression> {
    const identifier = NO_IDENT();
    const expr = {
        kind: ASTNodeKind.Variable,
        identifier,
    } as Variable;
    identifier.parent = expr;
    return expr;
}

function NO_BLOCK(): Mutable<Block> {
    return {
        kind: ASTNodeKind.Block,
        statements: [],
    };
}

enum ParseFlags {
    NONE = 0,
    DISABLE_TYPED_MAP = 1 << 0,

    CLEAR_ON_SURROUNDED = DISABLE_TYPED_MAP,
}

export class Parser extends DiagnosticsMixin implements Rules {
    private tokens!: Token[];
    private lexer?: StringLexer;

    loadSource(source: string) {
        this.lexer = new StringLexer(source);
        this.lexer.setDiagnostics(this.diagnostics);
        this.tokens = this.lexer.readAllTokens();
    }

    editSource(bytePos: number, length: number, insert: string) {
        if (!this.lexer) {
            this.loadSource(insert);
            return;
        }

        let firstTokenIdx = this.findTokenIndexAtBytePos(bytePos);
        const lastTokenIdx = this.findTokenIndexAtBytePos(bytePos + length, firstTokenIdx);

        // How far the edit is into the first/last token (e.g. myVal|ue would have value 5)
        let distanceIntoFirstToken = bytePos - this.tokens[firstTokenIdx].start;
        const distanceIntoLastToken = bytePos + length - this.tokens[lastTokenIdx].start;

        if (firstTokenIdx > 0 && distanceIntoFirstToken === 0) {
            // We need to shift back a token since the inserted text might alter the previous token.
            // For example:
            //     let siz[e] = 5;
            // If we just grab the token at the insertion index, our final token list will look like (omitting whitespace):
            // ['let', 'siz', 'e', '=', '5', ';']
            // Rather than:
            // ['let', 'size', '=', '5', ';']
            firstTokenIdx -= 1;
            distanceIntoFirstToken = this.tokens[firstTokenIdx].content.length;
        }

        // The inserted text fed to the lexer needs to include the parts of the tokens which will be re-lexed
        const frontTokenPart = this.tokens[firstTokenIdx].content.slice(0, distanceIntoFirstToken);
        const backTokenPart = this.tokens[lastTokenIdx].content.slice(distanceIntoLastToken);
        const fullInsertion = frontTokenPart + insert + backTokenPart;

        const numTokens = lastTokenIdx - firstTokenIdx + 1;

        const { insertedTokens, removedTokens } = this.lexer.mutate(firstTokenIdx, numTokens, fullInsertion);

        // Cache invalidation
        for (const token of removedTokens) {
            let node = this.memoTable.get(token)?.[0]?.[1];
            this.memoTable.delete(token);
            while (node) {
                const firstToken = node.tokens!.find(x => !isTrivia(x))!;

                const memoEntry = this.memoTable.get(firstToken);
                if (memoEntry) {
                    this.memoTable.set(firstToken, memoEntry.filter(x => x[1] !== node));
                }
                node = node.parent;
            }
        }

        const lastRemovedTokenIdx = this.tokens.indexOf(removedTokens.at(-1)!);
        this.tokens =
            this.tokens.slice(0, firstTokenIdx)
                .concat(insertedTokens)
                .concat(lastRemovedTokenIdx === -1 ? [] : this.tokens.slice(lastRemovedTokenIdx + 1));
    }
    
    private _diagnostics = new TrackingReporter(this.diagnostics);

    override setDiagnostics(diagnostics: DiagnosticsReporter) {
        this._diagnostics.setBaseReporter(diagnostics);
        this.diagnostics = this._diagnostics;
        this.lexer?.setDiagnostics(diagnostics);
    }

    private findTokenIndexAtBytePos(pos: number, from = 0) {
        let first = from;
        let last = this.tokens.length - 1;
        
        while (last > first) {
            let pivot = first + Math.floor((last - first) / 2);
            if (pos < this.tokens[pivot].start) {
                // Token is earlier
                last = pivot - 1;
            }
            else if (pos >= this.tokens[pivot].end) {
                // Token is later
                first = pivot + 1;
            }
            else {
                return pivot;
            }
        }
        // first is either 0 or tokens.length
        return first;
    }

    private focusHere() {
        const token = this.tokens[this.head - 1];
        const pos = token
            ? token.range.end
            : { line: 1, col: 1 }
        this.focus({
            start: pos,
            end: pos,
        });
    }

    private focusToken(token: Token) {
        this.focus(token.range);
    }

    private focusTokenRange(first: Token, last: Token) {
        this.focus({
            start: first.range.start,
            end: last.range.end,
        });
    }

    private memoTable = new Map<Token, [string, AnyNode][]>();

    private head = -1;
    private rollbackStack: number[] = [];
    private triviaRollbackStack: Trivia[][] = [];

    private get currentToken(): Token | undefined {
        return this.tokens[this.head];
    }

    private get isFullyConsumed() {
        return this.head >= this.tokens.length - 1;
    }

    private save() {
        this.rollbackStack.push(this.head);
        this.saveTrivia();
    }

    private commit() {
        this.rollbackStack.pop();
        this.propagateTrivia();
    }

    private rollback() {
        this.head = this.rollbackStack.pop()!;
        this.consumeTrivia();
    }

    private saveTrivia() {
        this.triviaRollbackStack.push([]);
    }

    private consumeTrivia() {
        return this.triviaRollbackStack.pop()!;
    }

    private propagateTrivia() {
        this.triviaRollbackStack[this.triviaRollbackStack.length - 2]?.push(...this.triviaRollbackStack.pop()!);
    }

    private addTrivia(trivia: Trivia) {
        this.triviaRollbackStack.at(-1)!.push(trivia);
    }

    private flagStack: ParseFlags[] = [0];

    private get flags() {
        return this.flagStack.at(-1)!;
    }

    setFlags(flags: ParseFlags) {
        this.flagStack.push(flags);
    }

    addFlags(flags: ParseFlags) {
        this.flagStack.push(this.flags | flags);
    }

    removeFlags(flags: ParseFlags) {
        this.flagStack.push(this.flags ^ (this.flags & flags));
    }

    resetFlags() {
        this.flagStack.pop();
    }

    private memoize(token: Token, rule: string, node: AnyNode) {
        const ruleStack = this.memoTable.get(token);

        if (ruleStack) {
            ruleStack.push([rule, node]);
        }
        else {
            this.memoTable.set(token, [[rule, node]]);
        }
    }

    private advanceToBeforeNextNonTrivia() {
        let token = this.tokens[this.head + 1];
        while (token && isTrivia(token)) {
            
            if (token.type === TokenType.TRIVIA_COMMENT) {
                // Comments have AST nodes
                this.addTrivia({
                    kind: ASTNodeKind.Comment,
                    content: token.content,
                    tokens: [token],
                });
            }

            token = this.tokens[++this.head + 1]
        }
    }

    private advanceWithoutChangingCache(): Token | undefined {
        this.advanceToBeforeNextNonTrivia();
        const token = this.tokens[++this.head];
        return token;
    }

    private next(): Token | undefined {
        const token = this.advanceWithoutChangingCache();
        // Invalidate a token's cache whenever we re-accept it
        this.memoTable.delete(token!);
        return token;
    }

    private peek(): Token | undefined {
        this.save();
        const token = this.advanceWithoutChangingCache();
        this.rollback();
        return token;
    }

    private accept(tokenType: TokenType): Token | undefined {
        this.save();
        const token = this.advanceWithoutChangingCache();
        if (token?.type === tokenType) {
            this.commit();
            // Invalidate a token's cache whenever we re-accept it
            this.memoTable.delete(token);
            return token;
        }
        this.rollback();
    }

    private oneOf(...tokenTypes: TokenType[]): Token | undefined {
        this.save();
        const token = this.next();
        if (tokenTypes.includes(token?.type!)) {
            this.commit();
            return token;
        }
        this.rollback();
    }

    private expect(tokenType: TokenType) {
        const token = this.accept(tokenType)
        if (!token) {
            this.focusHere();
            this.error(DiagnosticCodes.ExpectedTokenNotPresent, TokenType[tokenType]);
        }
        return token;
    }

    private visit<T extends keyof Rules>(rule: T): ReturnType<Rules[T]> {
        const isProgramRule = rule === 'program';

        let firstTokenIndex;

        // Program is the only node which should include leading trivia
        if (isProgramRule) {
            // + 1 since the program is generally going to start at -1
            firstTokenIndex = this.head + 1;
            this.saveTrivia();
            this.advanceToBeforeNextNonTrivia();
        }
        else {
            this.advanceToBeforeNextNonTrivia();
            // + 1 since the head ptr is behind the next token we're going to read
            firstTokenIndex = this.head + 1;
        }

        const nextToken = this.tokens[this.head + 1];
        if (nextToken) {
            const node = this.memoTable.get(nextToken)?.find(entry => entry[0] === rule)?.[1];
            if (node) {
                this.head += node.tokens!.length;
                return node as any;
            }
        }

        // If it was a Program node we already saved it, so no need to save it again 
        if (!isProgramRule) this.saveTrivia();

        const node = (this as any)[rule]() as Mutable<AnyNode>;

        if (!node) {
            this.propagateTrivia();
            return node; // undefined
        }

        node.tokens = this.tokens.slice(firstTokenIndex, this.head + 1);
        node.trivia = this.consumeTrivia();

        // Assign children
        for (const child of getChildren(node) as Mutable<AnyNode>[]) {
            child.parent = node;
        }

        // Memoize own tokens, and the first token even if not an own token.
        for (const token of node.tokens) {
            if (!this.memoTable.has(token) || token === nextToken) {
                this.memoize(token, rule, node);
            }
        }

        return node as ReturnType<Rules[T]>;
    }

    private repeat<T extends keyof Rules>(
        rule: T,
        until?: TokenType,
        delimeter?: TokenType,
        excludeTrailingDelimeter = false,
        abortOnFail = true,
    ): NonNullable<ReturnType<Rules[T]>>[] {
        this.removeFlags(ParseFlags.CLEAR_ON_SURROUNDED);
        try {
            const firstItem = this.visit(rule);
            if (!firstItem) {
                if (delimeter && !excludeTrailingDelimeter) {
                    this.accept(delimeter);
                }
                if ((until && this.expect(until)) || abortOnFail) {
                    return [];
                }
            }
            const results = [firstItem];

            while (!this.isFullyConsumed) {
                this.save();
                if (delimeter) {
                    if (!this.accept(delimeter)) {
                        this.commit();
                        if ((until && this.expect(until)) || abortOnFail) {
                            break;
                        }
                        continue;
                    }
                }
                if (until && this.accept(until)) {
                    // Either delimeter not configured or it was trailing
                    if (excludeTrailingDelimeter && delimeter) {
                        this.rollback();
                    }
                    else {
                        this.commit();
                    }
                    break;
                }
                const result = this.visit(rule);
                if (!result && abortOnFail) {
                    // If anything has been consumed so far, it would likely just be a trailing delimeter.
                    if (excludeTrailingDelimeter) {
                        this.rollback();
                    }
                    else {
                        this.commit();
                    }
                    return results as NonNullable<ReturnType<Rules[T]>>[];
                }
                this.commit();
                results.push(result);
            }

            return results.filter((x): x is NonNullable<ReturnType<Rules[T]>> => Boolean(x));
        }
        finally {
            this.resetFlags();
        }
    }

    private expectIdentifier() {
        const id = this.visit('identifier');
        if (!id) {
            this.focusHere();
            this.error(DiagnosticCodes.ExpectedIdentifier);
        }
        return id ?? NO_IDENT();
    }

    private expectTypeIdentifier() {
        const id = this.visit('typeIdentifier');
        if (!id) {
            this.focusHere();
            this.error(DiagnosticCodes.ExpectedIdentifier);
        }
        return id ?? NO_TYPE_IDENT();
    }

    private expectType() {
        const type = this.visit('type');
        if (!type) {
            this.focusHere();
            this.error(DiagnosticCodes.ExpectedType);
        }
        return type ?? NO_TYPE();
    }
    
    private expectExpression(
        rule: ExpressionRuleNames = 'expression',
    ) {
        const expr = this.visit(rule);
        if (!expr) {
            this.focusHere();
            this.error(DiagnosticCodes.ExpectedExpression);
        }
        return expr ?? NO_EXPR();
    }

    private expectBlock() {
        const body = this.visit('block');
        if (!body) {
            this.focusHere();
            this.error(DiagnosticCodes.ExpectedBlock);
        }
        return body ?? NO_BLOCK();
    }

    parse() {
        this.head = -1;
        return this.visit('program');
    }

    /** @internal */
    program(): Program {
        return {
            kind: ASTNodeKind.Program,
            definitions: this.repeat('topLevelDef', undefined, undefined, false, false),
        };
    }

    /** @internal */
    topLevelDef(): TopLevelDefinition | undefined {
        switch (this.peek()?.type) {
            case TokenType.KW_PARAM:
                return this.visit('paramDef');
            case TokenType.KW_STATE:
                return this.visit('stateDef');
            case TokenType.KW_ON:
                return this.visit('listenerDef');
            case TokenType.KW_TYPE:
                return this.visit('typeDef');
            case undefined:
                // End of file-- OK because this is the top level
                return;
            default:
                this.focusToken(this.next()!);
                this.error(DiagnosticCodes.UnexpectedToken, this.currentToken!);
        }
    }

    /** @internal */
    paramDef(): ParameterDefinition {
        this.expect(TokenType.KW_PARAM);
        const name = this.expectIdentifier();
        this.expect(TokenType.SYNTAX_COLON);
        const type = this.expectType();
        this.expect(TokenType.SYNTAX_SEMI);
        return {
            kind: ASTNodeKind.ParameterDefinition,
            name,
            type,
        };
    }

    /** @internal */
    stateDef(): StateDefinition {
        const on = this.expect(TokenType.KW_STATE);
        const name = this.expectIdentifier();
        const type = this.accept(TokenType.SYNTAX_COLON) ? this.expectType() : undefined;
        const $default = this.accept(TokenType.SYNTAX_EQUAL) ? this.expectExpression() : undefined;

        const semi = this.expect(TokenType.SYNTAX_SEMI);

        if (!$default) {
            this.focusTokenRange(on!, semi ?? type?.tokens?.at(-1) ?? name.tokens?.at(-1) ?? on!);
            this.error(DiagnosticCodes.NoStateInitialValue);
        }

        return {
            kind: ASTNodeKind.StateDefinition,
            name,
            type,
            default: $default,
        };
    }

    /** @internal */
    listenerDef(): ListenerDefinition {
        this.expect(TokenType.KW_ON);
        const event = this.expect(TokenType.LIT_IDENT);

        let parameters = [] as Parameter[];
        if (this.expect(TokenType.SYNTAX_LPAREN)) {
            parameters = this.repeat('parameter', TokenType.SYNTAX_RPAREN, TokenType.SYNTAX_COMMA);
        }

        const body = this.expectBlock();

        return {
            kind: ASTNodeKind.ListenerDefinition,
            event: event?.content ?? '',
            eventToken: event,
            parameters,
            body,
        };
    }
    
    /** @internal */
    typeDef(): TypeDefinition {
        this.expect(TokenType.KW_TYPE);
        const name = this.expectTypeIdentifier();
        this.expect(TokenType.SYNTAX_LPAREN);
        const parameters = this.repeat('parameter', TokenType.SYNTAX_RPAREN, TokenType.SYNTAX_COMMA);
        this.expect(TokenType.SYNTAX_SEMI);

        return {
            kind: ASTNodeKind.TypeDefinition,
            name,
            parameters,
        };
    }

    /** @internal */
    parameter(): Parameter | undefined {
        const name = this.visit('identifier');
        if (name) {
            const type = this.expect(TokenType.SYNTAX_COLON) ? this.expectType() : this.visit('type') ?? NO_TYPE();
            return {
                kind: ASTNodeKind.Parameter,
                name,
                type,
            };
        }
    }

    /** @internal */
    block(): Block | undefined {
        if (this.accept(TokenType.SYNTAX_LBRACE)) {
            return {
                kind: ASTNodeKind.Block,
                statements: this.repeat('statement', TokenType.SYNTAX_RBRACE),
            };
        }
    }

    /** @internal */
    statement(): StatementOrBlock | undefined {
        this.save();

        const firstToken = this.next();
        switch (firstToken?.type) {
            case TokenType.SYNTAX_LBRACE:
                this.rollback();
                return this.expectBlock();
            case TokenType.KW_DEBUG:
                this.commit();
                return {
                    kind: ASTNodeKind.DebugStatement,
                    arguments: this.repeat('expression', TokenType.SYNTAX_SEMI, TokenType.SYNTAX_COMMA),
                };
            case TokenType.KW_LET:
                this.commit();
                const name = this.expectIdentifier();
                const type = this.accept(TokenType.SYNTAX_COLON) ? this.expectType() : undefined;
                const value = this.accept(TokenType.SYNTAX_EQUAL) ? this.expectExpression() : undefined;
                
                const semi = this.expect(TokenType.SYNTAX_SEMI);

                if (!type && !value) {
                    this.focusTokenRange(firstToken, semi ?? name?.tokens?.at(-1) ?? firstToken);
                    this.error(DiagnosticCodes.LetIsEmpty);
                }

                return {
                    kind: ASTNodeKind.LetStatement,
                    name,
                    type,
                    value,
                };
            case TokenType.KW_IF:
                this.rollback();
                const cases = this.repeat('ifCase', undefined, TokenType.KW_ELSE, true, true);
                const $else = this.accept(TokenType.KW_ELSE) ? this.expectBlock() : undefined;
                return {
                    kind: ASTNodeKind.IfElseChain,
                    cases,
                    else: $else,
                };
            case TokenType.SYNTAX_RBRACE:
                // Empty block, return and let `repeat` handle the rest.
                this.rollback();
                return;
            case undefined:
                this.focusHere();
                this.error(DiagnosticCodes.UnexpectedEndOfInput);
                return;
        }

        // If not any of those, it must start with an expression
        this.rollback();
        const expr = this.visit('expression');
        if (!expr) {
            // there is no possible statement, so just trash the token
            const token = this.next()!;
            this.focusToken(token);
            this.error(DiagnosticCodes.UnexpectedToken, token);
            return; 
        }

        switch (this.next()?.type) {
            default:
                // If it doesn't match any of these, just error and act like it has a semicolon.
                this.focusHere();
                this.error(DiagnosticCodes.ExpectedTokenNotPresent, TokenType[TokenType.SYNTAX_SEMI]);
            case TokenType.SYNTAX_SEMI:
                return {
                    kind: ASTNodeKind.ExpressionStatement,
                    expr,
                };
            case TokenType.SYNTAX_EQUAL:
                const value = this.expectExpression();
                this.expect(TokenType.SYNTAX_SEMI);
                if (expr.kind === ASTNodeKind.Dereference) {
                    return {
                        kind: ASTNodeKind.AssignField,
                        obj: expr.obj,
                        member: expr.member,
                        value,
                    };
                }
                else if (expr.kind === ASTNodeKind.Variable) {
                    return {
                        kind: ASTNodeKind.AssignVar,
                        variable: expr.identifier,
                        value,
                    };
                }
                this.focus(expr);
                this.error(DiagnosticCodes.AssignToExpression);
                return {
                    kind: ASTNodeKind.AssignField,
                    obj: expr,
                    member: DUMMY_IDENTIFIER,
                    value,
                };
            case undefined:
                this.focusHere();
                this.error(DiagnosticCodes.UnexpectedEndOfInput);
                return;
        }
    }

    /** @internal */
    ifCase(): IfCase | undefined {
        if (this.accept(TokenType.KW_IF)) {

            // Resolve ambiguity in parsing `if Foo{} {}` by explicitly parsing it as `if (Foo){} {}`
            this.addFlags(ParseFlags.DISABLE_TYPED_MAP);
            const condition = this.expectExpression();
            this.resetFlags();

            let deconstruct;
            if (this.accept(TokenType.SYNTAX_PIPE)) {
                deconstruct = this.expectIdentifier();
                this.expect(TokenType.SYNTAX_PIPE);
            }
            const body = this.expectBlock();
            return {
                kind: ASTNodeKind.IfCase,
                condition,
                deconstruct,
                body,
            };
        }
    }

    /** @internal */
    expression(): Expression | undefined {
        return this.visit('logical');
    }

    /** @internal */
    binaryOp(
        lowerRule: ExpressionRuleNames,
        mapping: { [Type in TokenType]?: InfixOperator },
        precedenceConflictDiagnostic?: DiagnosticCodes,
    ): Expression | undefined {
        // Because we're not using visit, we need to handle adding source info ourselves
        const firstTokenIndex = this.head + 1;

        let expr = this.visit(lowerRule);

        if (expr) {
            // Keep track of the first operator we encounter for precedence issues.
            let firstOp: InfixOperator;
            let alreadyReported = false;
            
            while (this.oneOf(...Object.keys(mapping).map(x => +x))) {
                // Intentionally not saving trivia here.
                const op = mapping[this.currentToken!.type]!;
                firstOp ??= op;
                const rhs: Mutable<Expression> = this.expectExpression(lowerRule);

                const lhs: Mutable<Expression> = expr;
                expr = {
                    kind: ASTNodeKind.BinaryOp,
                    op,
                    lhs,
                    rhs,
                    tokens: this.tokens.slice(firstTokenIndex, this.head + 1),
                    trivia: this.consumeTrivia(),
                };
                lhs.parent = expr;
                rhs.parent = expr;

                if (precedenceConflictDiagnostic && op !== firstOp && !alreadyReported) {
                    this.focus(expr);
                    this.error(precedenceConflictDiagnostic);
                    // Avoid diagnostic spam
                    alreadyReported = true;
                }
                this.saveTrivia();
            }
        }

        return expr;
    }

    /** @internal */
    logical(): Expression | undefined {
        return this.binaryOp('comparison', {
            [TokenType.OP_AND]: InfixOperator.And,
            [TokenType.OP_OR]: InfixOperator.Or,
        }, DiagnosticCodes.MixedAndOr);
    }
    
    /** @internal */
    comparison(): Expression | undefined {
        return this.binaryOp('addsub', {
            [TokenType.OP_EQ]: InfixOperator.Equals,
            [TokenType.OP_NEQ]: InfixOperator.NotEquals,
            [TokenType.OP_LT]: InfixOperator.LessThan,
            [TokenType.OP_LE]: InfixOperator.LessThanEqual,
            [TokenType.OP_GT]: InfixOperator.GreaterThan,
            [TokenType.OP_GE]: InfixOperator.GreaterThanEqual,
        });
    }

    /** @internal */
    addsub(): Expression | undefined {
        return this.binaryOp('muldiv', {
            [TokenType.OP_ADD]: InfixOperator.Add,
            [TokenType.OP_SUB]: InfixOperator.Subtract,
        });
    }

    /** @internal */
    muldiv(): Expression | undefined {
        return this.binaryOp('unary', {
            [TokenType.OP_MUL]: InfixOperator.Multiply,
            [TokenType.OP_DIV]: InfixOperator.Divide,
        });
    }

    /** @internal */
    unary(): Expression | undefined {
        if (this.oneOf(TokenType.OP_SUB, TokenType.OP_NOT)) {
            return {
                kind: ASTNodeKind.UnaryOp,
                op: this.currentToken!.type === TokenType.OP_SUB ? PrefixOperator.Minus : PrefixOperator.Not,
                expr: this.expectExpression('unary'),
            };
        }
        return this.visit('derefInvoke');
    }

    /** @internal */
    derefInvoke(): Expression | undefined {
        // Because we're not using visit, we need to handle adding source info ourselves
        const firstTokenIndex = this.head + 1;

        let expr = this.visit('atom');

        if (expr) {
            while (this.oneOf(TokenType.SYNTAX_DOT, TokenType.SYNTAX_LPAREN)) {
                // Intentionally not saving trivia here.
                switch (this.currentToken!.type) {
                    case TokenType.SYNTAX_DOT:
                        const obj: Mutable<Expression> = expr;
                        const member: Mutable<Identifier> = this.expectIdentifier();
                        // Dereference
                        expr = {
                            kind: ASTNodeKind.Dereference,
                            obj,
                            member,
                            tokens: this.tokens.slice(firstTokenIndex, this.head + 1),
                            trivia: this.consumeTrivia(),
                        };
                        obj.parent = expr;
                        member.parent = expr;
                        break;
                    case TokenType.SYNTAX_LPAREN:
                        // Invoke
                        const fn: Mutable<Expression> = expr;
                        const args = this.repeat('expression', TokenType.SYNTAX_RPAREN, TokenType.SYNTAX_COMMA);
                        expr = {
                            kind: ASTNodeKind.Invoke,
                            fn,
                            args,
                            tokens: this.tokens.slice(firstTokenIndex, this.head + 1),
                            trivia: this.consumeTrivia(),
                        } as Invoke;
                        fn.parent = expr;
                        for (const arg of args as Mutable<Expression>[]) {
                            arg.parent = expr;
                        }
                        break;
                }
                this.saveTrivia();
            }
        }

        return expr;
    }

    /** @internal */
    atom(): Expression | undefined {
        this.save();
        switch (this.next()?.type) {
            case TokenType.SYNTAX_LPAREN:
                this.commit();
                this.removeFlags(ParseFlags.CLEAR_ON_SURROUNDED);
                const expr = this.expectExpression();
                this.resetFlags();
                this.expect(TokenType.SYNTAX_RPAREN);
                return expr;
            case TokenType.LIT_INT:
                this.commit();
                return {
                    kind: ASTNodeKind.IntLiteral,
                    value: this.currentToken!.content,
                };
            case TokenType.LIT_FLOAT:
                this.commit();
                return {
                    kind: ASTNodeKind.FloatLiteral,
                    value: +this.currentToken!.content,
                };
            case TokenType.KW_TRUE:
                this.commit();
                return {
                    kind: ASTNodeKind.BoolLiteral,
                    value: true,
                };
            case TokenType.KW_FALSE:
                this.commit();
                return {
                    kind: ASTNodeKind.BoolLiteral,
                    value: false,
                };
            case TokenType.LIT_STRING:
                this.commit();
                return {
                    kind: ASTNodeKind.StringLiteral,
                    value: this.currentToken!.content
                        .slice(1, -1)
                        .replaceAll('\\\\', '\\')
                        .replaceAll('\\n', '\n')
                        .replaceAll('\\t', '\t')
                        .replaceAll('\\', '') // Remove extraneous escapes
                        .replaceAll(/\r\n|\r|\n/g, '\n'),
                };
            case TokenType.LIT_IDENT:
                if (this.oneOf(TokenType.SYNTAX_LSQUARE, TokenType.SYNTAX_LBRACE)) {
                    const tokenType = this.currentToken!.type;
                    this.rollback();
                    // Either a sequence or map expression
                    if (tokenType === TokenType.SYNTAX_LSQUARE) {
                        // Sequence literal
                        return this.visit('seqLiteral');
                    }
                    else if (!hasFlag(this.flags, ParseFlags.DISABLE_TYPED_MAP)) {
                        // Map literal
                        return this.visit('mapLiteral');
                    }
                }
                else {
                    this.rollback();
                }
                return {
                    kind: ASTNodeKind.Variable,
                    identifier: this.visit('identifier')!,
                };
            case TokenType.SYNTAX_LSQUARE:
                this.rollback();
                return this.visit('seqLiteral');
            case TokenType.SYNTAX_LBRACE:
                this.rollback();
                return this.visit('mapLiteral');
        }
        this.rollback();
    }

    /** @internal */
    seqLiteral(): Expression | undefined {
        const type = this.visit('typeIdentifier');
        if (this.accept(TokenType.SYNTAX_LSQUARE)) {
            return {
                kind: ASTNodeKind.SequenceLiteral,
                type,
                elements: this.repeat('expression', TokenType.SYNTAX_RSQUARE, TokenType.SYNTAX_COMMA),
            };
        }
    }

    /** @internal */
    mapLiteral(): Expression | undefined {
        const type = this.visit('typeIdentifier');
        if (this.accept(TokenType.SYNTAX_LBRACE)) {
            return {
                kind: ASTNodeKind.MapLiteral,
                type,
                pairs: this.repeat('mapPair', TokenType.SYNTAX_RBRACE, TokenType.SYNTAX_COMMA),
            };
        }
    }

    /** @internal */
    mapPair(): Pair | undefined {
        const key = this.visit('expression');
        if (key) {
            this.expect(TokenType.SYNTAX_COLON);
            return {
                kind: ASTNodeKind.Pair,
                key,
                value: this.expectExpression(),
            };
        }
    }

    /** @internal */
    type(): Type | undefined {
        if (this.oneOf(TokenType.SYNTAX_LPAREN, TokenType.LIT_IDENT)) {
            if (this.currentToken!.type === TokenType.SYNTAX_LPAREN) {
                // Function type
                const parameters = this.repeat('type', TokenType.SYNTAX_RPAREN, TokenType.SYNTAX_COMMA);
                this.expect(TokenType.SYNTAX_ARROW);
                const returnType = this.expectType();
                return {
                    kind: ASTNodeKind.FunctionType,
                    parameters,
                    returnType,
                };
            }
            else {
                // Type identifier
                const typeId: Mutable<TypeIdentifier> = {
                    kind: ASTNodeKind.TypeIdentifier,
                    name: this.currentToken!.content,
                    tokens: [this.currentToken!],
                };
                if (this.accept(TokenType.OP_LT)) {
                    // parameterized type
                    const genericType: GenericType = {
                        kind: ASTNodeKind.GenericType,
                        name: typeId,
                        typeArguments: this.repeat('type', TokenType.OP_GT, TokenType.SYNTAX_COMMA),
                    };
                    typeId.parent = genericType;
                    return genericType;
                }
                else {
                    return typeId;
                }
            }
        }
    }

    /** @internal */
    identifier(): Identifier | undefined {
        const token = this.accept(TokenType.LIT_IDENT);

        if (token) {
            return {
                kind: ASTNodeKind.Identifier,
                name: token.content,
            };
        }
    }

    /** @internal */
    typeIdentifier(): TypeIdentifier | undefined {
        const token = this.accept(TokenType.LIT_IDENT);

        if (token) {
            return {
                kind: ASTNodeKind.TypeIdentifier,
                name: token.content,
            };
        }
    }
}