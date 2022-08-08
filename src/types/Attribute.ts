import { KnownType } from './KnownType';

export enum TypeAttributeKind {
    IsSequenceLike,
    IsMapLike,
    CanIfDestruct,
    IsUserDefined,
    IsLegalParameter,
}

interface BaseAttribute {
}

export interface IsSequenceLikeAttribute extends BaseAttribute {
    readonly kind: TypeAttributeKind.IsSequenceLike;
    readonly reversed: boolean;
}

export interface IsMapLikeAttribute extends BaseAttribute {
    readonly kind: TypeAttributeKind.IsMapLike;
}

export interface CanIfDestructAttribute extends BaseAttribute {
    readonly kind: TypeAttributeKind.CanIfDestruct;
    readonly into: KnownType;
}

export interface IsUserDefinedAttribute extends BaseAttribute {
    readonly kind: TypeAttributeKind.IsUserDefined;
}

export interface IsLegalParameterAttribute extends BaseAttribute {
    readonly kind: TypeAttributeKind.IsLegalParameter;
}

export type TypeAttribute
    = IsSequenceLikeAttribute
    | IsMapLikeAttribute
    | CanIfDestructAttribute
    | IsUserDefinedAttribute
    | IsLegalParameterAttribute
    ;