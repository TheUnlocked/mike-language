import { LibraryImplementation, LibraryInterface } from '../../library/Library';
import { Constructor } from '../../utils/types';

export interface SerializableType {
    readonly name: string;
    readonly typeArguments: readonly SerializableType[];
}

interface TypeImpl {
    readonly class?: string;
    readonly conditionMethods?: {
        readonly condition: (code: string) => string;
        readonly destructure?: (code: string) => string;
    };
    serialize: string;
    deserialize: string;
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
    return (getName) => {
        function injectNames<T extends string | undefined>(code: T): T {
            if (!code) {
                return undefined as T;
            }
            const result = code.replace(/__SAFE_NAME\(['"`]([^'"]*)['"`]\)/g, (_, name) => getName(name));
            if (result.includes('__SAFE_NAME')) {
                throw new Error(`Incorrect usage of __SAFE_NAME magic identifier: ${code}`);
            }
            return result as T;
        }

        let hasConditionMethods: boolean = Boolean(typeImpl.conditionMethods);
        let conditionFn: string | undefined;
        let destructureFn: string | undefined;
        if (hasConditionMethods) {
            conditionFn = injectNames(typeImpl.conditionMethods!.condition.toString());
            destructureFn = injectNames(typeImpl.conditionMethods!.destructure?.toString());
        }
        
        return {
            class: injectNames($class?.toString()),
            serialize: injectNames(typeImpl.serialize.toString()),
            deserialize: injectNames(typeImpl.deserialize.toString()),
            conditionMethods: typeImpl.conditionMethods ? {
                condition: code => `(${conditionFn})(${code})`,
                destructure: destructureFn
                    ? code => `(${destructureFn})(${code})`
                    : undefined,
            } : undefined,
        };
    };
}

interface ValueImpl {
    readonly emit: string;
}

export function jsValueImpl<T>(valueImpl: {
    emit: () => T
}): (getName: GetName) => ValueImpl {
    return (getName) => {
        function injectNames<T extends string | undefined>(code: T): T {
            if (!code) {
                return undefined as T;
            }
            const result = code.replace(/__SAFE_NAME\(['"`](.*?)['"`]\)/, (_, name) => getName(name));
            if (result.includes('__SAFE_NAME')) {
                throw new Error(`Incorrect usage of __SAFE_NAME magic identifier: ${code}`);
            }
            return result as T;
        }
        return {
            emit: `(${injectNames(valueImpl.emit.toString())})()`,
        };
    }; 
}

type GetName = (name: string) => string;

export type JsLibraryImplementation<Interface extends LibraryInterface = any> = LibraryImplementation<
    Interface,
    (getName: GetName) => TypeImpl,
    (getName: GetName) => ValueImpl
>;