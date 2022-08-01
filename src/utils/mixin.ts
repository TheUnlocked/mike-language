import { Constructor } from './types';

export function mix<T extends Constructor, M extends Constructor>(target: T, mixin: M): asserts target is T & M {
    for (const prop of Object.getOwnPropertyNames(mixin.prototype)) {
        if (prop !== 'constructor') {
            target.prototype[prop] = mixin.prototype[prop];
        }
    }
}