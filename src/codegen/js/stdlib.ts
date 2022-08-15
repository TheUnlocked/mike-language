import { StdlibInterface } from '../../library/stdlib';
import { jsTypeImpl, JsLibraryImplementation, jsValueImpl } from './LibraryImpl';

declare function __SAFE_NAME<T = any>(name: string): T;

const jsStdlibImpl: JsLibraryImplementation<StdlibInterface> = {
    types: {
        Array: jsTypeImpl(
            class Array<T> {
                _arr: T[];
                constructor(arr: T[]) { this._arr = [...arr]; }
                get(i: number) {
                    return i < 0 || i >= this._arr.length
                        ? __SAFE_NAME('none')
                        : __SAFE_NAME('some')(this._arr[i]);
                }
                set(i: number, v: T) {
                    if (i >= 0 && i < this._arr.length) {
                        this._arr[i] = v;
                        return true;
                    }
                    return false;
                }
                get length() { return globalThis.BigInt(this._arr.length); }
            },
            {
                serialize: (obj, { typeArguments: [t] }, serialize) =>
                    obj._arr.map(elt => serialize(elt, t)),
                deserialize: (obj, { typeArguments: [t] }, deserialize, Array) =>
                    new Array(obj.map(x => deserialize(x, t))),
            }
        ),
        Queue: jsTypeImpl(
            class Queue<T> {
                _arr: T[];
                constructor(arr: T[]) { this._arr = [...arr]; }
                enqueue(v: T) { this._arr.push(v); }
                pop() {
                    const result = this._arr.shift();
                    return result === undefined ? __SAFE_NAME('none') : __SAFE_NAME('some')(result);
                }
                peek() {
                    const result = this._arr[0];
                    return result === undefined ? __SAFE_NAME('none') : __SAFE_NAME('some')(result);
                }
                get length() { return globalThis.BigInt(this._arr.length); }
            },
            {
                serialize: (obj, { typeArguments: [t] }, serialize) =>
                    obj._arr.map(elt => serialize(elt, t)),
                deserialize: (obj, { typeArguments: [t] }, deserialize, Queue) =>
                    new Queue(obj.map(x => deserialize(x, t))),
            }
        ),
        Stack: jsTypeImpl(
            class Stack<T> {
                _arr: T[];
                constructor(arr: T[]) { this._arr = [...arr]; }
                push(v: T) { this._arr.push(v); }
                pop() {
                    const result = this._arr.pop();
                    return result === undefined ? __SAFE_NAME('none') : __SAFE_NAME('some')(result);
                }
                peek() {
                    const result = this._arr.at(-1);
                    return result === undefined ? __SAFE_NAME('none') : __SAFE_NAME('some')(result);
                }
                get length() { return globalThis.BigInt(this._arr.length); }
            },
            {
                serialize: (obj, { typeArguments: [t] }, serialize) =>
                    obj._arr.map(elt => serialize(elt, t)),
                deserialize: (obj, { typeArguments: [t] }, deserialize, Stack) =>
                    new Stack(obj.map(x => deserialize(x, t))),
            }
        ),
        Set: jsTypeImpl(
            class Set<T> {
                _set: globalThis.Set<T>;
                constructor(arr: T[]) { this._set = new globalThis.Set(arr); }
                add(v: T) { this._set.add(v); }
                remove(v: T) { return this._set.delete(v); }
                has(v: T) { return this._set.has(v); }
                get length() { return globalThis.BigInt(this._set.size); }
            },
            {
                serialize: (obj, { typeArguments: [t] }, serialize) =>
                    [...obj._set].map(elt => serialize(elt, t)),
                deserialize: (obj, { typeArguments: [t] }, deserialize, Set) =>
                    new Set(obj.map(x => deserialize(x, t))),
            }
        ),
        // TODO: Improve this implementation (with a doubly linked list and a map it can have O(1) for every operation)
        QueueSet: jsTypeImpl(
            class QueueSet<T> {
                _set: Set<T>;
                constructor(arr: T[]) { this._set = new globalThis.Set(arr); }
                enqueue(v: T) { this._set.add(v); }
                pop() {
                    const value = this._set[globalThis.Symbol.iterator]().next().value;
                    if (value === undefined) {
                        return __SAFE_NAME('none');
                    }
                    this._set.delete(value);
                    return __SAFE_NAME('some')(value);
                }
                peek() {
                    const value = this._set[globalThis.Symbol.iterator]().next().value;
                    return value === undefined ? __SAFE_NAME('none') : __SAFE_NAME('some')(value);
                }
                remove(v: T) { return this._set.delete(v); }
                has(v: T) { return this._set.has(v); }
                get length() { return globalThis.BigInt(this._set.size); }
            },
            {
                serialize: (obj, { typeArguments: [t] }, serialize) =>
                    [...obj._set].map(elt => serialize(elt, t)),
                deserialize: (obj, { typeArguments: [t] }, deserialize, QueueSet) =>
                    new QueueSet(obj.map(x => deserialize(x, t))),
            }
        ),
        Map: jsTypeImpl(
            class Map<K, V> {
                _map: globalThis.Map<K, V>;
                constructor(pairs: [K, V][]) { this._map = new globalThis.Map(pairs); }
                set(k: K, v: V) { this._map.set(k, v); }
                remove(k: K) { return this._map.delete(k) }
                get(k: K) {
                    const result = this._map.get(k);
                    return result === undefined ? __SAFE_NAME('none') : __SAFE_NAME('some')(result);
                }
                has(k: K) { return this._map.has(k); }
                get length() { return globalThis.BigInt(this._map.size); }
            },
            {
                serialize: (obj, { typeArguments: [k, v] }, serialize) =>
                    [...obj._map].map(([key, val]) => [serialize(key, k), serialize(val, v)]),
                deserialize: (obj, { typeArguments: [k, v] }, deserialize, Map) =>
                    new Map(obj.map(([key, val]) => [deserialize(key, k), deserialize(val, v)])),
            }
        ),
        option: jsTypeImpl(
            class Option<T> {
                constructor(public readonly hasValue: boolean, public readonly value?: T) {
                }
                getOrDefault(x: T) { return this.hasValue ? this.value! : x; }
            },
            {
            conditionMethods: {
                condition: v => v.hasValue,
                destructure: v => v.value,
            },
            serialize: (obj, { typeArguments: [t] }, serialize) => obj.hasValue
                ? { hasValue: true, value: serialize(obj.value, t) }
                : { hasValue: false },
            deserialize: (obj, { typeArguments: [t] }, deserialize, Option) => obj.hasValue
                ? new Option(true, deserialize(obj.value, t))
                : new Option(false),
        }),
    },
    values: {
        none: jsValueImpl({ emit: () => new (__SAFE_NAME('option'))(false) }),
        some: jsValueImpl({ emit: () => (value: any) => new (__SAFE_NAME('option'))(true, value) }),
        toInt: jsValueImpl({
            emit: () => (f: number) => f % 1 === 0 ? __SAFE_NAME('some')(globalThis.BigInt(f)) : __SAFE_NAME('none')
        }),
        toFloat: jsValueImpl({ emit: () => (i: BigInt) => globalThis.Number(i) }),
    }
};

export default jsStdlibImpl;
