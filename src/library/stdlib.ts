import { TypeAttributeKind } from '../types/Attribute';
import { ANY_TYPE, functionOf, genericFunctionOf, optionOf } from '../types/KnownType';
import { booleanType, floatType, intType, unitType } from '../types/Primitives';
import { suggestType } from '../utils/types';
import { LibraryInterface } from './Library';

const stdlib = suggestType<LibraryInterface>()({
    types: [
        {
            name: 'Array',
            numParameters: 1,
            quantify: ([t]) => ({
                attributes: [
                    { kind: TypeAttributeKind.IsSequenceLike, reversed: false },
                ],
                members: {
                    get: functionOf([intType], optionOf(t)),
                    set: functionOf([intType, t], booleanType),
                    length: intType,
                }
            })
        },
        {
            name: 'Queue',
            numParameters: 1,
            quantify: ([t]) => ({
                attributes: [
                    { kind: TypeAttributeKind.IsSequenceLike, reversed: true },
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
                    { kind: TypeAttributeKind.IsSequenceLike, reversed: false },
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
                    { kind: TypeAttributeKind.IsSequenceLike, reversed: false },
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
                    { kind: TypeAttributeKind.IsSequenceLike, reversed: false },
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
                    { kind: TypeAttributeKind.IsMapLike },
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
                    { kind: TypeAttributeKind.IsLegalParameter },
                ],
                members: {
                    getOrDefault: functionOf([t], t),
                    hasValue: booleanType,
                }
            })
        },
    ],
    values: [
        { name: 'none', type: optionOf(ANY_TYPE) },
        { name: 'some', type: genericFunctionOf(['T'], t => [t], t => optionOf(t)) },

        { name: 'toInt', type: functionOf([floatType], optionOf(intType)) },
        { name: 'toFloat', type: functionOf([intType], floatType) },
    ]
} as const);

export type StdlibInterface = typeof stdlib;

export default stdlib as LibraryInterface;
