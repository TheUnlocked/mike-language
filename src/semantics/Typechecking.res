open Ast
open! Types
open Js.Array2
open Exception

module Option = Belt.Option
module Map = Js_map

@genType.opaque
type typecheckingError
    = Uninvokable
    | InvalidMathOperand
    | InvalidMember(string)
    | DereferenceSeqLiteral
    | DereferenceMapLiteral
    | WrongNumberOfArguments({ expected: int, actual: int })
    | UnboundIdentifier
    | TypeMismatch(knownType)
    | TargetTypeMismatch(exactType)
    | CouldNotInferType

exception CompilerBug_TargetTypeFedNonsense(exactType)
exception CompilerBug_CouldNotStrengthen(knownType)

let getMemberType = (types: Map.t<string, typeInfo>, objTypeName: string, objTypeArgs: array<knownType>, memberName: string) => {
    types->Map.get(objTypeName)->Option.flatMapU((. typeInfo) => {
        // Type parameter length checking should have already happened at this point 
        let typeState = typeInfo.typeParameters->Belt.Array.zip(objTypeArgs)->Map.fromEntries;

        let member = typeInfo.members(typeState)->Map.get(memberName);

        member->Option.mapU((. x: typeMember) => x._type)
    })
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
            raiseMiKe(semanticErrorTyped(next, TypeMismatch(t)))
        }
}, None)


@genType
let resolveExpressionTypesWithMetadata = (reporter: Metadata.reporter, types: Map.t<string, typeInfo>, scope: Scope.t, ast: untypedExprNode): typedExprNode => {
    open BuiltinTypes;
    let rec resolve = (ast: untypedExprNode): typedExprNode => {
        let node = ast.node;
        let result = switch node {
            | Invoke({ fn, args }) => {
                let typedFn = resolve(fn);
                let typedArgs = args->map(resolve);
                switch typedFn._type {
                    | FunctionType(params, returnType) => {
                        if params->length !== args->length {
                            raiseMiKe(semanticErrorUntyped(ast, WrongNumberOfArguments({ expected: params->length, actual: args->length })))
                        }
                        params->Belt.Array.zip(typedArgs)->forEach(_, ((param, arg: typedExprNode)) =>
                            if !(arg._type->fitsInType(param)) {
                                raiseMiKe(semanticErrorTyped(arg, TypeMismatch(param)))
                            }
                        );
                        { _type: returnType, node: Invoke({ fn: typedFn, args: typedArgs }) }
                    }
                    | _ => raiseMiKe(semanticErrorTyped(typedFn, Uninvokable)) 
                }
            }
            | BinaryOp({ op, left, right }) => {
                let typedLeft = resolve(left);
                let typedRight = resolve(right);
                let resultType = switch typedLeft._type {
                    | SimpleType("int", []) => switch typedRight._type {
                        | SimpleType("int", []) => intType
                        | SimpleType("float", []) => floatType
                        | _ => raiseMiKe(semanticErrorTyped(typedRight, InvalidMathOperand))
                    }
                    | SimpleType("float", []) => switch typedRight._type {
                        | SimpleType("int", []) | SimpleType("float", []) => floatType
                        | _ => raiseMiKe(semanticErrorTyped(typedRight, InvalidMathOperand))
                    }
                    | _ => raiseMiKe(semanticErrorTyped(typedLeft, InvalidMathOperand))
                };
                { _type: resultType, node: BinaryOp({ op, left: typedLeft, right: typedRight }) }
            }
            | Dereference(obj, name) => {
                let typedObj = resolve(obj);
                switch typedObj._type {
                    | SimpleType(typeName, typeArgs) => switch getMemberType(types, typeName, typeArgs, name) {
                        | Some(t) => { _type: t, node: Dereference(typedObj, name) }
                        | None => raiseMiKe(semanticErrorTyped(typedObj, InvalidMember(name)))
                    }
                    | SequenceLike(_) => raiseMiKe(semanticErrorTyped(typedObj, DereferenceSeqLiteral))
                    | MapLike(_) => raiseMiKe(semanticErrorTyped(typedObj, DereferenceMapLiteral))
                    | FunctionType(_) => raiseMiKe(semanticErrorTyped(typedObj, InvalidMember(name)))
                }
            }
            | Variable(name) => switch scope->Scope.get(name) {
                | Some(t) => { _type: weaken(t), node: Variable(name) }
                | None => raiseMiKe(semanticErrorUntyped(ast, UnboundIdentifier))
            }
            | FloatLiteral(val) => { _type: floatType, node: FloatLiteral(val) }
            | IntLiteral(val) => { _type: intType, node: IntLiteral(val) }
            | BoolLiteral(val) => { _type: booleanType, node: BoolLiteral(val) }
            | StringLiteral(val) => { _type: stringType, node: StringLiteral(val) }
            | SequenceLiteral({ typeName, values }) => {
                let typedValues = values->map(resolve);
                let seqTypeParam = typedValues->getCommonSupertypeExn;
                {
                    _type: switch (typeName, seqTypeParam) {
                        | (Some(t), Some(arg)) => SimpleType(t, [arg])
                        | _ => SequenceLike(seqTypeParam)
                    },
                    node: SequenceLiteral({ typeName, values: typedValues })
                }
            }
            | MapLiteral({ typeName, keys, values }) => {
                let typedKeys = keys->map(resolve);
                let typedValues = values->map(resolve);
                let keyTypeParam = typedKeys->getCommonSupertypeExn;
                let valTypeParam = typedValues->getCommonSupertypeExn;
                {
                    _type: switch (typeName,
                        keyTypeParam->Option.flatMapU((. k) =>
                        valTypeParam->Option.mapU((. v) =>
                        (k, v))))
                    {
                        | (Some(t), Some((k, v))) => SimpleType(t, [k, v])
                        | (_, p) => MapLike(p)
                    },
                    node: MapLiteral({ typeName, keys: typedKeys, values: typedValues })
                }
            }
        };
        reporter->Metadata.reportTypedExpr(result);
        result
    };
    resolve(ast)
}

