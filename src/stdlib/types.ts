import { TypeAttributeKind } from '../types/Attribute';
import { functionOf, optionOf } from '../types/KnownType';
import { booleanType, intType, unitType } from '../types/Primitives';
import { TypeInfo } from '../types/TypeInfo';

export const stdlibTypes: readonly TypeInfo[] = [
    {
        name: 'Array',
        numParameters: 1,
        quantify: ([t]) => ({
            attributes: [
                { kind: TypeAttributeKind.IsSequenceLike, addMethod: 'push', reversed: false },
            ],
            members: {
                get: functionOf([intType], optionOf(t)),
                set: functionOf([intType, t], unitType),
                length: intType,
            }
        })
    },
    {
        name: 'Queue',
        numParameters: 1,
        quantify: ([t]) => ({
            attributes: [
                { kind: TypeAttributeKind.IsSequenceLike, addMethod: 'enqueue', reversed: true },
            ],
            members: {
                enqueue: functionOf([t], unitType),
                pop: functionOf([], optionOf(t)),
                peek: functionOf([], optionOf(t)),
                peekDeep: functionOf([intType], optionOf(t)),
                length: intType,
            }
        })
    },
    {
        name: 'Stack',
        numParameters: 1,
        quantify: ([t]) => ({
            attributes: [
                { kind: TypeAttributeKind.IsSequenceLike, addMethod: 'push', reversed: false },
            ],
            members: {
                push: functionOf([t], unitType),
                pop: functionOf([], optionOf(t)),
                peek: functionOf([], optionOf(t)),
                peekDeep: functionOf([intType], optionOf(t)),
                length: intType,
            }
        })
    },
    {
        name: 'Set',
        numParameters: 1,
        quantify: ([t]) => ({
            attributes: [
                { kind: TypeAttributeKind.IsSequenceLike, addMethod: 'add', reversed: false },
            ],
            members: {
                add: functionOf([t], unitType),
                remove: functionOf([t], booleanType),
                has: functionOf([t], booleanType),
                length: intType,
            }
        })
    },
    {
        name: 'DequeSet',
        numParameters: 1,
        quantify: ([t]) => ({
            attributes: [
                { kind: TypeAttributeKind.IsSequenceLike, addMethod: 'push', reversed: false },
            ],
            members: {
                enqueue: functionOf([t], unitType),
                popFront: functionOf([], optionOf(t)),
                peekFront: functionOf([], optionOf(t)),
                peekDeepFront: functionOf([intType], optionOf(t)),
                pop: functionOf([], optionOf(t)),
                peek: functionOf([], optionOf(t)),
                peekDeep: functionOf([intType], optionOf(t)),
                remove: functionOf([t], booleanType),
                has: functionOf([t], booleanType),
                length: intType,
            }
        })
    },
    {
        name: 'Map',
        numParameters: 2,
        quantify: ([k, v]) => ({
            attributes: [
                { kind: TypeAttributeKind.IsMapLike, setMethod: 'put' },
            ],
            members: {
                put: functionOf([k, v], unitType),
                remove: functionOf([k], booleanType),
                get: functionOf([k], optionOf(v)),
                has: functionOf([k], booleanType),
                length: intType,
            }
        })
    },
    {
        name: 'option',
        numParameters: 1,
        quantify: ([t]) => ({
            attributes: [
                { kind: TypeAttributeKind.CanIfDestruct, into: t },
            ],
            members: {
                getOrDefault: functionOf([t], t),
                hasValue: booleanType,
            }
        })
    },
];