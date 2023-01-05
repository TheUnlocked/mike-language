import { Token } from '../parser/lexer';
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
    ParameterDefinition,
    StateDefinition,
    ListenerDefinition,
    TypeDefinition,
    Program,
    // Fragments
    Identifier,
    Parameter,
    IfCase,
    Pair,
    // Types
    TypeIdentifier,
    GenericType,
    FunctionType,
    // Misc
    Comment,
    OutOfTree,
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

interface ASTNode {
    readonly tokens?: readonly Token[];
    readonly trivia?: readonly Trivia[];
    readonly parent?: AnyNode;
}

export interface Comment extends ASTNode {
    readonly kind: ASTNodeKind.Comment;
    readonly content: string;
}

export type Trivia = Comment;

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
    readonly member: Identifier;
}

export interface Variable extends ExpressionNode {
    readonly kind: ASTNodeKind.Variable;
    readonly identifier: Identifier;
}

export interface Identifier extends ExpressionNode {
    readonly kind: ASTNodeKind.Identifier;
    readonly name: string;
}

export interface FloatLiteral extends ExpressionNode {
    readonly kind: ASTNodeKind.FloatLiteral;
    readonly value: number;
}

export interface IntLiteral extends ExpressionNode {
    readonly kind: ASTNodeKind.IntLiteral;
    readonly value: string;
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
    readonly type?: TypeIdentifier;
    readonly elements: readonly Expression[];
}

export interface Pair extends ASTNode {
    readonly kind: ASTNodeKind.Pair;
    readonly key: Expression;
    readonly value: Expression;
}

export interface MapLiteral extends ExpressionNode {
    readonly kind: ASTNodeKind.MapLiteral;
    readonly type?: TypeIdentifier;
    readonly pairs: readonly Pair[];
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
    readonly name: Identifier;
    readonly type?: Type;
    readonly value?: Expression;
}

export interface AssignVar extends StatementNode {
    readonly kind: ASTNodeKind.AssignVar;
    readonly variable: Identifier;
    readonly value: Expression;
}

export interface AssignField extends StatementNode {
    readonly kind: ASTNodeKind.AssignField;
    readonly obj: Expression;
    readonly member: Identifier;
    readonly value: Expression;
}

export interface IfCase extends StatementNode {
    readonly kind: ASTNodeKind.IfCase;
    readonly condition: Expression,
    readonly deconstruct?: Identifier, 
    readonly body: Block
}

export interface IfElseChain extends StatementNode {
    readonly kind: ASTNodeKind.IfElseChain;
    readonly cases: readonly IfCase[];
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

export interface ParameterDefinition extends ASTNode {
    readonly kind: ASTNodeKind.ParameterDefinition;
    readonly name: Identifier;
    readonly type: Type;
}

export interface StateDefinition extends ASTNode {
    readonly kind: ASTNodeKind.StateDefinition;
    readonly name: Identifier;
    readonly type?: Type;
    readonly default?: Expression;
}

export interface Parameter extends ASTNode {
    readonly kind: ASTNodeKind.Parameter;
    readonly name: Identifier;
    readonly type: Type;
}

export interface TypeIdentifier extends ASTNode {
    readonly kind: ASTNodeKind.TypeIdentifier;
    readonly name: string;
}

export interface GenericType extends ASTNode {
    readonly kind: ASTNodeKind.GenericType;
    readonly name: TypeIdentifier;
    readonly typeArguments: readonly Type[];
}

export interface FunctionType extends ASTNode {
    readonly kind: ASTNodeKind.FunctionType;
    readonly parameters: readonly Type[];
    readonly returnType: Type;
}

export type Type
    = TypeIdentifier
    | GenericType
    | FunctionType
    ;

export interface ListenerDefinition extends ASTNode {
    readonly kind: ASTNodeKind.ListenerDefinition;
    readonly event: string;
    readonly parameters: readonly Parameter[];
    readonly body: Block;
}

export interface TypeDefinition extends ASTNode {
    readonly kind: ASTNodeKind.TypeDefinition;
    readonly name: TypeIdentifier;
    readonly parameters: readonly Parameter[];
}

export type TopLevelDefinition
    = ParameterDefinition
    | StateDefinition
    | ListenerDefinition
    | TypeDefinition

export interface Program extends ASTNode {
    readonly kind: ASTNodeKind.Program;
    readonly definitions: readonly TopLevelDefinition[];
}

export interface ExternalVariableDefinition {
    readonly kind: ASTNodeKind.OutOfTree;
    readonly name: string;
    readonly type: KnownType;
}

export type VariableDefinition
    = ExternalVariableDefinition
    | ParameterDefinition
    | StateDefinition
    | TypeDefinition
    | LetStatement
    | Parameter
    | IfCase
    ;

export function isVariableDefinition(node: AnyNode): node is Exclude<VariableDefinition, ExternalVariableDefinition> {
    return node.kind === ASTNodeKind.ParameterDefinition
        || node.kind === ASTNodeKind.StateDefinition
        || node.kind === ASTNodeKind.TypeDefinition
        || node.kind === ASTNodeKind.LetStatement
        || node.kind === ASTNodeKind.Parameter
        || node.kind === ASTNodeKind.IfCase
        ;
}

type Fragment
    = Parameter
    | IfCase
    | Pair
    | Identifier
    ;

export type AnyNode
    = Expression
    | StatementOrBlock
    | TopLevelDefinition
    | Program
    | Fragment
    | Type
    | Comment
    ;

// TODO: Improve stringification
export function stringifyNode(node: AnyNode) {
    return JSON.stringify(node);
} 