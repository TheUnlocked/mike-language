import { TypeAttributeKind } from '../types/Attribute';
import { booleanType, intType, unitType } from '../types/Primitives';
import { TypeInfo } from '../types/Type';
import { KnownType, TypeKind } from '../types/KnownType';

function optionOf(t: KnownType): KnownType {
    return {
        kind: TypeKind.Simple,
        name: 'Option',
        typeArguments: [t]
    };
}

export const stdlibTypes = [
    {
        name: 'Array',
        numParameters: 1,
        quantify: ([t]) => ({
            attributes: [
                { kind: TypeAttributeKind.IsSequenceLike, addMethod: 'push', reversed: false }
            ],
            members: {
                get: { kind: TypeKind.Function, parameters: [intType], returnType: optionOf(t) },
                set: { kind: TypeKind.Function, parameters: [intType, t], returnType: unitType },
                length: intType,
            }
        })
    },
    {
        name: 'Queue',
        numParameters: 1,
        quantify: ([t]) => ({
            attributes: [
                { kind: TypeAttributeKind.IsSequenceLike, addMethod: 'enqueue', reversed: true }
            ],
            members: {
                enqueue: { kind: TypeKind.Function, parameters: [t], returnType: unitType },
                pop: { kind: TypeKind.Function, parameters: [], returnType: optionOf(t) },
                peek: { kind: TypeKind.Function, parameters: [], returnType: optionOf(t) },
                peekDeep: { kind: TypeKind.Function, parameters: [intType], returnType: optionOf(t) },
                length: intType,
            }
        })
    },
    {
        name: 'Stack',
        numParameters: 1,
        quantify: ([t]) => ({
            attributes: [
                { kind: TypeAttributeKind.IsSequenceLike, addMethod: 'push', reversed: false }
            ],
            members: {
                push: { kind: TypeKind.Function, parameters: [t], returnType: unitType },
                pop: { kind: TypeKind.Function, parameters: [], returnType: optionOf(t) },
                peek: { kind: TypeKind.Function, parameters: [], returnType: optionOf(t) },
                peekDeep: { kind: TypeKind.Function, parameters: [intType], returnType: optionOf(t) },
                length: intType,
            }
        })
    },
    {
        name: 'Set',
        numParameters: 1,
        quantify: ([t]) => ({
            attributes: [
                { kind: TypeAttributeKind.IsSequenceLike, addMethod: 'add', reversed: false }
            ],
            members: {
                add: { kind: TypeKind.Function, parameters: [t], returnType: unitType },
                remove: { kind: TypeKind.Function, parameters: [t], returnType: booleanType },
                has: { kind: TypeKind.Function, parameters: [t], returnType: booleanType },
                length: intType,
            }
        })
    },
    {
        name: 'DequeSet',
        numParameters: 1,
        quantify: ([t]) => ({
            attributes: [
                { kind: TypeAttributeKind.IsSequenceLike, addMethod: 'push', reversed: false }
            ],
            members: {
                enqueue: { kind: TypeKind.Function, parameters: [t], returnType: unitType },
                popFront: { kind: TypeKind.Function, parameters: [], returnType: optionOf(t) },
                peekFront: { kind: TypeKind.Function, parameters: [], returnType: optionOf(t) },
                peekDeepFront: { kind: TypeKind.Function, parameters: [intType], returnType: optionOf(t) },
                push: { kind: TypeKind.Function, parameters: [t], returnType: unitType },
                pop: { kind: TypeKind.Function, parameters: [], returnType: optionOf(t) },
                peek: { kind: TypeKind.Function, parameters: [], returnType: optionOf(t) },
                peekDeep: { kind: TypeKind.Function, parameters: [intType], returnType: optionOf(t) },
                remove: { kind: TypeKind.Function, parameters: [t], returnType: booleanType },
                has: { kind: TypeKind.Function, parameters: [t], returnType: booleanType },
                length: intType,
            }
        })
    },
    {
        name: 'Map',
        numParameters: 2,
        quantify: ([k, v]) => ({
            attributes: [
                { kind: TypeAttributeKind.IsMapLike, setMethod: 'put' }
            ],
            members: {
                put: { kind: TypeKind.Function, parameters: [k, v], returnType: unitType },
                remove: { kind: TypeKind.Function, parameters: [k], returnType: booleanType },
                get: { kind: TypeKind.Function, parameters: [k], returnType: optionOf(v) },
                has: { kind: TypeKind.Function, parameters: [k], returnType: booleanType },
                length: intType,
            }
        })
    },
    {
        name: 'Option',
        numParameters: 1,
        quantify: ([t]) => ({
            attributes: [
                { kind: TypeAttributeKind.CanIfDestruct, into: t }
            ],
            members: {
                getOrDefault: { kind: TypeKind.Function, parameters: [t], returnType: t },
                hasValue: booleanType,
            }
        })
    },
] as readonly TypeInfo[];