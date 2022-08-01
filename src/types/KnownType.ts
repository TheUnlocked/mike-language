import { isEqual, zip } from 'lodash';
import { ReadonlyTupleOf } from '../utils/types';

export enum TypeKind {
    Toxic,
    Simple,
    Function,
    TypeVariable,
    SequenceLike,
    MapLike,
}

interface TypeReference {
    
}

export interface ToxicType extends TypeReference {
    readonly kind: TypeKind.Toxic;
}

export interface SimpleType<NArgs extends number = any> extends TypeReference {
    readonly kind: TypeKind.Simple;
    readonly name: string;
    readonly typeArguments: ReadonlyTupleOf<KnownType, NArgs>;
}

export interface FunctionType extends TypeReference {
    readonly kind: TypeKind.Function;
    readonly typeParameters: readonly TypeVariable[];
    readonly parameters: readonly KnownType[];
    readonly returnType: KnownType;
}

export function replaceTypeVariables<T extends Exclude<KnownType, TypeVariable>>(type: T, vars: Map<symbol, KnownType>): T {
    function rec(type: KnownType): KnownType {
        switch (type.kind) {
            case TypeKind.Toxic:
                return TOXIC;
            case TypeKind.TypeVariable:
                return vars.get(type.symbol) ?? type;
            case TypeKind.Simple:
                return {
                    kind: TypeKind.Simple,
                    name: type.name,
                    typeArguments: type.typeArguments.map(rec),
                };
            case TypeKind.Function: {
                return {
                    kind: TypeKind.Function,
                    typeParameters: type.typeParameters,
                    parameters: type.parameters.map(rec),
                    returnType: rec(type.returnType),
                };
            }
        }
    }

    return rec(type) as T;
}

export interface TypeVariable extends TypeReference {
    readonly kind: TypeKind.TypeVariable;
    readonly symbol: symbol;
}

export interface SequenceLike extends TypeReference {
    readonly kind: TypeKind.SequenceLike;
    readonly name?: string;
    readonly element?: KnownType;
}

export function matchesSequenceLike(other: KnownType, type: SequenceLike): other is SimpleType<1> {
    if (other.kind !== TypeKind.Simple || other.typeArguments.length !== 1) {
        return false;
    }
    if (type.name && other.name !== type.name) {
        return false;
    }
    if (type.element && !isEqual(other.typeArguments[0], type.element)) {
        return false;
    }
    return true;
}

export interface MapLike extends TypeReference {
    readonly kind: TypeKind.MapLike;
    readonly name?: string;
    readonly typeArguments?: readonly [key: KnownType, value: KnownType];
}

export function matchesMapLike(other: KnownType, type: MapLike): other is SimpleType<2> {
    if (other.kind !== TypeKind.Simple || other.typeArguments.length !== 2) {
        return false;
    }
    if (type.name && other.name !== type.name) {
        return false;
    }
    if (type.typeArguments && !isEqual(other.typeArguments, type.typeArguments)) {
        return false;
    }
    return true;
}

export type KnownType
    = SimpleType
    | FunctionType
    | TypeVariable
    | ToxicType
    ;

export type IncompleteType
    = KnownType
    | SequenceLike
    | MapLike
    ;

export type AnyType
    = IncompleteType
    | KnownType
    ;

export function isKnownType(type: AnyType): type is KnownType {
    switch (type.kind) {
        case TypeKind.Simple:            
        case TypeKind.Function:            
            return true;
    }
    return false;
}

export function stringifyType(type: AnyType): string {
    switch (type.kind) {
        case TypeKind.Simple:
            if (type.typeArguments.length === 0) {
                return type.name;
            }
            return `${type.name}<${type.typeArguments.map(stringifyType).join(', ')}>`;
        case TypeKind.Function:
            if (type.typeParameters.length === 0) {
                return `(${type.parameters.map(stringifyType).join(', ')}) => ${stringifyType(type.returnType)}`;
            }
            return `<${type.typeParameters.join(', ')}>(${type.parameters.map(stringifyType).join(', ')}) => ${stringifyType(type.returnType)}`;
        case TypeKind.TypeVariable:
            return type.symbol.description ?? '?';
        case TypeKind.SequenceLike:
            if (type.element) {
                return `[${stringifyType(type.element)}]`;
            }
            return '[?]';
        case TypeKind.MapLike:
            if (type.typeArguments) {
                return `{${stringifyType(type.typeArguments[0])}: ${stringifyType(type.typeArguments[1])}}`;
            }
            return '{?: ?}';
        case TypeKind.Toxic:
            return '?';
    }
}

export const TOXIC = { kind: TypeKind.Toxic } as ToxicType;
export const ANY_TYPE = TOXIC;

export function optionOf(t: KnownType): KnownType {
    return {
        kind: TypeKind.Simple,
        name: 'option',
        typeArguments: [t]
    };
}

export function functionOf(parameters: readonly KnownType[], returnType: KnownType): FunctionType {
    return { kind: TypeKind.Function, typeParameters: [], parameters, returnType };
}

export function genericFunctionOf(
    typeParameterNames: string[],
    parametersCallback: (...args: TypeVariable[]) => readonly KnownType[],
    returnTypeCallback: (...args: TypeVariable[]) => KnownType,
) {
    const typeParameters = typeParameterNames.map(x => ({ kind: TypeKind.TypeVariable, symbol: Symbol(x) } as TypeVariable));
    return {
        kind: TypeKind.Function,
        typeParameters,
        parameters: parametersCallback(...typeParameters),
        returnType: returnTypeCallback(...typeParameters)
    };
}
