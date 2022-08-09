import { KnownType } from './KnownType';

export enum TypeAttributeKind {
    IsSequenceLike,
    IsMapLike,
    IsLegalCondition,
    IsUserDefined,
    IsLegalParameter,
}

interface BaseAttribute {
}

export interface IsSequenceLikeAttribute extends BaseAttribute {
    readonly kind: TypeAttributeKind.IsSequenceLike;
}

export interface IsMapLikeAttribute extends BaseAttribute {
    readonly kind: TypeAttributeKind.IsMapLike;
}

export interface CanIfDestructAttribute extends BaseAttribute {
    readonly kind: TypeAttributeKind.IsLegalCondition;
    readonly destructInto?: KnownType;
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