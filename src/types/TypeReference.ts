export enum TypeKind {
    Simple,
    Function,
    SequenceLike,
    MapLike,
}

interface TypeReference {
    
}

export interface SimpleType extends TypeReference {
    readonly kind: TypeKind.Simple;
    readonly name: string;
    readonly typeArguments: readonly ExactType[];
}

export interface FunctionType extends TypeReference {
    readonly kind: TypeKind.Function;
    readonly parameters: readonly ExactType[];
    readonly returnType: ExactType;
}

export interface SequenceLike extends TypeReference {
    readonly kind: TypeKind.SequenceLike;
    readonly element: KnownType | undefined;
}

export interface MapLike extends TypeReference {
    readonly kind: TypeKind.MapLike;
    readonly typeArguments: readonly [key: KnownType, value: KnownType] | undefined;
}

export type KnownType
    = SimpleType
    | FunctionType
    | SequenceLike
    | MapLike
    ;

export type ExactType
    = SimpleType
    | FunctionType
    ;

export type AnyType
    = KnownType
    | ExactType
    ;

export function isExactType(type: AnyType): type is ExactType {
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
    }
}