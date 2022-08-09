import { LibraryImplementation } from '../../library/Library';
import { StdlibInterface } from '../../library/stdlib';

const jsStdlibImpl: LibraryImplementation<StdlibInterface, string, string> = {
    types: {
        Array: {
            scaffolding: () => `
            class Array {
                constructor(arr = []) { this._arr = [...arr]; }
                get: i => this._arr[i];
                set: (i, v) => {
                    if (i >= 0 && i < this._arr.length) {
                        this._arr[i] = v;
                    }
                };
                get length() { return globalThis.BigInt(this._arr.length); }
            }
            `,
            makeSequence: arr => `new Queue(${arr})`,
        },
        Queue: {
            scaffolding: () => `
            class Queue {
                constructor(arr = []) { this._arr = [...arr]; }
                enqueue = v => { this._arr.unshift(v); };
                pop = v => this._arr.pop();
                peek = () => this._arr.at(-1);
                get length() { return globalThis.BigInt(this._arr.length); }
            }
            `,
            makeSequence: arr => `new Queue(${arr})`,
        },
        Stack: {
            scaffolding: () => `
            class Stack {
                constructor(arr = []) { this._arr = [...arr]; }
                push = v => { this._arr.push(v); };
                pop = v => this._arr.pop();
                peek = () => this._arr.at(-1);
                get length() { return globalThis.BigInt(this._arr.length); }
            }
            `,
            makeSequence: arr => `new Stack(${arr})`,
        },
        Set: {
            scaffolding: () => `
            class Set {
                constructor(arr = []) { this._set = new globalthis.Set(arr); }
                add = v => { this._set.add(v); };
                remove = v => this._set.delete(v);
                has = v => this._set.has(v);
                get length() { return globalThis.BigInt(this._set.size); }
            }
            `,
            makeSequence: arr => `new Set(${arr})`,
        },
        QueueSet: {
            scaffolding: () => `
            class QueueSet {
                constructor(arr = []) { this._set = new globalthis.Set([...arr].reverse()); }
                enqueue = v => { this._set.add(v); };
                pop = () => {
                    const value = this._set[globalThis.Symbol.iterator]().next().value;
                    if (value === undefined) {
                        this._set.delete(value);
                        return some(value);
                    }
                    return none;
                };
                peek = () => {
                    const value = this._set[globalThis.Symbol.iterator]().next().value;
                    return value === undefined ? none : some(value);
                };
                remove = v => this._set.delete(v);
                has = v => this._set.has(v);
                get length() { return globalThis.BigInt(this._set.size); }
            }
            `,
            makeSequence: arr => `new QueueSet(${arr})`,
        },
        Map: {
            scaffolding: () => `
            class Map {
                constructor(pairs = []) { this._map = new globalthis.Map(pairs); }
                set = (k, v) => { this._map.set(k, v); };
                remove = k => this._map.delete(k);
                get = k => this._map.get(k);
                has = k => this._map.has(k);
                get length() { return globalThis.BigInt(this._map.size); }
            }
            `,
            makeSequence: pairs => `new Map(${pairs})`,
        },
        option: {
            conditionMethods: {
                condition: v => `${v}.hasValue`,
                destructure: v => `${v}.value`,
            },
        },
    },
    values: {
        none: { emit: '{hasValue:false}' },
        some: { emit: 'value=>({hasValue:true,value})' },
        toInt: { emit: 'f=>f%1===0?some(globalThis.BigInt(f)):none' },
        toFloat: { emit: 'i=>globalThis.Number(i)' },
    }
};

export default jsStdlibImpl;
