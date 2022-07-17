import { CommentsContext } from './generated/MiKeParser';
import { ASTNodeKind, Comment } from '../ast/Ast';
import { AbstractMiKeVisitor } from './Parser';

export class CommentsAstGenVisitor extends AbstractMiKeVisitor<readonly Comment[]> {

    override visitComments(ctx: CommentsContext): readonly Comment[] {
        return ctx.COMMENT().map(ctx => {
            return {
                kind: ASTNodeKind.Comment,
                metadata: {
                    extent: {
                        start: { line: ctx.symbol.line, col: ctx.symbol.charPositionInLine },
                        end: { line: ctx.symbol.line, col: ctx.symbol.charPositionInLine + ctx.text.length }
                    }
                },
                content: ctx.text.slice(2, -1)
            } as Comment;
        });
    }

    protected override defaultResult(): readonly Comment[] {
        return null!;
    }

    protected override aggregateResult(aggregate: readonly Comment[], nextResult: readonly Comment[]): readonly Comment[] {
        return aggregate ?? nextResult;
    }
}
