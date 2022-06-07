@genType.opaque
type rec knownType =
    | SimpleType(string, array<knownType>)
    | FunctionType(array<knownType>, knownType)
    | SequenceLike(option<knownType>)
    | MapLike(option<(knownType, knownType)>)

@genType.opaque
type rec exactType =
    | SimpleTypeExact(string, array<exactType>)
    | FunctionTypeExact(array<exactType>, exactType)

@genType let makeSimpleType =   (. n, a) => SimpleType(n, a)
@genType let makeFunctionType = (. p, r) => FunctionType(p, r)
@genType let makeSequenceLike = (. t) => SequenceLike(t)
@genType let makeMapLike =      (. p) => MapLike(p)

@genType let makeSimpleTypeExact =   (. n, a) => SimpleTypeExact(n, a)
@genType let makeFunctionTypeExact = (. p, r) => FunctionTypeExact(p, r)

@genType
let rec weaken = (t: exactType): knownType => switch t {
    | SimpleTypeExact(n, a) => SimpleType(n, a->Js.Array2.map(weaken))
    | FunctionTypeExact(p, r) => FunctionType(p->Js.Array2.map(weaken), weaken(r))
}

type typeAttribute =
    | IsSequenceLike
    | IsMapLike

type typeContext = Js_map.t<string, knownType>

type typeMember = {
    name: string,
    @as("type") _type: knownType
}

type typeInfo = {
    name: string,
    typeParameters: array<string>,
    attributes: array<typeAttribute>,
    members: typeContext => Js_map.t<string, typeMember>,
}