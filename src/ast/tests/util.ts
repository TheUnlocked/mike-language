import { ExactType } from '../../types/TypeReference';
import { AssignField, AssignVar, ASTNodeKind, BinaryOp, Block, BoolLiteral, DebugStatement, DeclareVar, Dereference, Expression, ExpressionStatement, FloatLiteral, IfElseChain, InfixOperator, IntLiteral, Invoke, ListenerDefinition, MapLiteral, ParamDefinition, SequenceLiteral, StateDefinition, Statement, StringLiteral, Variable } from '../Ast';

export const makeInvokeNode              = <T>(fn: Expression<T>, args: readonly Expression<T>[], type: T): Invoke<T>                                                     =>
    ({ kind: ASTNodeKind.Invoke, fn, args, type });
export const makeInvokeNode_             = (fn: Expression<undefined>, args: readonly Expression<undefined>[]): Invoke<undefined>                                         =>
    ({ kind: ASTNodeKind.Invoke, fn, args, type: undefined });

export const makeBinaryOpNode            = <T>(op: InfixOperator, lhs: Expression<T>, rhs: Expression<T>, type: T): BinaryOp<T>                                           =>
    ({ kind: ASTNodeKind.BinaryOp, op, lhs, rhs, type });
export const makeBinaryOpNode_           = (op: InfixOperator, lhs: Expression<undefined>, rhs: Expression<undefined>): BinaryOp<undefined>                               =>
    ({ kind: ASTNodeKind.BinaryOp, op, lhs, rhs, type: undefined });

export const makeDereferenceNode         = <T>(obj: Expression<T>, memberName: string, type: T): Dereference<T>                                                           =>
    ({ kind: ASTNodeKind.Dereference, obj, memberName, type });
export const makeDereferenceNode_        = (obj: Expression<undefined>, memberName: string): Dereference<undefined>                                                       =>
    ({ kind: ASTNodeKind.Dereference, obj, memberName, type: undefined });

export const makeVariableNode            = <T>(name: string, type: T): Variable<T>                                                                                        =>
    ({ kind: ASTNodeKind.Variable, name, type });
export const makeVariableNode_           = (name: string): Variable<undefined>                                                                                            =>
    ({ kind: ASTNodeKind.Variable, name, type: undefined });

export const makeFloatLiteralNode        = <T>(value: number, type: T): FloatLiteral<T>                                                                                   =>
    ({ kind: ASTNodeKind.FloatLiteral, value, type });
export const makeFloatLiteralNode_       = (value: number): FloatLiteral<undefined>                                                                                       =>
    ({ kind: ASTNodeKind.FloatLiteral, value, type: undefined });

export const makeIntLiteralNode          = <T>(value: number, type: T): IntLiteral<T>                                                                                     =>
    ({ kind: ASTNodeKind.IntLiteral, value, type });
export const makeIntLiteralNode_         = (value: number): IntLiteral<undefined>                                                                                         =>
    ({ kind: ASTNodeKind.IntLiteral, value, type: undefined });

export const makeBoolLiteralNode         = <T>(value: boolean, type: T): BoolLiteral<T>                                                                                   =>
    ({ kind: ASTNodeKind.BoolLiteral, value, type });
export const makeBoolLiteralNode_        = (value: boolean): BoolLiteral<undefined>                                                                                       =>
    ({ kind: ASTNodeKind.BoolLiteral, value, type: undefined });

export const makeStringLiteralNode       = <T>(value: string, type: T): StringLiteral<T>                                                                                  =>
    ({ kind: ASTNodeKind.StringLiteral, value, type });
export const makeStringLiteralNode_      = (value: string): StringLiteral<undefined>                                                                                      =>
    ({ kind: ASTNodeKind.StringLiteral, value, type: undefined });

export const makeSequenceLiteralNode     = <T>(typeName: string | undefined, elements: readonly Expression<T>[], type: T): SequenceLiteral<T>                             =>
    ({ kind: ASTNodeKind.SequenceLiteral, typeName, elements, type });
export const makeSequenceLiteralNode_    = (typeName: string | undefined, elements: readonly Expression<undefined>[]): SequenceLiteral<undefined>                         =>
    ({ kind: ASTNodeKind.SequenceLiteral, typeName, elements, type: undefined });

export const makeMapLiteralNode          = <T>(typeName: string | undefined, pairs: [key: Expression<T>, value: Expression<T>][], type: T): MapLiteral<T>                 =>
    ({ kind: ASTNodeKind.MapLiteral, typeName, pairs, type });
export const makeMapLiteralNode_         = (typeName: string | undefined, pairs: [key: Expression<undefined>, value: Expression<undefined>][]): MapLiteral<undefined>     =>
    ({ kind: ASTNodeKind.MapLiteral, typeName, pairs, type: undefined });

export const makeExpressionStatementNode = <T>(expr: Expression<T>): ExpressionStatement<T>                                                                               =>
    ({ kind: ASTNodeKind.ExpressionStatement, expr });

export const makeDeclareVarNode          = <T>(name: string, type: ExactType, value?: Expression<T>): DeclareVar<T>                                                       =>
    ({ kind: ASTNodeKind.DeclareVar, name, type, value });

export const makeAssignVarNode           = <T>(name: string, value: Expression<T>): AssignVar<T>                                                                          =>
    ({ kind: ASTNodeKind.AssignVar, name, value });

export const makeAssignFieldNode         = <T>(obj: Expression<T>, memberName: string, value: Expression<T>): AssignField<T>                                              =>
    ({ kind: ASTNodeKind.AssignField, obj, memberName, value });

export const makeIfElseChainNode         = <T>(conditions: readonly [Expression<T>, Block<T>][], $else: Block<T> | undefined): IfElseChain<T>                             =>
    ({ kind: ASTNodeKind.IfElseChain, conditions, else: $else });

export const makeDebugStatementNode      = <T>($arguments: readonly Expression<T>[]): DebugStatement<T>                                                                   =>
    ({ kind: ASTNodeKind.DebugStatement, arguments: $arguments });

export const makeBlockNode               = <T>(statements: readonly Statement<T>[]): Block<T>                                                                             =>
    ({ kind: ASTNodeKind.Block, statements });

export const makeParamDefinitionNode     = <T>(name: string, type: ExactType): ParamDefinition<T>                                                                         =>
    ({ kind: ASTNodeKind.ParamDefinition, name, type });

export const makeStateDefinitionNode     = <T>(name: string, type: ExactType, _default?: Expression<T>): StateDefinition<T>                                               =>
    ({ kind: ASTNodeKind.StateDefinition, name, type });

export const makeListenerDefinitionNode  = <T>(event: string, parameters: readonly [string, Expression<T>][], statements: readonly Statement<T>[]): ListenerDefinition<T> =>
    ({ kind: ASTNodeKind.ListenerDefinition, event, parameters, statements });
