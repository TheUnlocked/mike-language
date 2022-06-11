open Ast
open! Types
open Js.Array2

module Option = Js.Option
module Map = Js_map

exception Uninvokable(typedExprNode)
exception InvalidMathOperand(typedExprNode)
exception InvalidMember(typedExprNode, string)
exception DereferenceSeqLiteral(typedExprNode)
exception DereferenceMapLiteral(typedExprNode)
exception WrongNumberOfArguments({ expected: int, actual: int, expr: untypedExprNode })
exception UnboundIdentifier
exception TypeMismatch(typedExprNode, knownType)
exception TargetTypeMismatch(typedExprNode, exactType)

exception CompilerBug_TargetTypeFedNonsense(typedExprNode, exactType)
exception CompilerBug_CouldNotStrengthen(knownType)
exception CompilerBug_LiteralHasImpossibleType(typedExprNode)

exception NotYetImplemented;

@genType
type typeState = {
    bindings: Map.t<string, knownType>,
}

let getMemberType = (objTypeName: string, objTypeArgs: array<knownType>, memberName: string) => {
    open BuiltinTypes;

    builtinTypesMap->Map.get(objTypeName)->Option.andThen((. typeInfo) => {
        // Type parameter length checking should have already happened at this point 
        let typeState = typeInfo.typeParameters->Belt.Array.zip(objTypeArgs)->Map.fromEntries;

        let member = typeInfo.members(typeState)->Map.get(memberName);

        member->Option.map((. x: typeMember) => x._type, _)
    }, _)
}

let sequenceLikeTypeNames =
    BuiltinTypes.builtinTypes
        ->filter(x => x.attributes->includes(IsSequenceLike))
        ->map(x => x.name)

let mapLikeTypeNames =
    BuiltinTypes.builtinTypes
        ->filter(x => x.attributes->includes(IsMapLike))
        ->map(x => x.name)

