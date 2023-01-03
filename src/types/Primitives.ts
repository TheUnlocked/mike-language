import { TypeInfo } from './TypeInfo';
import { SimpleType, TypeKind } from './KnownType';
import { TypeAttribute, TypeAttributeKind } from './Attribute';

function typeRefOf(type: TypeInfo): SimpleType {
    return {
        _type: true,
        kind: TypeKind.Simple,
        name: type.name,
        typeArguments: []
    };
}

function primitive(name: string, attributes: TypeAttribute[] = []): TypeInfo {
    return {
        name,
        numParameters: 0,
        quantify: () => ({
            attributes: [
                { kind: TypeAttributeKind.IsPrimitive },
                ...attributes,
            ],
            members: {},
        })
    };
}

export const unitTypeInfo = primitive('unit');
export const booleanTypeInfo = primitive('boolean', [
    { kind: TypeAttributeKind.IsLegalParameter },
    { kind: TypeAttributeKind.IsLegalCondition }
]);
export const intTypeInfo = primitive('int', [{ kind: TypeAttributeKind.IsLegalParameter }]);
export const floatTypeInfo = primitive('float', [{ kind: TypeAttributeKind.IsLegalParameter }]);
export const stringTypeInfo = primitive('string', [{ kind: TypeAttributeKind.IsLegalParameter }]);

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
