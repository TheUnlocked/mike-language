@genType
type t<'err>

@module("./Exception")
external raiseMiKe: t<'err> => 'a = "throwMiKeError"

@module("./Exception")
@new external semanticErrorUntyped: (Ast.untypedExprNode, 'err) => t<'err> = "MiKeSemanticError"

@module("./Exception")
@new external semanticErrorTyped: (Ast.typedExprNode, 'err) => t<'err> = "MiKeSemanticError"

@module("./Exception")
@new external semanticErrorExactlyTyped: (Ast.exactlyTypedExprNode, 'err) => t<'err> = "MiKeSemanticError"
