@genType.import(("./Scope", "default"))
type t;

@module("./Scope")
@new
external make: (option<t>) => t = "default"

@send
external get: (t, string) => option<Types.exactType> = "get"

@send
external has: (t, string) => bool = "has"

@send
external set: (t, string, Types.exactType) => t = "set"

@get
external parent: t => option<t> = "parent"
