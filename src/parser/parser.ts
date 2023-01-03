import { AnyNode, ASTNodeKind, Block, DUMMY_IDENTIFIER, Expression, Identifier, IfCase, InfixOperator, ListenerDefinition, Pair, Parameter, ParameterDefinition, PrefixOperator, Program, StateDefinition, StatementOrBlock, TopLevelDefinition, Trivia, Type, TypeDefinition, TypeIdentifier } from '../ast';
import { DiagnosticCodes, DiagnosticsMixin } from '../diagnostics';
import { hasFlag } from '../utils/flags';
import { isTrivia, Token, TokenType } from './lexer';

interface MemoEntry {
    // Memo entries are double-keyed to tokens (referentially) and parse rules.
    readonly parseRule: string;
    readonly astNode: AnyNode;
}

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

type ExpressionRuleNames = keyof { [R in keyof Rules as Expression extends ReturnType<Rules[R]> ? R : never]: 1 };

const NO_IDENT: Identifier = {
    kind: ASTNodeKind.Identifier,
    name: '',
};

const NO_TYPE_IDENT: TypeIdentifier = {
    kind: ASTNodeKind.TypeIdentifier,
    name: '',
};

const NO_TYPE: Type = {
    kind: ASTNodeKind.TypeIdentifier,
    name: '',
};

const NO_EXPR: Expression = {
    kind: ASTNodeKind.Variable,
    identifier: NO_IDENT,
};

const NO_BLOCK: Block = {
    kind: ASTNodeKind.Block,
    statements: [],
};

enum ParseFlags {
    NONE = 0,
    DISABLE_TYPED_MAP = 1 << 0,

    CLEAR_ON_SURROUNDED = DISABLE_TYPED_MAP,
}

export class Parser extends DiagnosticsMixin implements Rules {
    private tokens: Token[];
    
    constructor(tokens: Token[]) {
        super();
        // Defensive copy
        this.tokens = [...tokens];
    }

    private focusHere() {
        const token = this.tokens[this.head - 1];
        const pos = token
            ? { line: token.endLine, col: token.endCol }
            : { line: 1, col: 1 }
        this.focus({
            start: pos,
            end: pos,
        });
    }

    private focusToken(token: Token) {
        this.focus({
            start: { line: token.startLine, col: token.startCol },
            end: { line: token.endLine, col: token.endCol },
        });
    }

    private focusTokenRange(first: Token, last: Token) {
        this.focus({
            start: { line: first.startLine, col: first.startCol },
            end: { line: last.endLine, col: last.endCol },
        });
    }

    private memoTable = new Map<Token, MemoEntry>();

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

    private next(): Token | undefined {
        this.advanceToBeforeNextNonTrivia();
        const token = this.tokens[++this.head];
        // Invalidate a token's cache whenever we re-accept it
        this.memoTable.delete(token);
        return token;
    }

    private accept(tokenType: TokenType): Token | undefined {
        this.save();
        const token = this.next();
        if (token?.type === tokenType) {
            this.commit();
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
            this.error(DiagnosticCodes.ExpectedTokenNotPresent, TokenType[tokenType]) as undefined;
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
            let entry = this.memoTable.get(nextToken);
            if (entry?.parseRule === rule) {
                this.head += entry.astNode.tokens!.length;
                return entry.astNode as any;
            }
        }

        // If it was a Program node we already saved it, so no need to save it again 
        if (!isProgramRule) this.saveTrivia();

        const result = (this as any)[rule]() as ReturnType<Rules[T]>;

        if (!result) {
            this.propagateTrivia();
            return result;
        }

        if (nextToken) {
            this.memoTable.set(nextToken, {
                astNode: result,
                parseRule: rule,
            });
        }
        // @ts-expect-error Mutating tokens is okay here.
        result.tokens = this.tokens.slice(firstTokenIndex, this.head + 1);
        // @ts-expect-error Mutating trivia is okay here.
        result.trivia = this.consumeTrivia();
        return result;
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
        return id ?? NO_IDENT;
    }

    private expectTypeIdentifier() {
        const id = this.visit('typeIdentifier');
        if (!id) {
            this.focusHere();
            this.error(DiagnosticCodes.ExpectedIdentifier);
        }
        return id ?? NO_TYPE_IDENT;
    }

    private expectType() {
        const type = this.visit('type');
        if (!type) {
            this.focusHere();
            this.error(DiagnosticCodes.ExpectedType);
        }
        return type ?? NO_TYPE;
    }
    
    private expectExpression(
        rule: ExpressionRuleNames = 'expression',
    ) {
        const expr = this.visit(rule);
        if (!expr) {
            this.focusHere();
            this.error(DiagnosticCodes.ExpectedExpression);
        }
        return expr ?? NO_EXPR;
    }

    private expectBlock() {
        const body = this.visit('block');
        if (!body) {
            this.focusHere();
            this.error(DiagnosticCodes.ExpectedBlock);
        }
        return body ?? NO_BLOCK;
    }

    parse() {
        this.head = -1;
        return this.visit('program');
    }

    program(): Program {
        return {
            kind: ASTNodeKind.Program,
            definitions: this.repeat('topLevelDef', undefined, undefined, false, false),
        };
    }

