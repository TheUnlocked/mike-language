import { KnownType } from '../types/KnownType';

export enum ASTNodeKind {
    // Expressions
    Invoke,
    BinaryOp,
    UnaryOp,
    Dereference,
    Variable,
    FloatLiteral,
    IntLiteral,
    BoolLiteral,
    StringLiteral,
    SequenceLiteral,
    MapLiteral,
    // Statements
    ExpressionStatement,
    LetStatement,
    AssignVar,
    AssignField,
    IfElseChain,
    DebugStatement,
    Block,
    // Top-level
    ParamDefinition,
    StateDefinition,
    ListenerDefinition,
    TypeDefinition,
    Program,
    // Fragments
    ParameterFragment,
    IfCaseFragment,
    PairFragment,
    // Misc
    Comment,
}

export enum InfixOperator {
    // Arithmetic
    Add,
    Subtract,
    Multiply,
    Divide,
    // Comparison
    Equals,
    NotEquals,
    LessThan,
    LessThanEqual,
    GreaterThan,
    GreaterThanEqual,
    // Logical
    And,
    Or,
}

export enum PrefixOperator {
    Minus,
    Not,
}

export interface Position {
    line: number;
    col: number;
}

export interface Range {
    start: Position;
    end: Position;
}

export interface AstMetadata {
    extent: Range;
}

interface ASTNode {
    readonly metadata: AstMetadata;
}

interface ExpressionNode extends ASTNode {

}

export interface Invoke extends ExpressionNode {
    readonly kind: ASTNodeKind.Invoke;
    readonly fn: Expression;
    readonly args: readonly Expression[];
}

export interface BinaryOp extends ExpressionNode {
    readonly kind: ASTNodeKind.BinaryOp;
    readonly op: InfixOperator;
    readonly lhs: Expression;
    readonly rhs: Expression;
}

export interface UnaryOp extends ExpressionNode {
    readonly kind: ASTNodeKind.UnaryOp;
    readonly op: PrefixOperator;
    readonly expr: Expression;
}

export interface Dereference extends ExpressionNode {
    readonly kind: ASTNodeKind.Dereference;
    readonly obj: Expression;
    readonly memberName: string;
}

export interface Variable extends ExpressionNode {
    readonly kind: ASTNodeKind.Variable;
    readonly name: string;
}

export interface FloatLiteral extends ExpressionNode {
    readonly kind: ASTNodeKind.FloatLiteral;
    readonly value: number;
}

export interface IntLiteral extends ExpressionNode {
    readonly kind: ASTNodeKind.IntLiteral;
    readonly value: number;
}

export interface BoolLiteral extends ExpressionNode {
    readonly kind: ASTNodeKind.BoolLiteral;
    readonly value: boolean;
}

export interface StringLiteral extends ExpressionNode {
    readonly kind: ASTNodeKind.StringLiteral;
    readonly value: string;
}

export interface SequenceLiteral extends ExpressionNode {
    readonly kind: ASTNodeKind.SequenceLiteral;
    readonly typeName?: string;
    readonly elements: readonly Expression[];
}

export interface PairFragment extends ASTNode {
    readonly kind: ASTNodeKind.PairFragment;
    readonly key: Expression;
    readonly value: Expression;
}

export interface MapLiteral extends ExpressionNode {
    readonly kind: ASTNodeKind.MapLiteral;
    readonly typeName?: string;
    readonly pairs: readonly PairFragment[];
}

export type Expression
    = Invoke
    | BinaryOp
    | UnaryOp
    | Dereference
    | Variable
    | FloatLiteral
    | IntLiteral
    | BoolLiteral
    | StringLiteral
    | SequenceLiteral
    | MapLiteral
    ;

export function isExpression(node: AnyNode): node is Expression {
    return node.kind === ASTNodeKind.Invoke
        || node.kind === ASTNodeKind.BinaryOp
        || node.kind === ASTNodeKind.UnaryOp
        || node.kind === ASTNodeKind.Dereference
        || node.kind === ASTNodeKind.Variable
        || node.kind === ASTNodeKind.FloatLiteral
        || node.kind === ASTNodeKind.BoolLiteral
        || node.kind === ASTNodeKind.StringLiteral
        || node.kind === ASTNodeKind.SequenceLiteral
        || node.kind === ASTNodeKind.MapLiteral
        ;
}

