import { KnownType } from './KnownType';

export enum TypeAttributeKind {
    IsSequenceLike,
    IsMapLike,
    CanIfDestruct,
}

interface BaseAttribute {
}

export interface IsSequenceLikeAttribute extends BaseAttribute {
    readonly kind: TypeAttributeKind.IsSequenceLike;
    readonly addMethod: string;
    readonly reversed: boolean;
}

export interface IsMapLikeAttribute extends BaseAttribute {
    readonly kind: TypeAttributeKind.IsMapLike;
    readonly setMethod: string;
}

export interface CanIfDestructAttribute extends BaseAttribute {
    readonly kind: TypeAttributeKind.CanIfDestruct;
    readonly into: KnownType;
}

export type TypeAttribute
    = IsSequenceLikeAttribute
    | IsMapLikeAttribute
    | CanIfDestructAttribute
    ;