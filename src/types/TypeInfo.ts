import { TypeDefinition } from '../ast/Ast';
import { TypeAttribute } from './Attribute';
import { KnownType } from './KnownType';

export interface TypeInfo {
    readonly name: string;
    readonly numParameters: number;
    readonly quantify: (args: readonly KnownType[]) => {
        readonly attributes: readonly TypeAttribute[];
        readonly members: { readonly [name: string]: KnownType };
    }
    readonly definedBy?: TypeDefinition;
}
