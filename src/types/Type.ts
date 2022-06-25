import { TypeAttribute } from './Attribute';
import { ExactType, KnownType } from './TypeReference';

export interface TypeInfo {
    readonly name: string;
    readonly numParameters: number;
    readonly quantify: (args: readonly ExactType[]) => {
        readonly attributes: readonly TypeAttribute[];
        readonly members: { readonly [name: string]: ExactType };
    }
}
