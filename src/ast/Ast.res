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
    | SequenceLiteral(array<_typedExprNode<'t>>)
    | MapLiteral({ keys: array<_typedExprNode<'t>>, values: array<_typedExprNode<'t>> })
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
@genType let makeSequenceLiteralNode =  (. v, _type) => { _type, node: SequenceLiteral(v) }
@genType let makeMapLiteralNode =       (. keys, values, _type) => { _type, node: MapLiteral({ keys, values }) }
@genType let makeInvokeNode_ =          (. fn, args ) => { _type: (), node: Invoke({ fn, args }) }
@genType let makeBinaryOpNode_ =        (. op, left, right ) => { _type: (), node: BinaryOp({ op, left, right }) }
@genType let makeDereferenceNode_ =     (. o, n ) => { _type: (), node: Dereference(o, n) }
@genType let makeVariableNode_ =        (. n) => { _type: (), node: Variable(n) }
@genType let makeFloatLiteralNode_ =    (. v) => { _type: (), node: FloatLiteral(v) }
@genType let makeIntLiteralNode_ =      (. v) => { _type: (), node: IntLiteral(v) }
@genType let makeBoolLiteralNode_ =     (. v) => { _type: (), node: BoolLiteral(v) }
@genType let makeSequenceLiteralNode_ = (. v) => { _type: (), node: SequenceLiteral(v) }
@genType let makeMapLiteralNode_ =      (. keys, values ) => { _type: (), node: MapLiteral({ keys, values }) }

@genType let typeOf = ({ _type }: _typedExprNode<'t>) => _type;

type rec statementNode<'t> =
    | ExpressionStatement(_typedExprNode<'t>)
    | DeclareVar({ name: string, @as("type") _type: exactType, value: option<_typedExprNode<'t>> })
    | AssignVar({ name: string, value: _typedExprNode<'t> })
    | AssignField({ object: _typedExprNode<'t>, name: string, value: _typedExprNode<'t> })
    | IfStatement({ cases: (_typedExprNode<'t>, array<statementNode<'t>>), @as("else") _else: array<statementNode<'t>> })
    | DebugStatement(array<_typedExprNode<'t>>)

type stateDef<'t> = {
    name: string,
    @as("type") _type: exactType,
    default: option<_typedExprNode<'t>>,
}

type paramDef = {
    name: string,
    @as("type") _type: exactType,
}

type listenerDef<'t> = {
    event: string,
    params: array<paramDef>,
    statements: array<statementNode<'t>>
}

type program<'t> = {
    params: paramDef,
    state: stateDef<'t>,
    listeners: listenerDef<'t>,
}
