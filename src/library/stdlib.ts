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
                    { kind: TypeAttributeKind.IsSequenceLike },
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
                    { kind: TypeAttributeKind.IsSequenceLike },
                ],
                members: {
                    enqueue: functionOf([t], unitType),
                    pop: functionOf([], optionOf(t)),
                    peek: functionOf([], optionOf(t)),
                    length: intType,
                }
            })
        },
        {
            name: 'Stack',
            numParameters: 1,
            quantify: ([t]) => ({
                attributes: [
                    { kind: TypeAttributeKind.IsSequenceLike },
                ],
                members: {
                    push: functionOf([t], unitType),
                    pop: functionOf([], optionOf(t)),
                    peek: functionOf([], optionOf(t)),
                    length: intType,
                }
            })
        },
        {
            name: 'Set',
            numParameters: 1,
            quantify: ([t]) => ({
                attributes: [
                    { kind: TypeAttributeKind.IsSequenceLike },
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
            name: 'QueueSet',
            numParameters: 1,
            quantify: ([t]) => ({
                attributes: [
                    { kind: TypeAttributeKind.IsSequenceLike },
                ],
                members: {
                    enqueue: functionOf([t], unitType),
                    pop: functionOf([], optionOf(t)),
                    peek: functionOf([], optionOf(t)),
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
                    set: functionOf([k, v], unitType),
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
                    { kind: TypeAttributeKind.IsLegalCondition, destructInto: t },
                    { kind: TypeAttributeKind.IsLegalParameter },
                ],
                members: {
                    hasValue: booleanType,
                    getOrDefault: functionOf([t], t),
                }
            })
        },
    ],
    values: [
        { name: 'none', type: { ...optionOf(ANY_TYPE), isNotInferrable: true } },
        { name: 'some', type: genericFunctionOf(['T'], t => [t], t => optionOf(t)) },

        { name: 'toInt', type: functionOf([floatType], optionOf(intType)) },
        { name: 'toFloat', type: functionOf([intType], floatType) },
    ]
} as const);

export type StdlibInterface = typeof stdlib;

export default stdlib as LibraryInterface;
