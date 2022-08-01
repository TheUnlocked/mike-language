import { ANY_TYPE, KnownType, optionOf, genericFunctionOf } from '../types/KnownType';

export const stdlibValues = {
    none: optionOf(ANY_TYPE),
    some: genericFunctionOf(['T'], t => [t], t => optionOf(t))
} as { readonly [name: string]: KnownType };