interface StatementNode extends ASTNode {

}

export interface ExpressionStatement extends StatementNode {
    readonly kind: ASTNodeKind.ExpressionStatement;
    readonly expr: Expression;
}

export interface LetStatement extends StatementNode {
    readonly kind: ASTNodeKind.LetStatement;
    readonly name: string;
    readonly type?: KnownType;
    readonly value?: Expression;
}

export interface AssignVar extends StatementNode {
    readonly kind: ASTNodeKind.AssignVar;
    readonly name: string;
    readonly value: Expression;
}

export interface AssignField extends StatementNode {
    readonly kind: ASTNodeKind.AssignField;
    readonly obj: Expression;
    readonly memberName: string;
    readonly value: Expression;
}

export interface IfCaseFragment extends StatementNode {
    readonly kind: ASTNodeKind.IfCaseFragment;
    readonly condition: Expression,
    readonly deconstructName?: string, 
    readonly body: Block
}

export interface IfElseChain extends StatementNode {
    readonly kind: ASTNodeKind.IfElseChain;
    readonly cases: readonly IfCaseFragment[];
    readonly else?: Block;
}

export interface DebugStatement extends StatementNode {
    readonly kind: ASTNodeKind.DebugStatement;
    readonly arguments: readonly Expression[];
}

export type Statement
    = ExpressionStatement
    | LetStatement
    | AssignVar
    | AssignField
    | IfElseChain
    | DebugStatement
    ;

export function isStatement(node: AnyNode): node is Statement {
    return node.kind === ASTNodeKind.ExpressionStatement
        || node.kind === ASTNodeKind.LetStatement
        || node.kind === ASTNodeKind.AssignVar
        || node.kind === ASTNodeKind.AssignField
        || node.kind === ASTNodeKind.IfElseChain
        || node.kind === ASTNodeKind.DebugStatement
        ;
}

export interface Block extends ASTNode {
    readonly kind: ASTNodeKind.Block;
    readonly statements: readonly StatementOrBlock[];
}

export type StatementOrBlock
    = Statement
    | Block
    ;

export interface ParamDefinition extends ASTNode {
    readonly kind: ASTNodeKind.ParamDefinition;
    readonly name: string;
    readonly type: KnownType;
}

export interface StateDefinition extends ASTNode {
    readonly kind: ASTNodeKind.StateDefinition;
    readonly name: string;
    readonly type?: KnownType;
    readonly default?: Expression;
}

export interface ParameterFragment extends ASTNode {
    readonly kind: ASTNodeKind.ParameterFragment;
    readonly name: string;
    readonly type: KnownType;
}

export interface ListenerDefinition extends ASTNode {
    readonly kind: ASTNodeKind.ListenerDefinition;
    readonly event: string;
    readonly parameters: readonly ParameterFragment[];
    readonly body: Block;
}

export interface TypeDefinition extends ASTNode {
    readonly kind: ASTNodeKind.TypeDefinition;
    readonly parameters: readonly {
        readonly name: string;
        readonly type: KnownType;
    }[];
}

export type TopLevelDefinition
    = ParamDefinition
    | StateDefinition
    | ListenerDefinition
    | TypeDefinition

export interface Comment extends ASTNode {
    readonly kind: ASTNodeKind.Comment;
    readonly content: string;
}

export interface Program extends ASTNode {
    readonly kind: ASTNodeKind.Program;
    readonly definitions: readonly TopLevelDefinition[];
    readonly comments: readonly Comment[];
}

export type VariableDefinition
    = ParamDefinition
    | StateDefinition
    | LetStatement
    | ParameterFragment
    | IfCaseFragment
    ;

// There's nothing fundamentally relating different fragment nodes,
// but they're still grouped together so it's easier to include them in AnyNode.
// For that reason, Fragment is not exported.
type Fragment
    = ParameterFragment
    | IfCaseFragment
    | PairFragment
    ;

export type AnyNode
    = Expression
    | StatementOrBlock
    | TopLevelDefinition
    | Program
    | Fragment
    | Comment
    ;

// TODO: Improve stringification
export default function stringifyNode(node: AnyNode) {
    return JSON.stringify(node);
} 