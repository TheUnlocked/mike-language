import { TypeAttribute } from './Attribute';
import { KnownType, IncompleteType } from './KnownType';

export interface TypeInfo {
    readonly name: string;
    readonly numParameters: number;
    readonly quantify: (args: readonly KnownType[]) => {
        readonly attributes: readonly TypeAttribute[];
        readonly members: { readonly [name: string]: KnownType };
    }
}