@genType
let resolveExpressionTypes = (types: Map.t<string, typeInfo>, scope: Scope.t, ast: untypedExprNode): typedExprNode => {
    resolveExpressionTypesWithMetadata(Metadata.dummyReporter, types, scope, ast);
}


let rec strengthen = t => switch t {
    | SimpleType(n, args) =>
        SimpleTypeExact(n, args->map(strengthen))
    | FunctionType(params, ret) =>
        FunctionTypeExact(params->map(strengthen), ret->strengthen)
    | _ => raise(CompilerBug_CouldNotStrengthen(t))
};

@genType
let targetTypeWithMetadata = (reporter: Metadata.reporter, target: exactType, ast: typedExprNode): exactlyTypedExprNode => {
    let rec targetType = (target: exactType, ast: typedExprNode) =>
        if ast._type->fitsInType(weaken(target)) {
            let node = switch ast.node {
                | Invoke({ fn: { _type: FunctionType(paramsT, retT), node: fnNode }, args }) =>
                    if retT->fitsInType(weaken(target)) {
                        let exactParams = paramsT->map(p => strengthen(p));
                        let fnType = FunctionTypeExact(exactParams, target);
                        Invoke({
                            fn: targetType(fnType, { _type: FunctionType(paramsT, retT), node: fnNode }),
                            args: exactParams->Belt.Array.zipBy(args, targetType)
                        })
                    }
                    else {
                        raiseMiKe(semanticErrorTyped(ast, TargetTypeMismatch(target)))
                    }
                | Invoke(_) => raiseMiKe(semanticErrorTyped(ast, TargetTypeMismatch(target)))
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
                | SequenceLiteral({ typeName, values }) => switch target {
                    | SimpleTypeExact(targetTypeName, [tArg]) =>
                        if typeName->Option.mapU((. t) => t === targetTypeName)->Option.getWithDefault(true) {
                            SequenceLiteral({ typeName, values: values->map(targetType(tArg)) })
                        }
                        else {
                            raiseMiKe(semanticErrorTyped(ast, TargetTypeMismatch(target)))
                        }
                    | _ => raiseMiKe(semanticErrorTyped(ast, TargetTypeMismatch(target)))
                }
                | MapLiteral({ typeName, keys, values }) => switch target {
                    | SimpleTypeExact(_, [tKey, tVal]) =>
                        MapLiteral({
                            typeName,
                            keys: keys->map(targetType(tKey)),
                            values: values->map(targetType(tVal))
                        })
                    | _ => raiseMiKe(semanticErrorTyped(ast, TargetTypeMismatch(target)))
                }
            };
            let result = { _type: target, node };
            reporter->Metadata.reportExactlyTypedExpr(result);
            result
        }
        else {
            raiseMiKe(semanticErrorTyped(ast, TargetTypeMismatch(target)))
        };
    targetType(target, ast);
}

@genType
let targetType = (target: exactType, ast: typedExprNode): exactlyTypedExprNode =>
    targetTypeWithMetadata(Metadata.dummyReporter, target, ast)

@genType
let inferType = (ast: typedExprNode) => {
    try { strengthen(ast._type) }
    catch {
        | CompilerBug_CouldNotStrengthen(_) => raiseMiKe(semanticErrorTyped(ast, CouldNotInferType))
    }
}
