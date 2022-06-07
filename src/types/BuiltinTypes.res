@genType let unitType    = Types.SimpleType("unit", []);
@genType let booleanType = Types.SimpleType("boolean", []);
@genType let intType     = Types.SimpleType("int", []);
@genType let floatType   = Types.SimpleType("float", []);
@genType let unitTypeExact    = Types.SimpleTypeExact("unit", []);
@genType let booleanTypeExact = Types.SimpleTypeExact("boolean", []);
@genType let intTypeExact     = Types.SimpleTypeExact("int", []);
@genType let floatTypeExact   = Types.SimpleTypeExact("float", []);

exception CompilerBug_RefNonexistentTypeParam

let builtinTypes: array<Types.typeInfo> = {
    open Js_map;

    let getExn = x => switch x {
        | Some(v) => v
        | None => raise(CompilerBug_RefNonexistentTypeParam)
    };

    let toMap = (x: array<Types.typeMember>) => x->Js.Array2.map(x => (x.name, x))->Js_map.fromEntries;

    let primitive = (name: string): Types.typeInfo => {
        name,
        typeParameters: [],
        attributes: [],
        members: _ => make()
    };

    [
        primitive("unit"),
        primitive("boolean"),
        primitive("int"),
        primitive("float"),
        {
            name: "Array",
            typeParameters: ["t"],
            attributes: [IsSequenceLike],
            members: ctx => toMap({
                let t = ctx->get("t")->getExn;
                [
                    { name: "get", _type: FunctionType([intType], t) },
                    { name: "set", _type: FunctionType([intType, t], unitType) },
                    { name: "length", _type: intType },
                ]
            })
        },
        {
            name: "Queue",
            typeParameters: ["t"],
            attributes: [IsSequenceLike],
            members: ctx => toMap({
                let t = ctx->get("t")->getExn;
                [
                    { name: "enqueue", _type: FunctionType([t], unitType) },
                    { name: "pop", _type: FunctionType([], t) },
                    { name: "peek", _type: FunctionType([], t) },
                    { name: "peekDeep", _type: FunctionType([intType], t) },
                    { name: "length", _type: intType },
                ]
            })
        },
        {
            name: "Stack",
            typeParameters: ["t"],
            attributes: [IsSequenceLike],
            members: ctx => toMap({
                let t = ctx->get("t")->getExn;
                [
                    { name: "push", _type: FunctionType([t], unitType) },
                    { name: "pop", _type: FunctionType([], t) },
                    { name: "peek", _type: FunctionType([], t) },
                    { name: "peekDeep", _type: FunctionType([intType], t) },
                    { name: "length", _type: intType },
                ]
            })
        },
        {
            name: "Set",
            typeParameters: ["t"],
            attributes: [IsSequenceLike],
            members: ctx => toMap({
                let t = ctx->get("t")->getExn;
                [
                    { name: "add", _type: FunctionType([t], unitType) },
                    { name: "remove", _type: FunctionType([t], booleanType) },
                    { name: "has", _type: FunctionType([t], booleanType) },
                    { name: "length", _type: intType },
                ]
            })
        },
        {
            name: "DequeSet",
            typeParameters: ["t"],
            attributes: [IsSequenceLike],
            members: ctx => toMap({
                let t = ctx->get("t")->getExn;
                [
                    { name: "pushFront", _type: FunctionType([t], unitType) },
                    { name: "popFront", _type: FunctionType([], t) },
                    { name: "peekFront", _type: FunctionType([], t) },
                    { name: "peekDeepFront", _type: FunctionType([intType], t) },
                    { name: "pushBack", _type: FunctionType([t], unitType) },
                    { name: "popBack", _type: FunctionType([], t) },
                    { name: "peekBack", _type: FunctionType([], t) },
                    { name: "peekDeepBack", _type: FunctionType([intType], t) },
                    { name: "has", _type: FunctionType([t], booleanType) },
                    { name: "length", _type: intType },
                ]
            })
        },
        {
            name: "Map",
            typeParameters: ["k", "v"],
            attributes: [IsMapLike],
            members: ctx => toMap({
                let k = ctx->get("k")->getExn;
                let v = ctx->get("v")->getExn;
                [
                    { name: "put", _type: FunctionType([k, v], unitType) },
                    { name: "remove", _type: FunctionType([k], booleanType) },
                    { name: "get", _type: FunctionType([k], v) },
                    { name: "has", _type: FunctionType([k], booleanType) },
                    { name: "length", _type: intType },
                ]
            })
        },
    ]
}

let builtinTypesMap = {
    let toMap = (x: array<Types.typeInfo>) => x->Js.Array2.map(x => (x.name, x))->Js_map.fromEntries;
    toMap(builtinTypes)
}