let rec fitsInType = (other: knownType, target: knownType) =>
    // Special case where int can coerce to float
    (target == BuiltinTypes.floatType && other == BuiltinTypes.intType) ||
    switch (target, other) {
        | (SimpleType(targetName, [targetArg]), SequenceLike(t')) =>
            sequenceLikeTypeNames->includes(targetName) && switch t' {
                | Some(t) => t->fitsInType(targetArg)
                | None => true
            }
        | (SimpleType(targetName, [targetKey, targetVal]), MapLike(p)) =>
            mapLikeTypeNames->includes(targetName) && switch p {
                | Some((k, v)) => k->fitsInType(targetKey) && v->fitsInType(targetVal)
                | None => true
            }
        | (SimpleType(targetName, targetArgs), SimpleType(otherName, otherArgs)) =>
            targetName == otherName &&
            Belt.Array.zipBy(otherArgs, targetArgs, fitsInType)
                ->every(x => x)
        | (SequenceLike(Some(tTarget)), _) => switch other {
            | SequenceLike(Some(tOther)) => tOther->fitsInType(tTarget)
            | SequenceLike(None) => true
            | _ => false
        }
        | (SequenceLike(None), SequenceLike(None)) => true
        | (MapLike(Some((keyTarget, valTarget))), _) => switch other {
            | MapLike(Some((keyOther, valOther))) =>
                keyOther->fitsInType(keyTarget) && valOther->fitsInType(valTarget)
            | MapLike(None) => true
            | _ => false
        }
        | (MapLike(None), MapLike(None)) => true
        | (FunctionType(targetParams, targetRet), FunctionType(otherParams, otherRet)) =>
            otherRet->fitsInType(targetRet) &&
            Belt.Array.zipBy(targetParams, otherParams, fitsInType)
                ->every(x => x)
        | _ => false
    }

let getCommonSupertypeExn = (values: array<typedExprNode>) => values->reduce((acc, next) => switch acc {
    | None => Some(next._type)
    | Some(t) => if next._type->fitsInType(t) {
            acc
        }
        else if t->fitsInType(next._type) {
            Some(next._type)
        }
        else {
            raise(TypeMismatch(next, t))
        }
}, None)

@genType
let resolveExpressionTypes = (state: typeState, ast: untypedExprNode): typedExprNode => {
    open BuiltinTypes;
    let rec resolve = (ast: untypedExprNode): typedExprNode => {
        let node = ast.node;
        switch node {
            | Invoke({ fn, args }) => {
                let typedFn = resolve(fn);
                let typedArgs = args->map(resolve);
                switch typedFn._type {
                    | FunctionType(params, returnType) => {
                        if params->length !== args->length {
                            raise(WrongNumberOfArguments({ expected: params->length, actual: args->length, expr: ast }))
                        }
                        params->Belt.Array.zip(typedArgs)->forEach(_, ((param, arg: typedExprNode)) =>
                            if !(arg._type->fitsInType(param)) {
                                raise(TypeMismatch(arg, param))
                            }
                        );
                        { _type: returnType, node: Invoke({ fn: typedFn, args: typedArgs }) }
                    }
                    | _ => raise(Uninvokable(typedFn)) 
                }
            }
            | BinaryOp({ op, left, right }) => {
                let typedLeft = resolve(left);
                let typedRight = resolve(right);
                let resultType = switch typedLeft._type {
                    | SimpleType("int", []) => switch typedRight._type {
                        | SimpleType("int", []) => intType
                        | SimpleType("float", []) => floatType
                        | _ => raise(InvalidMathOperand(typedRight))
                    }
                    | SimpleType("float", []) => switch typedRight._type {
                        | SimpleType("int", []) | SimpleType("float", []) => floatType
                        | _ => raise(InvalidMathOperand(typedRight))
                    }
                    | _ => raise(InvalidMathOperand(typedLeft))
                };
                { _type: resultType, node: BinaryOp({ op, left: typedLeft, right: typedRight }) }
            }
            | Dereference(obj, name) => {
                let typedObj = resolve(obj);
                switch typedObj._type {
                    | SimpleType(typeName, typeArgs) => switch getMemberType(typeName, typeArgs, name) {
                        | Some(t) => { _type: t, node: Dereference(typedObj, name) }
                        | None => raise(InvalidMember(typedObj, name))
                    }
                    | SequenceLike(_) => raise(DereferenceSeqLiteral(typedObj))
                    | MapLike(_) => raise(DereferenceMapLiteral(typedObj))
                    | FunctionType(_) => raise(InvalidMember(typedObj, name))
                }
            }
            | Variable(name) => switch state.bindings->Map.get(name) {
                | Some(t) => { _type: t, node: Variable(name) }
                | None => raise(UnboundIdentifier)
            }
            | FloatLiteral(val) => { _type: floatType, node: FloatLiteral(val) }
            | IntLiteral(val) => { _type: intType, node: IntLiteral(val) }
            | BoolLiteral(val) => { _type: booleanType, node: BoolLiteral(val) }
            | StringLiteral(val) => { _type: stringType, node: StringLiteral(val) }
            | SequenceLiteral(values) => {
                let typedValues = values->map(resolve);
                let seqTypeParam = typedValues->getCommonSupertypeExn;
                { _type: SequenceLike(seqTypeParam), node: SequenceLiteral(typedValues) }
            }
            | MapLiteral({ keys, values }) => {
                let typedKeys = keys->map(resolve);
                let typedValues = values->map(resolve);
                let keyTypeParam = typedKeys->getCommonSupertypeExn;
                let valTypeParam = typedValues->getCommonSupertypeExn;
                {
                    _type: MapLike(
                        keyTypeParam->Option.andThen((. k) =>
                        valTypeParam->Option.map((. v) =>
                        (k, v), _), _)
                    ),
                    node: MapLiteral({ keys: typedKeys, values: typedValues })
                }
            }
        }
    };
    resolve(ast)
}


@genType
let rec targetType = (target: exactType, ast: typedExprNode): exactlyTypedExprNode =>
        if ast._type->fitsInType(weaken(target)) {
            let rec strengthen = t => switch t {
                | SimpleType(n, args) =>
                    SimpleTypeExact(n, args->map(strengthen))
                | FunctionType(params, ret) =>
                    FunctionTypeExact(params->map(strengthen), strengthen(ret))
                | _ => raise(CompilerBug_CouldNotStrengthen(t))
            };

            let node = switch ast.node {
                | Invoke({ fn: { _type: FunctionType(paramsT, retT), node: fnNode }, args }) =>
                    if retT->fitsInType(weaken(target)) {
                        let exactParams = paramsT->map(strengthen);
                        let fnType = FunctionTypeExact(exactParams, target);
                        Invoke({
                            fn: targetType(fnType, { _type: FunctionType(paramsT, retT), node: fnNode }),
                            args: exactParams->Belt.Array.zipBy(args, targetType)
                        })
                    }
                    else {
                        raise(TargetTypeMismatch(ast, target))
                    }
                | Invoke(_) => raise(TargetTypeMismatch(ast, target))
                | BinaryOp({ op, left, right }) =>
                    BinaryOp({
                        op,
                        left: targetType(target, left),
                        right: targetType(target, right)
                    })
                | Dereference(obj, name) =>
                    Dereference(targetType(strengthen(obj._type), obj), name)
                | Variable(name) => Variable(name)
                | FloatLiteral(v) => FloatLiteral(v)
                | IntLiteral(v) => IntLiteral(v)
                | BoolLiteral(v) => BoolLiteral(v)
                | StringLiteral(v) => StringLiteral(v)
                | SequenceLiteral(elts) => switch target {
                    | SimpleTypeExact(_, [tArg]) =>
                        SequenceLiteral(elts->map(targetType(tArg)))
                    | _ => raise(CompilerBug_LiteralHasImpossibleType(ast))
                }
                | MapLiteral({ keys, values }) => switch target {
                    | SimpleTypeExact(_, [tKey, tVal]) =>
                        MapLiteral({
                            keys: keys->map(targetType(tKey)),
                            values: values->map(targetType(tVal))
                        })
                    | _ => raise(CompilerBug_LiteralHasImpossibleType(ast))
                }
            };
            { _type: target, node }
        }
        else {
            raise(TargetTypeMismatch(ast, target));
        }
