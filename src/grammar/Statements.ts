import { MiKeVisitor } from './generated/MiKeVisitor';
import { BlockContext, DebugStatementContext, ExpressionStatementContext, FieldAssignmentStatementContext, IfCaseContext, IfStatementContext, LetStatementContext, TypeContext, VarAssignmentStatementContext } from './generated/MiKeParser';
import { ParserRuleContext } from 'antlr4ts';
import { AstMetadata, ASTNodeKind, Expression, Statement, Block, AnyNode, StatementOrBlock, LetStatement, AssignField, IfCaseFragment } from '../ast/Ast';
import { DiagnosticCodes } from '../diagnostics/DiagnosticCodes';
import { KnownType, TypeKind } from '../types/KnownType';
import { boundMethod } from 'autobind-decorator';
import { WithDiagnostics } from '../diagnostics/Mixin';
import { AbstractMiKeVisitor } from './Parser';

export class StatementAstGenVisitor extends WithDiagnostics(AbstractMiKeVisitor<StatementOrBlock>) {

    constructor(private exprVisitor: MiKeVisitor<Expression>) {
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
            name: varDef.NAME().text,
            type: type ? this.resolveType(type) : undefined,
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
            name: ctx.NAME().text,
            value: ctx.expression().accept(this.exprVisitor),
        }
    }

    override visitFieldAssignmentStatement(ctx: FieldAssignmentStatementContext): Statement {
        const [lhs, value] = ctx.expression().map(x => x.accept(this.exprVisitor));

        if (lhs.kind !== ASTNodeKind.Dereference) {
            const node = {
                kind: ASTNodeKind.AssignField,
                metadata: this.getMetadata(ctx),
                memberName: '',
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
            memberName: lhs.memberName,
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
    private _visitIfCase(ctx: IfCaseContext): IfCaseFragment {
        return {
            kind: ASTNodeKind.IfCaseFragment,
            metadata: this.getMetadata(ctx),
            condition: ctx.expression().accept(this.exprVisitor),
            deconstructName: ctx.NAME()?.text,
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

    protected override aggregateResult(aggregate: Statement, nextResult: Statement): Statement {
        return aggregate ?? nextResult;
    }
    
    protected override defaultResult(): Statement {
        return null!;
    }

    @boundMethod
    private resolveType(ctx: TypeContext): KnownType {
        if (ctx.DOUBLE_ARROW()) {
            return {
                kind: TypeKind.Function,
                parameters: ctx.typeList()!.type().map(this.resolveType),
                returnType: this.resolveType(ctx.type()!),
            }
        }
        else {
            return {
                kind: TypeKind.Simple,
                name: ctx.NAME()!.text,
                typeArguments: ctx.typeArguments()?.type().map(this.resolveType) ?? [],
            }
        }
    }

    private getMetadata(ctx: ParserRuleContext): AstMetadata {
        return {
            extent: {
                start: { line: ctx.start.line, col: ctx.start.charPositionInLine },
                end: { line: ctx.stop!.line, col: ctx.stop!.charPositionInLine },
            }
        };
    }
}