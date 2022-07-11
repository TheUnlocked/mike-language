import { ExactType } from '../types/TypeReference';

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
    DeclareVar,
    AssignVar,
    AssignField,
    IfElseChain,
    DebugStatement,
    Block,
    // Others
    ParamDefinition,
    StateDefinition,
    ListenerDefinition,
    TypeDefinition,
    Program,
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

export interface Location {
    file?: string;
    start: { line: number, col: number };
    end: { line: number, col: number };
}

export interface AstMetadata {
    location: Location;
}

interface ASTNode {
    metadata?: AstMetadata;
}

interface ExpressionNode<T> extends ASTNode {
    readonly type: T;
}

export interface Invoke<T> extends ExpressionNode<T> {
    readonly kind: ASTNodeKind.Invoke;
    readonly fn: Expression<T>;
    readonly args: readonly Expression<T>[];
}

export interface BinaryOp<T> extends ExpressionNode<T> {
    readonly kind: ASTNodeKind.BinaryOp;
    readonly op: InfixOperator;
    readonly lhs: Expression<T>;
    readonly rhs: Expression<T>;
}

export interface UnaryOp<T> extends ExpressionNode<T> {
    readonly kind: ASTNodeKind.UnaryOp;
    readonly op: PrefixOperator;
    readonly expr: Expression<T>;
}

export interface Dereference<T> extends ExpressionNode<T> {
    readonly kind: ASTNodeKind.Dereference;
    readonly obj: Expression<T>;
    readonly memberName: string;
}

export interface Variable<T> extends ExpressionNode<T> {
    readonly kind: ASTNodeKind.Variable;
    readonly name: string;
}

export interface FloatLiteral<T> extends ExpressionNode<T> {
    readonly kind: ASTNodeKind.FloatLiteral;
    readonly value: number;
}

export interface IntLiteral<T> extends ExpressionNode<T> {
    readonly kind: ASTNodeKind.IntLiteral;
    readonly value: number;
}

export interface BoolLiteral<T> extends ExpressionNode<T> {
    readonly kind: ASTNodeKind.BoolLiteral;
    readonly value: boolean;
}

export interface StringLiteral<T> extends ExpressionNode<T> {
    readonly kind: ASTNodeKind.StringLiteral;
    readonly value: string;
}

export interface SequenceLiteral<T> extends ExpressionNode<T> {
    readonly kind: ASTNodeKind.SequenceLiteral;
    readonly typeName?: string;
    readonly elements: readonly Expression<T>[];
}

export interface MapLiteral<T> extends ExpressionNode<T> {
    readonly kind: ASTNodeKind.MapLiteral;
    readonly typeName?: string;
    readonly pairs: readonly (readonly [key: Expression<T>, value: Expression<T>])[];
}

export type Expression<T>
    = Invoke<T>
    | BinaryOp<T>
    | UnaryOp<T>
    | Dereference<T>
    | Variable<T>
    | FloatLiteral<T>
    | IntLiteral<T>
    | BoolLiteral<T>
    | StringLiteral<T>
    | SequenceLiteral<T>
    | MapLiteral<T>
    ;

export interface ExpressionStatement<T> extends ASTNode {
    readonly kind: ASTNodeKind.ExpressionStatement;
    readonly expr: Expression<T>;
}

export interface DeclareVar<T> extends ASTNode {
    readonly kind: ASTNodeKind.DeclareVar;
    readonly name: string;
    readonly type?: ExactType;
    readonly value?: Expression<T>;
}

export interface AssignVar<T> extends ASTNode {
    readonly kind: ASTNodeKind.AssignVar;
    readonly name: string;
    readonly value: Expression<T>;
}

export interface AssignField<T> extends ASTNode {
    readonly kind: ASTNodeKind.AssignField;
    readonly obj: Expression<T>;
    readonly memberName: string;
    readonly value: Expression<T>;
}

export interface IfElseChain<T> extends ASTNode {
    readonly kind: ASTNodeKind.IfElseChain;
    readonly cases: {
        readonly condition: Expression<T>,
        readonly deconstructName?: string, 
        readonly body: Block<T>
    }[];
    readonly else?: Block<T>;
}

export interface DebugStatement<T> extends ASTNode {
    readonly kind: ASTNodeKind.DebugStatement;
    readonly arguments: readonly Expression<T>[];
}

export interface Block<T> extends ASTNode {
    readonly kind: ASTNodeKind.Block;
    readonly statements: readonly Statement<T>[];
}

export type Statement<T>
    = ExpressionStatement<T>
    | DeclareVar<T>
    | AssignVar<T>
    | AssignField<T>
    | IfElseChain<T>
    | DebugStatement<T>
    | Block<T>
    ;

export interface ParamDefinition<T> extends ASTNode {
    readonly kind: ASTNodeKind.ParamDefinition;
    readonly name: string;
    readonly type: ExactType;
}

export interface StateDefinition<T> extends ASTNode {
    readonly kind: ASTNodeKind.StateDefinition;
    readonly name: string;
    readonly type: ExactType extends T ? ExactType : ExactType | undefined;
    readonly default?: Expression<T>;
}

export interface ListenerDefinition<T> extends ASTNode {
    readonly kind: ASTNodeKind.ListenerDefinition;
    readonly event: string;
    readonly parameters: readonly {
        readonly name: string;
        readonly type: ExactType;
    }[];
    readonly body: Block<T>;
}

export interface TypeDefinition<T> extends ASTNode {
    readonly kind: ASTNodeKind.TypeDefinition;
    readonly parameters: readonly {
        readonly name: string;
        readonly type: ExactType;
    }[];
}

export interface Program<T> extends ASTNode {
    readonly kind: ASTNodeKind.Program;
    readonly params: readonly ParamDefinition<T>[];
    readonly state: readonly StateDefinition<T>[];
    readonly listeners: readonly ListenerDefinition<T>[];
    readonly types: readonly TypeDefinition<T>[];
}

export type AnyNode<T>
    = Expression<T>
    | Statement<T>
    | ParamDefinition<T>
    | StateDefinition<T>
    | ListenerDefinition<T>
    | TypeDefinition<T>
    | Program<T>
    ;
