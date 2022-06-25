import { AnyType, ExactType, KnownType, TypeKind } from '../TypeReference';

export const makeSimpleType   = <T extends AnyType>(name: string, typeArguments: readonly T[]): T extends ExactType ? ExactType : KnownType => ({ kind: TypeKind.Simple, name, typeArguments }) as any;
export const makeFunctionType = <T extends AnyType>(parameters: readonly T[], returnType: T): T extends ExactType ? ExactType : KnownType => ({ kind: TypeKind.Function, parameters, returnType }) as any;
export const makeSequenceLike = (element?: KnownType): KnownType => ({ kind: TypeKind.SequenceLike, element });
export const makeMapLike      = (typeArguments?: [KnownType, KnownType]): KnownType => ({ kind: TypeKind.MapLike, typeArguments });