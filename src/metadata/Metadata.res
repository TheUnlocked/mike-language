open Ast

@genType.import(("./MetadataManager", "AnyMetadataReporter"))
type reporter

@send external reportUntypedExpr: (reporter, untypedExprNode) => unit = "report"
@send external reportTypedExpr: (reporter, typedExprNode) => unit = "report"
@send external reportExactlyTypedExpr: (reporter, exactlyTypedExprNode) => unit = "report"

@module("./MetadataManager")
@new external dummyReporter: reporter = "DummyMetadataReporter"