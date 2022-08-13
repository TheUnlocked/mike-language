import { KnownType } from './KnownType';

export enum TypeAttributeKind {
    IsPrimitive,
    IsSequenceLike,
    IsMapLike,
    IsLegalCondition,
    IsUserDefined,
    IsLegalParameter,
}

interface BaseAttribute {
}

export interface IsPrimitive extends BaseAttribute {
    readonly kind: TypeAttributeKind.IsPrimitive;
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
    = IsPrimitive
    | IsSequenceLikeAttribute
    | IsMapLikeAttribute
    | CanIfDestructAttribute
    | IsUserDefinedAttribute
    | IsLegalParameterAttribute
    ;