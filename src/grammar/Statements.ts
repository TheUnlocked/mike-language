import { MiKeVisitor } from './generated/MiKeVisitor';
import { BlockContext, DebugStatementContext, ExpressionStatementContext, FieldAssignmentStatementContext, IfCaseContext, IfStatementContext, LetStatementContext, VarAssignmentStatementContext } from './generated/MiKeParser';
import { ASTNodeKind, Expression, Statement, Block, StatementOrBlock, LetStatement, AssignField, IfCase, Type } from '../ast/Ast';
import { DiagnosticCodes } from '../diagnostics/DiagnosticCodes';
import { boundMethod } from 'autobind-decorator';
import { WithDiagnostics } from '../diagnostics/Mixin';
import { AbstractMiKeVisitor } from './BaseVisitor';
import { AstUtils } from '../ast/AstUtils';

export class StatementAstGenVisitor extends WithDiagnostics(AbstractMiKeVisitor<StatementOrBlock>) {

    constructor(
        private typeVisitor: MiKeVisitor<Type>,
        private exprVisitor: MiKeVisitor<Expression>,
    ) {
        super();
    }

    override visitExpressionStatement(ctx: ExpressionStatementContext): Statement {
        return {
            kind: ASTNodeKind.ExpressionStatement,
            metadata: this.getMetadata(ctx),
            expr: ctx.expression().accept(this.exprVisitor),
        };
    }

    override visitLetStatement(ctx: LetStatementContext): Statement {
        const varDef = ctx.varDef();
        const type = varDef.type();
        const expr = varDef.expression();
        
        const node = {
            kind: ASTNodeKind.LetStatement,
            metadata: this.getMetadata(ctx),
            name: this._visitIdentifier(varDef.identifier()),
            type: type?.accept(this.typeVisitor),
            value: expr?.accept(this.exprVisitor),
        } as LetStatement;

        if (!expr && !type) {
            this.diagnostics.focus(node);
            this.error(DiagnosticCodes.LetIsEmpty);
        }
        return node;
    }

    override visitVarAssignmentStatement(ctx: VarAssignmentStatementContext): Statement {
        return {
            kind: ASTNodeKind.AssignVar,
            metadata: this.getMetadata(ctx),
            variable: this._visitIdentifier(ctx.identifier()),
            value: ctx.expression().accept(this.exprVisitor),
        }
    }

    override visitFieldAssignmentStatement(ctx: FieldAssignmentStatementContext): Statement {
        const [lhs, value] = ctx.expression().map(x => x.accept(this.exprVisitor));

        if (lhs.kind !== ASTNodeKind.Dereference) {
            const node = {
                kind: ASTNodeKind.AssignField,
                metadata: this.getMetadata(ctx),
                member: AstUtils.DUMMY_IDENTIFIER,
                obj: lhs,
                value,
            } as AssignField;
            this.diagnostics.focus(node);
            this.error(DiagnosticCodes.AssignToExpression);
            return node;
        }

        return {
            kind: ASTNodeKind.AssignField,
            metadata: this.getMetadata(ctx),
            member: lhs.member,
            obj: lhs.obj,
            value,
        }
    }

    override visitIfStatement(ctx: IfStatementContext): Statement {
        const elseCtx = ctx.block();
        return {
            kind: ASTNodeKind.IfElseChain,
            metadata: this.getMetadata(ctx),
            cases: ctx.ifCase().map(this._visitIfCase),
            else: elseCtx ? this.visitBlock(elseCtx) : undefined,
        }
    }

    @boundMethod
    private _visitIfCase(ctx: IfCaseContext): IfCase {
        const deconstruct = ctx.identifier();
        return {
            kind: ASTNodeKind.IfCase,
            metadata: this.getMetadata(ctx),
            condition: ctx.expression().accept(this.exprVisitor),
            deconstruct: deconstruct ? this._visitIdentifier(deconstruct) : undefined,
            body: this.visitBlock(ctx.block()),
        };
    }

    override visitDebugStatement(ctx: DebugStatementContext): Statement {
        return {
            kind: ASTNodeKind.DebugStatement,
            metadata: this.getMetadata(ctx),
            arguments: ctx.expression().map(x => x.accept(this.exprVisitor)),
        }
    }

    override visitBlock(ctx: BlockContext): Block {
        return {
            kind: ASTNodeKind.Block,
            metadata: this.getMetadata(ctx),
            statements: ctx.statement().map(x => x.accept(this)),
        }
    }
}