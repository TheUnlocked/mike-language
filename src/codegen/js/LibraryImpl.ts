import { LibraryImplementation, LibraryInterface } from '../../library/Library';
import { Constructor } from '../../utils/types';

export interface SerializableType {
    readonly name: string;
    readonly typeArguments: readonly SerializableType[];
}

export interface TypeImpl {
    readonly class?: string;
    readonly conditionMethods?: {
        readonly condition: (code: string) => string;
        readonly destructure?: (code: string) => string;
    };
    serialize: string;
    deserialize: string;
}

type GetName = (name: string) => string;

function injectNames<T extends string | undefined>(code: T, getName: GetName): T {
    if (!code) {
        return undefined as T;
    }
    const result = code.replace(/__SAFE_NAME\(['"`]([^'"`]*)['"`]\)/g, (_, name) => getName(name));
    if (result.includes('__SAFE_NAME')) {
        throw new Error(`Incorrect usage of __SAFE_NAME magic identifier: ${code}`);
    }
    return result as T;
}

type MaybeInstanceType<C> = C extends Constructor ? InstanceType<C> : any;

export function jsTypeImpl<C extends Constructor | undefined, OutputType>($class: C | undefined, typeImpl: {
    serialize(
        obj: C extends Constructor ? InstanceType<C> : any,
        type: SerializableType,
        serialize: (obj: any, type: SerializableType) => any,
    ): OutputType;
    deserialize(
        obj: OutputType,
        type: SerializableType,
        deserialize: (obj: any, type: SerializableType) => any,
        ...rest: C extends Constructor ? [factory: C] : []
    ): MaybeInstanceType<C>;
    conditionMethods?: {
        condition(val: MaybeInstanceType<C>): boolean;
        destructure?(val: MaybeInstanceType<C>): any;
    };
}): (getName: GetName) => TypeImpl {
    return getName => {
        let hasConditionMethods: boolean = Boolean(typeImpl.conditionMethods);
        let conditionFn: string | undefined;
        let destructureFn: string | undefined;
        if (hasConditionMethods) {
            conditionFn = injectNames(typeImpl.conditionMethods!.condition.toString(), getName);
            destructureFn = injectNames(typeImpl.conditionMethods!.destructure?.toString(), getName);
        }
        
        return {
            class: injectNames($class?.toString(), getName),
            serialize: injectNames(typeImpl.serialize.toString(), getName),
            deserialize: injectNames(typeImpl.deserialize.toString(), getName),
            conditionMethods: typeImpl.conditionMethods ? {
                condition: code => `(${conditionFn})(${code})`,
                destructure: destructureFn
                    ? code => `(${destructureFn})(${code})`
                    : undefined,
            } : undefined,
        };
    };
}

export interface ValueImpl {
    readonly emit: string;
}

export function jsValueImpl<T>(valueImpl: {
    emit: () => T
}): (getName: GetName) => ValueImpl {
    return getName => {
        return {
            emit: `(${injectNames(valueImpl.emit.toString(), getName)})()`,
        };
    }; 
}

export type JsLibraryImplementation<Interface extends LibraryInterface = any> = LibraryImplementation<
    Interface,
    (getName: GetName) => TypeImpl,
    (getName: GetName) => ValueImpl
>;