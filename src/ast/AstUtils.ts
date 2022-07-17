import { WithDiagnostics } from '../diagnostics/Mixin';
import { AnyNode, ASTNodeKind, Range, Position, Identifier } from './Ast';

export class AstUtils extends WithDiagnostics(class {}) {
    getNodeAt(ast: AnyNode, position: Position): AnyNode | undefined {
        if (!AstUtils.inRange(ast.metadata.extent, position)) {
            return undefined;
        }
        let node = ast;
        main: while (true) {
            for (const child of this.getChildren(node)) {
                if (AstUtils.inRange(child.metadata.extent, position)) {
                    node = child;
                    continue main;
                }
            }
            return node;
        }
    }

    getChildren(ast: AnyNode): readonly AnyNode[] {
        switch (ast.kind) {
            default: // exhaustiveness
            case ASTNodeKind.Invoke:
                return [ast.fn, ...ast.args];
            case ASTNodeKind.BinaryOp:
                return [ast.lhs, ast.rhs];
            case ASTNodeKind.UnaryOp:
                return [ast.expr];
            case ASTNodeKind.Dereference:
                return [ast.obj, ast.member];
            case ASTNodeKind.Variable:
                return [ast.identifier];
            case ASTNodeKind.FloatLiteral:
            case ASTNodeKind.IntLiteral:
            case ASTNodeKind.BoolLiteral:
            case ASTNodeKind.StringLiteral:
                return [];
            case ASTNodeKind.SequenceLiteral:
                return [...ast.type ? [ast.type] : [], ...ast.elements];
            case ASTNodeKind.MapLiteral:
                return [...ast.type ? [ast.type] : [], ...ast.pairs];
            case ASTNodeKind.ExpressionStatement:
                return [ast.expr];
            case ASTNodeKind.LetStatement:
                return [ast.name, ...ast.type ? [ast.type] : [], ...ast.value ? [ast.value] : []];
            case ASTNodeKind.AssignVar:
                return [ast.variable, ast.value];
            case ASTNodeKind.AssignField:
                return [ast.obj, ast.member, ast.value];
            case ASTNodeKind.IfElseChain:
                return [...ast.cases, ...ast.else ? [ast.else] : []];
            case ASTNodeKind.DebugStatement:
                return ast.arguments;
            case ASTNodeKind.Block:
                return ast.statements;
            case ASTNodeKind.ParameterDefinition:
                return [ast.identifier, ast.type];
            case ASTNodeKind.StateDefinition:
                return [ast.identifier, ...ast.type ? [ast.type] : [], ...ast.default ? [ast.default] : []];
            case ASTNodeKind.ListenerDefinition:
                return [...ast.parameters, ast.body];
            case ASTNodeKind.TypeDefinition:
                return [ast.name, ...ast.parameters];
            case ASTNodeKind.Program:
                return [...ast.comments, ...ast.definitions];
            case ASTNodeKind.Parameter:
                return [ast.name, ast.type];
            case ASTNodeKind.IfCase:
                return [ast.condition, ast.body];
            case ASTNodeKind.Pair:
                return [ast.key, ast.value];
            case ASTNodeKind.Comment:
                return [];
            case ASTNodeKind.TypeIdentifier:
                return [];
            case ASTNodeKind.GenericType:
                return [ast.name, ...ast.typeArguments];
            case ASTNodeKind.FunctionType:
                return [...ast.parameters, ast.returnType];
            case ASTNodeKind.Identifier:
                return [];

        }
    }

    static inRange({ start, end }: Range, position: Position) {
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

    static getLastPosition(str: string): Position {
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

    static readonly DUMMY_IDENTIFIER: Identifier = {
        kind: ASTNodeKind.Identifier,
        metadata: { extent: { start: { line: 0, col: 0 }, end: { line: 0, col: 0 } } },
        name: 'unknown!'
    }
}
