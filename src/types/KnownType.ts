import { isEqual } from 'lodash';
import { ReadonlyTupleOf } from '../utils/types';

export enum TypeKind {
    Toxic,
    Simple,
    Function,
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
    readonly parameters: readonly KnownType[];
    readonly returnType: KnownType;
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

export interface MapLike extends TypeReference {
    readonly kind: TypeKind.MapLike;
    readonly name?: string;
    readonly typeArguments?: readonly [key: KnownType, value: KnownType];
}

export type KnownType
    = SimpleType
    | FunctionType
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
            return `(${type.parameters.map(stringifyType).join(', ')}) => ${stringifyType(type.returnType)}`;
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
            return 'Error!';
    }
}

export const TOXIC = { kind: TypeKind.Toxic } as ToxicType;