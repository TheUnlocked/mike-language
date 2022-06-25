import { TypeInfo } from './Type';
import { ExactType, SimpleType, TypeKind } from './TypeReference';

function typeRefOf(type: TypeInfo): SimpleType {
    return {
        kind: TypeKind.Simple,
        name: type.name,
        typeArguments: []
    };
}

function primitive(name: string): TypeInfo {
    return {
        name,
        numParameters: 0,
        quantify: () => ({
            attributes: [],
            members: {},
        })
    };
}

export const unitTypeInfo = primitive('unit');
export const booleanTypeInfo = primitive('boolean');
export const intTypeInfo = primitive('int');
export const floatTypeInfo = primitive('float');
export const stringTypeInfo = primitive('string');

export const unitType = typeRefOf(unitTypeInfo);
export const booleanType = typeRefOf(booleanTypeInfo);
export const intType = typeRefOf(intTypeInfo);
export const floatType = typeRefOf(floatTypeInfo);
export const stringType = typeRefOf(stringTypeInfo);

export const primitiveTypes = [
    unitTypeInfo,
    booleanTypeInfo,
    intTypeInfo,
    floatTypeInfo,
    stringTypeInfo
];
