import { ParserRuleContext } from 'antlr4ts';
import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor';
import { AstMetadata, ASTNodeKind, Identifier, TypeIdentifier } from '../ast/Ast';
import { IdentifierContext, TypeIdentifierContext } from './generated/MiKeParser';
import { MiKeVisitor } from './generated/MiKeVisitor';

export interface AbstractMiKeVisitor<T> extends MiKeVisitor<T> {};
export abstract class AbstractMiKeVisitor<T> extends AbstractParseTreeVisitor<T> implements MiKeVisitor<T> {
    
    protected _visitIdentifier(ctx: IdentifierContext): Identifier {
        return {
            kind: ASTNodeKind.Identifier,
            metadata: this.getMetadata(ctx),
            name: ctx.NAME().text
        };
    }

    protected _visitTypeIdentifier(ctx: TypeIdentifierContext): TypeIdentifier {
        return {
            kind: ASTNodeKind.TypeIdentifier,
            metadata: this.getMetadata(ctx),
            name: ctx.NAME().text
        };
    }

    protected override defaultResult(): T {
        return null!;
    }

    protected override aggregateResult(aggregate: T, nextResult: T): T {
        return aggregate ?? nextResult;
    }

    protected getMetadata(ctx: ParserRuleContext): AstMetadata {
        const start = { line: ctx.start.line, col: ctx.start.charPositionInLine };
        const end = ctx.stop ? { line: ctx.stop!.line, col: ctx.stop!.charPositionInLine } : start;
        return {
            extent: { start, end }
        };
    }
};