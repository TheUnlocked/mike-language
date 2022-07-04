import { ExactType } from '../../types/TypeReference';
import { AssignField, AssignVar, ASTNodeKind, BinaryOp, Block, BoolLiteral, DebugStatement, DeclareVar, Dereference, Expression, ExpressionStatement, FloatLiteral, IfElseChain, InfixOperator, IntLiteral, Invoke, ListenerDefinition, MapLiteral, ParamDefinition, PrefixOperator, SequenceLiteral, StateDefinition, Statement, StringLiteral, UnaryOp, Variable } from '../Ast';

function node<T>(x: T): T {
    return x;
}

export const makeInvokeNode              = <T>(fn: Expression<T>, args: readonly Expression<T>[], type: T): Invoke<T>                                                     =>
    node({ kind: ASTNodeKind.Invoke, fn, args, type });
export const makeInvokeNode_             = (fn: Expression<undefined>, args: readonly Expression<undefined>[]): Invoke<undefined>                                         =>
    node({ kind: ASTNodeKind.Invoke, fn, args, type: undefined });

export const makeBinaryOpNode            = <T>(op: InfixOperator, lhs: Expression<T>, rhs: Expression<T>, type: T): BinaryOp<T>                                           =>
    node({ kind: ASTNodeKind.BinaryOp, op, lhs, rhs, type });
export const makeBinaryOpNode_           = (op: InfixOperator, lhs: Expression<undefined>, rhs: Expression<undefined>): BinaryOp<undefined>                               =>
    node({ kind: ASTNodeKind.BinaryOp, op, lhs, rhs, type: undefined });

export const makeUnaryOpNode            = <T>(op: PrefixOperator, expr: Expression<T>, type: T): UnaryOp<T>                                                               =>
    node({ kind: ASTNodeKind.UnaryOp, op, expr, type });
export const makeUnaryOpNode_           = (op: PrefixOperator, expr: Expression<undefined>): UnaryOp<undefined>                                                           =>
    node({ kind: ASTNodeKind.UnaryOp, op, expr, type: undefined });

export const makeDereferenceNode         = <T>(obj: Expression<T>, memberName: string, type: T): Dereference<T>                                                           =>
    node({ kind: ASTNodeKind.Dereference, obj, memberName, type });
export const makeDereferenceNode_        = (obj: Expression<undefined>, memberName: string): Dereference<undefined>                                                       =>
    node({ kind: ASTNodeKind.Dereference, obj, memberName, type: undefined });

export const makeVariableNode            = <T>(name: string, type: T): Variable<T>                                                                                        =>
    node({ kind: ASTNodeKind.Variable, name, type });
export const makeVariableNode_           = (name: string): Variable<undefined>                                                                                            =>
    node({ kind: ASTNodeKind.Variable, name, type: undefined });

export const makeFloatLiteralNode        = <T>(value: number, type: T): FloatLiteral<T>                                                                                   =>
    node({ kind: ASTNodeKind.FloatLiteral, value, type });
export const makeFloatLiteralNode_       = (value: number): FloatLiteral<undefined>                                                                                       =>
    node({ kind: ASTNodeKind.FloatLiteral, value, type: undefined });

export const makeIntLiteralNode          = <T>(value: number, type: T): IntLiteral<T>                                                                                     =>
    node({ kind: ASTNodeKind.IntLiteral, value, type });
export const makeIntLiteralNode_         = (value: number): IntLiteral<undefined>                                                                                         =>
    node({ kind: ASTNodeKind.IntLiteral, value, type: undefined });

export const makeBoolLiteralNode         = <T>(value: boolean, type: T): BoolLiteral<T>                                                                                   =>
    node({ kind: ASTNodeKind.BoolLiteral, value, type });
export const makeBoolLiteralNode_        = (value: boolean): BoolLiteral<undefined>                                                                                       =>
    node({ kind: ASTNodeKind.BoolLiteral, value, type: undefined });

export const makeStringLiteralNode       = <T>(value: string, type: T): StringLiteral<T>                                                                                  =>
    node({ kind: ASTNodeKind.StringLiteral, value, type });
export const makeStringLiteralNode_      = (value: string): StringLiteral<undefined>                                                                                      =>
    node({ kind: ASTNodeKind.StringLiteral, value, type: undefined });

export const makeSequenceLiteralNode     = <T>(typeName: string | undefined, elements: readonly Expression<T>[], type: T): SequenceLiteral<T>                             =>
    node({ kind: ASTNodeKind.SequenceLiteral, typeName, elements, type });
export const makeSequenceLiteralNode_    = (typeName: string | undefined, elements: readonly Expression<undefined>[]): SequenceLiteral<undefined>                         =>
    node({ kind: ASTNodeKind.SequenceLiteral, typeName, elements, type: undefined });

export const makeMapLiteralNode          = <T>(typeName: string | undefined, pairs: [key: Expression<T>, value: Expression<T>][], type: T): MapLiteral<T>                 =>
    node({ kind: ASTNodeKind.MapLiteral, typeName, pairs, type });
export const makeMapLiteralNode_         = (typeName: string | undefined, pairs: [key: Expression<undefined>, value: Expression<undefined>][]): MapLiteral<undefined>     =>
    node({ kind: ASTNodeKind.MapLiteral, typeName, pairs, type: undefined });

export const makeExpressionStatementNode = <T>(expr: Expression<T>): ExpressionStatement<T>                                                                               =>
    node({ kind: ASTNodeKind.ExpressionStatement, expr });

export const makeDeclareVarNode          = <T>(name: string, type: ExactType | undefined, value: Expression<T> | undefined): DeclareVar<T>                                =>
    node({ kind: ASTNodeKind.DeclareVar, name, type, value });

export const makeAssignVarNode           = <T>(name: string, value: Expression<T>): AssignVar<T>                                                                          =>
    node({ kind: ASTNodeKind.AssignVar, name, value });

export const makeAssignFieldNode         = <T>(obj: Expression<T>, memberName: string, value: Expression<T>): AssignField<T>                                              =>
    node({ kind: ASTNodeKind.AssignField, obj, memberName, value });

export const makeIfElseChainNode         = <T>(cases: IfElseChain<T>['cases'], $else: Block<T> | undefined): IfElseChain<T>                                               =>
    node({ kind: ASTNodeKind.IfElseChain, cases: cases.map(x => ({ deconstructName: undefined, ...x })), else: $else });

export const makeDebugStatementNode      = <T>($arguments: readonly Expression<T>[]): DebugStatement<T>                                                                   =>
    node({ kind: ASTNodeKind.DebugStatement, arguments: $arguments });

export const makeBlockNode               = <T>(statements: readonly Statement<T>[]): Block<T>                                                                             =>
    node({ kind: ASTNodeKind.Block, statements });

export const makeParamDefinitionNode     = <T>(name: string, type: ExactType): ParamDefinition<T>                                                                         =>
    node({ kind: ASTNodeKind.ParamDefinition, name, type });

export const makeStateDefinitionNode     = <T>(name: string, type: ExactType, _default?: Expression<T>): StateDefinition<T>                                               =>
    node({ kind: ASTNodeKind.StateDefinition, name, type });

export const makeListenerDefinitionNode  = <T>(event: string, parameters: ListenerDefinition<T>['parameters'], statements: readonly Statement<T>[]): ListenerDefinition<T> =>
    node({ kind: ASTNodeKind.ListenerDefinition, event, parameters, statements });
