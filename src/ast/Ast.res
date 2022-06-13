open Types

type binaryOp =
    | Add
    | Subtract
    | Multiply
    | Divide

type rec _untypedExprNode<'t> =
    | Invoke({ fn: _typedExprNode<'t>, args: array<_typedExprNode<'t>> })
    | BinaryOp({ op: binaryOp, left: _typedExprNode<'t>, right: _typedExprNode<'t> })
    | Dereference(_typedExprNode<'t>, string)
    | Variable(string)
    | FloatLiteral(float)
    | IntLiteral(int)
    | BoolLiteral(bool)
    | StringLiteral(string)
    | SequenceLiteral({ typeName: option<string>, values: array<_typedExprNode<'t>> })
    | MapLiteral({ typeName: option<string>, keys: array<_typedExprNode<'t>>, values: array<_typedExprNode<'t>> })
@genType.opaque
and _typedExprNode<'t> = {
    @as("type") _type: 't,
    node: _untypedExprNode<'t>,
}

@genType type untypedExprNode = _typedExprNode<unit>
@genType type typedExprNode = _typedExprNode<knownType>
@genType type exactlyTypedExprNode = _typedExprNode<exactType>

@genType let makeInvokeNode =           (. fn, args, _type) => { _type, node: Invoke({ fn, args }) }
@genType let makeBinaryOpNode =         (. op, left, right, _type) => { _type, node: BinaryOp({ op, left, right }) }
@genType let makeDereferenceNode =      (. o, n, _type) => { _type, node: Dereference(o, n) }
@genType let makeVariableNode =         (. n, _type) => { _type, node: Variable(n) }
@genType let makeFloatLiteralNode =     (. v, _type) => { _type, node: FloatLiteral(v) }
@genType let makeIntLiteralNode =       (. v, _type) => { _type, node: IntLiteral(v) }
@genType let makeBoolLiteralNode =      (. v, _type) => { _type, node: BoolLiteral(v) }
@genType let makeStringLiteralNode =    (. v, _type) => { _type, node: StringLiteral(v) }
@genType let makeSequenceLiteralNode =  (. typeName, values, _type) => { _type, node: SequenceLiteral({ typeName, values }) }
@genType let makeMapLiteralNode =       (. typeName, keys, values, _type) => { _type, node: MapLiteral({ typeName, keys, values }) }
@genType let makeInvokeNode_ =          (. fn, args) => { _type: (), node: Invoke({ fn, args }) }
@genType let makeBinaryOpNode_ =        (. op, left, right) => { _type: (), node: BinaryOp({ op, left, right }) }
@genType let makeDereferenceNode_ =     (. o, n ) => { _type: (), node: Dereference(o, n) }
@genType let makeVariableNode_ =        (. n) => { _type: (), node: Variable(n) }
@genType let makeFloatLiteralNode_ =    (. v) => { _type: (), node: FloatLiteral(v) }
@genType let makeIntLiteralNode_ =      (. v) => { _type: (), node: IntLiteral(v) }
@genType let makeBoolLiteralNode_ =     (. v) => { _type: (), node: BoolLiteral(v) }
@genType let makeStringLiteralNode_ =   (. v) => { _type: (), node: StringLiteral(v) }
@genType let makeSequenceLiteralNode_ = (. typeName, values) => { _type: (), node: SequenceLiteral({ typeName, values }) }
@genType let makeMapLiteralNode_ =      (. typeName, keys, values) => { _type: (), node: MapLiteral({ typeName, keys, values }) }

@genType let typeOf = ({ _type }: _typedExprNode<'t>) => _type;

@genType.opaque
type rec statementNode =
    | ExpressionStatement(exactlyTypedExprNode)
    | DeclareVar({ name: string, @as("type") _type: exactType, value: option<exactlyTypedExprNode> })
    | AssignVar({ name: string, value: exactlyTypedExprNode })
    | AssignField({ object: exactlyTypedExprNode, name: string, value: exactlyTypedExprNode })
    | IfStatement({ cases: array<(exactlyTypedExprNode, option<string>, statementNode)>, @as("else") _else: statementNode })
    | DebugStatement(array<exactlyTypedExprNode>)
    | Block(array<statementNode>)

@genType let makeExpressionStatementNode =  (. e) => ExpressionStatement(e)
@genType let makeDeclareVarNode =           (. name, _type, value) => DeclareVar({ name, _type, value })
@genType let makeAssignVarNode =            (. name, value) => AssignVar({ name, value })
@genType let makeAssignFieldNode =          (. object, name, value) => AssignField({ object, name, value })
@genType let makeIfStatementNode =          (. cases, _else) => IfStatement({ cases, _else })
@genType let makeDebugStatementNode =       (. v) => DebugStatement(v)
@genType let makeBlockNode =                (. statements) => statements

@genType.opaque
type stateDefNode = {
    name: string,
    @as("type") _type: exactType,
    default: option<exactlyTypedExprNode>,
}

@genType let makeStateDefinitionNode = (. name, _type, default) => { name, _type, default }

@genType.opaque
type paramDefNode = {
    name: string,
    @as("type") _type: exactType,
}

@genType let makeParamDefinitionNode = (. name, _type) => { name, _type }

@genType.opaque
type listenerDefNode = {
    event: string,
    params: array<paramDefNode>,
    statements: array<statementNode>
}

@genType let makeListenerDefinitionNode = (. event, params, statements) => { event, params, statements }

@genType.opaque
type programNode = {
    params: array<paramDefNode>,
    state: array<stateDefNode>,
    listeners: array<listenerDefNode>,
}

@genType let makeProgramNode = (. params, state, listeners) => { params, state, listeners }
