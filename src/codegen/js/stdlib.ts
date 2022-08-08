import { LibraryImplementation } from '../../library/Library';
import { StdlibInterface } from '../../library/stdlib';

const stdlibImpl: LibraryImplementation<StdlibInterface, string, string> = {
    types: {
        Array: {
            scaffolding: () => `
            class Array {
                constructor(arr = []) { this.arr = arr; }
                get(i) { return this.arr[i]; }
                set(i, v) {
                    if (i >= 0 && i < this.arr.length) {
                        this.arr[i] = v;
                    }
                }
                get length() { return BigInt(this.arr.length); }
            }
            `,
            makeSequence: arr => `new Queue(${arr})`,
        },
        Queue: {
            scaffolding: () => `
            class Queue {
                constructor(arr = []) { this.arr = arr; }
                enqueue(v) { this.arr.unshift(v); }
                pop(v) { return this.arr.pop(); }
                peek() { return this.arr.at(-1); }
                peekDeep(n) { return n < 0 ? undefined : this.arr.at(-Number(n) - 1); }
                get length() { return BigInt(this.arr.length); }
            }
            `,
            makeSequence: arr => `new Queue(${arr})`,
        },
        Stack: {
            scaffolding: () => `
            class Stack {
                constructor(arr = []) { this.arr = arr; }
                push(v) { this.arr.push(v); }
                pop(v) { return this.arr.pop(); }
                peek() { return this.arr.at(-1); }
                peekDeep(n) { return n < 0 ? undefined : this.arr.at(-Number(n) - 1); }
                get length() { return BigInt(this.arr.length); }
            }
            `,
            makeSequence: arr => `new Stack(${arr})`,
        },
        Set: {
            scaffolding: () => `
            class Set {
                constructor(arr = []) { this.set = new Set(arr); }
                add(v) { this.set.add(v); }
                delete(v) { return this.set.delete(v); }
                has(v) { return this.set.has(v); }
                get length() { return BigInt(this.set.size); }
            }
            `,
            makeSequence: arr => `new Set(${arr})`,
        },
    }
};