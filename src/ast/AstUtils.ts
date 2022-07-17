import { WithDiagnostics } from '../diagnostics/Mixin';
import { CommentsAstGenVisitor } from '../grammar/Comments';
import { ExprAstGenVisitor } from '../grammar/Expressions';
import { getCommentParser, getLexer, getParser } from '../grammar/Parser';
import { TopLevelDefinitionAstGenVisitor } from '../grammar/TopLevelDefinitions';
import { StatementAstGenVisitor } from '../grammar/Statements';
import { AnyNode, ASTNodeKind, Range, Program, Position } from './Ast';

export class AstUtils extends WithDiagnostics(class {}) {
    parse(source: string): Program {
        const lexer = getLexer(source, this.diagnostics);
        const parser = getParser(lexer, this.diagnostics);
        
        const exprVisitor = new ExprAstGenVisitor();
        exprVisitor.setDiagnostics(this.diagnosticsManager);
        const statementVisitor = new StatementAstGenVisitor(exprVisitor);
        statementVisitor.setDiagnostics(this.diagnosticsManager);
        const topLevelDefinitionVisitor = new TopLevelDefinitionAstGenVisitor(exprVisitor, statementVisitor);
        topLevelDefinitionVisitor.setDiagnostics(this.diagnosticsManager);
        const definitions = parser.program().topLevelDecl().map(x => x.accept(topLevelDefinitionVisitor));

        const commentParser = getCommentParser(lexer);
        const comments = commentParser.comments().accept(new CommentsAstGenVisitor());

        return {
            kind: ASTNodeKind.Program,
            metadata: {
                extent: {
                    start: { line: 1, col: 0 },
                    end: getLastPosition(source)
                }
            },
            definitions,
            comments,
        };
    }

    getNodeAt(ast: AnyNode, position: Position): AnyNode | undefined {
        if (!inRange(ast.metadata.extent, position)) {
            return undefined;
        }
        let node = ast;
        main: while (true) {
            for (const child of this.getChildren(node)) {
                if (inRange(child.metadata.extent, position)) {
                    node = child;
                    continue main;
                }
            }
            return node;
        }
    }

    getChildren(ast: AnyNode): readonly AnyNode[] {
        switch (ast.kind) {
            case ASTNodeKind.Invoke:
                return [ast.fn, ...ast.args];
            case ASTNodeKind.BinaryOp:
                return [ast.lhs, ast.rhs];
            case ASTNodeKind.UnaryOp:
                return [ast.expr];
            case ASTNodeKind.Dereference:
                return [ast.obj];
            case ASTNodeKind.Variable:
            case ASTNodeKind.FloatLiteral:
            case ASTNodeKind.IntLiteral:
            case ASTNodeKind.BoolLiteral:
            case ASTNodeKind.StringLiteral:
                return [];
            case ASTNodeKind.SequenceLiteral:
                return ast.elements;
            case ASTNodeKind.MapLiteral:
                return ast.pairs;
            case ASTNodeKind.ExpressionStatement:
                return [ast.expr];
            case ASTNodeKind.LetStatement:
                return ast.value ? [ast.value] : [];
            case ASTNodeKind.AssignVar:
            case ASTNodeKind.AssignField:
                return [ast.value];
            case ASTNodeKind.IfElseChain:
                return [...ast.cases, ...ast.else ? [ast.else] : []];
            case ASTNodeKind.DebugStatement:
                return ast.arguments;
            case ASTNodeKind.Block:
                return ast.statements;
            case ASTNodeKind.ParamDefinition:
                return [];
            case ASTNodeKind.StateDefinition:
                return ast.default ? [ast.default] : [];
            case ASTNodeKind.ListenerDefinition:
                return [...ast.parameters, ast.body];
            case ASTNodeKind.TypeDefinition:
                return [];
            case ASTNodeKind.Program:
                return [...ast.comments, ...ast.definitions];
            case ASTNodeKind.ParameterFragment:
                return [];
            case ASTNodeKind.IfCaseFragment:
                return [ast.condition, ast.body];
            case ASTNodeKind.PairFragment:
                return [ast.key, ast.value];
            case ASTNodeKind.Comment:
                return [];
        }
    }
}

function inRange({ start, end }: Range, position: Position) {
    if (position.line >= start.line && position.line <= end.line) {
        if (position.line === start.line) {
            if (position.line === end.line) {
                return position.col >= start.col && position.col <= end.col;
            }
            return position.col >= start.col;
        }
        else if (position.line === end.line) {
            return position.col <= end.col;
        }
        return true;
    }
    return false;
}

function getLastPosition(str: string): Position {
    let line = 1;
    let lastLineSourcePosition = 0;
    for (let i = 0; i < str.length; i++) {
        if (str[i] === '\n') {
            line++;
            lastLineSourcePosition = i;
        }
    }
    return {
        line,
        col: str.length - lastLineSourcePosition - 1
    };
}