    topLevelDef(): TopLevelDefinition | undefined {
        switch (this.next()?.type) {
            case TokenType.KW_PARAM:
                return this.visit('paramDef');
            case TokenType.KW_STATE:
                const stateDef = this.visit('stateDef');
                if (!stateDef.default) {
                    this.focus(stateDef);
                    this.error(DiagnosticCodes.NoStateInitialValue);
                }
                return stateDef;
            case TokenType.KW_ON:
                return this.visit('listenerDef');
            case TokenType.KW_TYPE:
                return this.visit('typeDef');
            case undefined:
                // End of file-- OK because this is the top level
                return;
            default:
                this.focusToken(this.currentToken!);
                this.error(DiagnosticCodes.UnexpectedToken, this.currentToken!);
        }
    }

    paramDef(): ParameterDefinition {
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

    stateDef(): StateDefinition {
        const name = this.expectIdentifier();
        const type = this.accept(TokenType.SYNTAX_COLON) ? this.expectType() : undefined;
        const $default = this.accept(TokenType.SYNTAX_EQUAL) ? this.expectExpression() : undefined;

        this.expect(TokenType.SYNTAX_SEMI);

        return {
            kind: ASTNodeKind.StateDefinition,
            name,
            type,
            default: $default,
        };
    }

    listenerDef(): ListenerDefinition {
        const event = this.expectIdentifier();

        let parameters = [] as Parameter[];
        if (this.expect(TokenType.SYNTAX_LPAREN)) {
            parameters = this.repeat('parameter', TokenType.SYNTAX_RPAREN, TokenType.SYNTAX_COMMA);
        }

        const body = this.expectBlock();

        return {
            kind: ASTNodeKind.ListenerDefinition,
            event: event.name,
            parameters,
            body,
        };
    }
    
    typeDef(): TypeDefinition {
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

    parameter(): Parameter | undefined {
        const name = this.visit('identifier');
        if (name) {
            const type = this.expect(TokenType.SYNTAX_COLON) ? this.expectType() : this.visit('type') ?? NO_TYPE;
            return {
                kind: ASTNodeKind.Parameter,
                name,
                type,
            };
        }
    }

    block(): Block | undefined {
        if (this.accept(TokenType.SYNTAX_LBRACE)) {
            return {
                kind: ASTNodeKind.Block,
                statements: this.repeat('statement', TokenType.SYNTAX_RBRACE),
            };
        }
    }

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

    expression(): Expression | undefined {
        return this.visit('logical');
    }

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
                const rhs = this.expectExpression(lowerRule);
                expr = {
                    kind: ASTNodeKind.BinaryOp,
                    op,
                    lhs: expr,
                    rhs,
                    tokens: this.tokens.slice(firstTokenIndex, this.head + 1),
                    trivia: this.consumeTrivia(),
                };
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

    logical(): Expression | undefined {
        return this.binaryOp('comparison', {
            [TokenType.OP_AND]: InfixOperator.And,
            [TokenType.OP_OR]: InfixOperator.Or,
        }, DiagnosticCodes.MixedAndOr);
    }
    
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

    addsub(): Expression | undefined {
        return this.binaryOp('muldiv', {
            [TokenType.OP_ADD]: InfixOperator.Add,
            [TokenType.OP_SUB]: InfixOperator.Subtract,
        });
    }

    muldiv(): Expression | undefined {
        return this.binaryOp('unary', {
            [TokenType.OP_MUL]: InfixOperator.Multiply,
            [TokenType.OP_DIV]: InfixOperator.Divide,
        });
    }

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

    derefInvoke(): Expression | undefined {
        // Because we're not using visit, we need to handle adding source info ourselves
        const firstTokenIndex = this.head + 1;

        let expr = this.visit('atom');

        if (expr) {
            while (this.oneOf(TokenType.SYNTAX_DOT, TokenType.SYNTAX_LPAREN)) {
                // Intentionally not saving trivia here.
                switch (this.currentToken!.type) {
                    case TokenType.SYNTAX_DOT:
                        // Dereference
                        expr = {
                            kind: ASTNodeKind.Dereference,
                            obj: expr,
                            member: this.expectIdentifier(),
                            tokens: this.tokens.slice(firstTokenIndex, this.head + 1),
                            trivia: this.consumeTrivia(),
                        };
                        break;
                    case TokenType.SYNTAX_LPAREN:
                        // Invoke
                        expr = {
                            kind: ASTNodeKind.Invoke,
                            fn: expr,
                            args: this.repeat('expression', TokenType.SYNTAX_RPAREN, TokenType.SYNTAX_COMMA),
                            tokens: this.tokens.slice(firstTokenIndex, this.head + 1),
                            trivia: this.consumeTrivia(),
                        };
                        break;
                }
                this.saveTrivia();
            }
        }

        return expr;
    }

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
                const typeId: TypeIdentifier = {
                    kind: ASTNodeKind.TypeIdentifier,
                    name: this.currentToken!.content,
                    tokens: [this.currentToken!],
                };
                if (this.accept(TokenType.OP_LT)) {
                    // parameterized type
                    return {
                        kind: ASTNodeKind.GenericType,
                        name: typeId,
                        typeArguments: this.repeat('type', TokenType.OP_GT, TokenType.SYNTAX_COMMA),
                    };
                }
                else {
                    return typeId;
                }
            }
        }
    }

    identifier(): Identifier | undefined {
        const token = this.accept(TokenType.LIT_IDENT);

        if (token) {
            return {
                kind: ASTNodeKind.Identifier,
                name: token.content,
            };
        }
    }

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