import { KnownType } from '../types/KnownType';
import { TypeInfo } from '../types/TypeInfo';

export interface LibraryInterface {
    readonly types: readonly TypeInfo[];
    readonly values: readonly { name: string, type: KnownType }[];
}

export interface LibraryImplementation<Interface extends LibraryInterface = any, TypeImpl = unknown, ValueImpl = unknown> {
    readonly types: { readonly [TypeName in Interface['types'][number]['name']]: TypeImpl };
    readonly values: { readonly [valueName in Interface['values'][number]['name']]: ValueImpl };
}
