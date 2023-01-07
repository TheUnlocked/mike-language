import { LibraryInterface } from '../src/library';
import { TypeAttributeKind } from '../src/types/Attribute';
import { functionOf, simpleTypeOf } from '../src/types/KnownType';
import { unitType } from '../src/types/Primitives';

const userType = simpleTypeOf("User");
const policyType = simpleTypeOf("Policy");
const groupType = simpleTypeOf("Group");

export const necodeLib = {
    types: [
        { name: 'User', numParameters: 0, quantify: () => ({ attributes: [], members: {} }) },
        { name: 'Policy', numParameters: 0, quantify: () => ({ attributes: [{ kind: TypeAttributeKind.IsLegalParameter }], members: {} }) },
        { name: 'Group', numParameters: 0, quantify: () => ({ attributes: [], members: {
            join: functionOf([userType], unitType),
            leave: functionOf([userType], unitType),
            forget: functionOf([userType], unitType),
        } }) },
    ],
    values: [
        { name: 'link', type: functionOf([userType, userType], unitType) },
        { name: 'unlink', type: functionOf([userType, userType], unitType) },
        { name: 'Group', type: functionOf([policyType], groupType) },
    ]
} satisfies LibraryInterface;

// Used by mike-lsp
export const libraries = [necodeLib];

// Used by mike-lsp
export const events = [
    { name: 'join', required: false, argumentTypes: [userType] },
    { name: 'leave', required: false, argumentTypes: [userType] },
];
