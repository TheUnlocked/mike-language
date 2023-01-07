import { expectNever } from '../utils/types';
import { AnyNode, ASTNodeKind, Identifier, VariableDefinition, TypeIdentifier } from './Ast';

export interface Position {
    readonly line: number;
    readonly col: number;
}

export interface Range {
    readonly start: Position;
    readonly end: Position;
}

const OUT_OF_TREE_POSITION: Position = { line: 0, col: 0 };
const OUT_OF_TREE_RANGE: Range = { start: OUT_OF_TREE_POSITION, end: OUT_OF_TREE_POSITION };

export const DUMMY_IDENTIFIER: Identifier = {
    kind: ASTNodeKind.Identifier,
    name: 'unknown!'
};

export function getNodePosition(ast: AnyNode): Position {
    if (ast.tokens && ast.tokens.length > 0) {
        return ast.tokens[0].range.start;
    }
    return OUT_OF_TREE_POSITION;
}

export function getNodeSourceRange(ast: AnyNode): Range {
    if (ast.tokens && ast.tokens.length > 0) {
        return {
            start: ast.tokens[0].range.start,
            end: ast.tokens.at(-1)!.range.end,
        };
    }
    return OUT_OF_TREE_RANGE;
}

export function getNodeAt(ast: AnyNode, position: Position): AnyNode | undefined {
    if (!inRange(getNodeSourceRange(ast), position)) {
        return undefined;
    }
    let node = ast;
    main: while (true) {
        for (const child of getChildren(node)) {
            if (inRange(getNodeSourceRange(child), position)) {
                node = child;
                continue main;
            }
        }
        return node;
    }
}

export function getNonTriviaChildren(ast: AnyNode): readonly AnyNode[] {
    switch (ast.kind) {
        default: expectNever(ast);
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
            return [ast.name, ast.type];
        case ASTNodeKind.StateDefinition:
            return [ast.name, ...ast.type ? [ast.type] : [], ...ast.default ? [ast.default] : []];
        case ASTNodeKind.ListenerDefinition:
            return [...ast.parameters, ast.body];
        case ASTNodeKind.TypeDefinition:
            return [ast.name, ...ast.parameters];
        case ASTNodeKind.Program:
            return ast.definitions;
        case ASTNodeKind.Parameter:
            return [ast.name, ast.type];
        case ASTNodeKind.IfCase:
            return [ast.condition, ...ast.deconstruct ? [ast.deconstruct]: [], ast.body];
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

export function getChildren(ast: AnyNode): readonly AnyNode[] {
    return getNonTriviaChildren(ast).concat(ast.trivia ?? []);
}

export function intersectsRange(r1: Range, r2: Range) {
    if (positionEquals(r1.start, r2.start)) {
        return true;
    }
    if (isAfter(r2.start, r1.start)) {
        // r1 starts before r2
        return isAfter(r1.end, r2.start);
    }
    else {
        // r2 starts before r1
        return isAfter(r2.end, r1.start);
    }
}

export function inRange({ start, end }: Range, position: Position) {
    if (position.line >= start.line && position.line <= end.line) {
        if (position.line === start.line) {
            if (position.line === end.line) {
                return position.col >= start.col && position.col < end.col;
            }
            return position.col >= start.col;
        }
        else if (position.line === end.line) {
            return position.col < end.col;
        }
        return true;
    }
    return false;
}

export function isAfter(position: Position, comparedTo: Position) {
    if (position.line > comparedTo.line) {
        return true;
    }
    if (position.line === comparedTo.line && position.col > comparedTo.col) {
        return true;
    }
    return false;
}

export function positionEquals(p1: Position, p2: Position) {
    return p1.line === p2.line && p1.col === p2.col;
}

export function getLastPosition(str: string): Position {
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

export function stringifyPosition(pos: Position) {
    return `${pos.line}:${pos.col}`;
}

export function stringifyRange(range: Range) {
    return `${stringifyPosition(range.start)}-${stringifyPosition(range.end)}`
}

export function getVariableDefinitionIdentifier(def: VariableDefinition): Identifier | TypeIdentifier {
    switch (def.kind) {
        case ASTNodeKind.IfCase:
            return def.deconstruct!;
        case ASTNodeKind.LetStatement:
        case ASTNodeKind.Parameter:
        case ASTNodeKind.ParameterDefinition:
        case ASTNodeKind.StateDefinition:
        case ASTNodeKind.TypeDefinition:
            return def.name;
        case ASTNodeKind.OutOfTree:
            return DUMMY_IDENTIFIER;
    }
}

/**
 * @param ast 
 * @param visitor A function which is called on every visited node. Return true to prevent visiting the node's children.
 */
export function visit(ast: AnyNode, visitor: (node: AnyNode) => boolean | void) {
    if (!visitor(ast)) {
        for (const child of getChildren(ast)) {
            visit(child, visitor);
        }
    }
}
