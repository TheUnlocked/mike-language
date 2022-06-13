import { ParserRuleContext, RecognitionException } from 'antlr4ts';
import { _typedExprNode } from '../ast/Ast.gen';

export class MiKeError extends Error {
    name = 'MiKeError';
}

export class MiKeSyntaxError extends MiKeError {
    name = 'MiKeSyntaxError';
    context?: ParserRuleContext;

    constructor(message: string, options?: {
        cause?: RecognitionException,
        context?: ParserRuleContext
    }) {
        super(message, options);

        this.context = options?.context;
    }
}

export class MiKeSemanticError<T extends { type: string }> extends MiKeError {
    name = 'MiKeSemanticsError';
    
    constructor(public expression: _typedExprNode<any>, public details: T) {
        super(details.type);
    }
}

export function throwMiKeError(e: MiKeError) {
    throw e;
}