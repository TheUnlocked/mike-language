import { expect } from 'chai';
import { compileMiKeToJavascriptWithoutExternals as compile, compileMiKeToJavascript as compileDefault, getDebugFragments, getStateAfterRunning } from '../../util';
import { none, some } from './util';

export default () => describe('stdlib', () => {

    describe('types', () => {

        describe('Array', () => {

            it('get', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let arr = Array[1, 2, 3];
                        debug arr.get(0), arr.get(2), arr.get(-1), arr.get(3);
                    }
                `));
                expect(result).deep.equals([
                    some(1n),
                    some(3n),
                    none,
                    none,
                ]);
            });

            it('set', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let arr = Array[1, 2, 3];
                        debug arr.set(1, 9), arr.set(-1, 2), arr.set(3, 0);
                        debug arr.get(0), arr.get(1), arr.get(-1);
                    }
                `));
                expect(result).deep.equals([
                    true,
                    false,
                    false,
                    some(1n),
                    some(9n),
                    none,
                ]);
            });

            it('length', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let arr1: Array<int> = [];
                        let arr2 = Array[1, 2, 3];

                        debug arr1.length, arr2.length;
                        arr2.set(3, 1);
                        debug arr2.length;
                    }
                `));
                expect(result).deep.equals([
                    0n,
                    3n,
                    3n,
                ]);
            });

            it('serialize/deserialize', async () => {
                const program = await compileDefault(`
                    state s: Array<int> = [];

                    on test() {
                        if s.length == 0 {
                            s = [1, 2, 3];
                        }
                        else {
                            s.set(0, 7);
                            s.set(-1, 2);
                        }
                    }
                `);

                const st1 = program.serialize(getStateAfterRunning(program).state);

                expect(JSON.parse(st1)).deep.equals({
                    objs: [[1, 2, 3], '1', '2', '3'],
                    refs: { s: 0 }
                });

                const st2 = program.serialize(getStateAfterRunning(program, {
                    state: program.deserialize(st1)
                }).state);

                expect(JSON.parse(st2)).deep.equals({
                    objs: [[1, 2, 3], '7', '2', '3'],
                    refs: { s: 0 }
                });
            });

        });

        describe('Queue', () => {

            it('pop', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let q = Queue[3, 2, 1];
                        debug q.pop(), q.pop(), q.pop(), q.pop(), q.pop();
                    }
                `));
                expect(result).deep.equals([
                    some(3n),
                    some(2n),
                    some(1n),
                    none,
                    none,
                ]);
            });

            it('peek', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let q = Queue[3, 2, 1];
                        debug q.peek();
                        q.pop();
                        q.pop();
                        debug q.peek();
                        q.pop();
                        debug q.peek();
                    }
                `));
                expect(result).deep.equals([
                    some(3n),
                    some(1n),
                    none,
                ]);
            });

            it('enqueue', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let q: Queue<string> = ['a'];
                        q.enqueue('b');
                        q.enqueue('c');
                        debug q.peek(), q.pop(), q.peek(), q.pop(), q.pop();
                    }
                `));
                expect(result).deep.equals([
                    some('a'),
                    some('a'),
                    some('b'),
                    some('b'),
                    some('c'),
                ]);
            });

            it('length', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let q: Queue<int> = [0];
                        debug q.length;
                        q.enqueue(1);
                        debug q.length;
                        q.peek();
                        debug q.length;
                        q.pop();
                        debug q.length;
                        q.pop();
                        q.pop();
                        debug q.length;
                    }
                `));
                expect(result).deep.equals([
                    1n,
                    2n,
                    2n,
                    1n,
                    0n,
                ]);
            });

            it('serialize/deserialize', async () => {
                const program = await compileDefault(`
                    state s: Queue<int> = [];

                    on test() {
                        if s.length == 0 {
                            s = [1, 2, 3];
                        }
                        else {
                            s.enqueue(4);
                            s.pop();
                            s.enqueue(5);
                        }
                    }
                `);

                const st1 = program.serialize(getStateAfterRunning(program).state);

                expect(JSON.parse(st1)).deep.equals({
                    objs: [[1, 2, 3], '1', '2', '3'],
                    refs: { s: 0 }
                });

                const st2 = program.serialize(getStateAfterRunning(program, {
                    state: program.deserialize(st1)
                }).state);

                expect(JSON.parse(st2)).deep.equals({
                    objs: [[1, 2, 3, 4], '2', '3', '4', '5'],
                    refs: { s: 0 }
                });

            });

        });

        describe('Stack', () => {

            it('pop', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let s = Stack[1, 2, 3];
                        debug s.pop(), s.pop(), s.pop(), s.pop(), s.pop();
                    }
                `));
                expect(result).deep.equals([
                    some(3n),
                    some(2n),
                    some(1n),
                    none,
                    none,
                ]);
            });

            it('peek', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let s = Stack[1, 2, 3];
                        debug s.peek();
                        s.pop();
                        s.pop();
                        debug s.peek();
                        s.pop();
                        debug s.peek();
                    }
                `));
                expect(result).deep.equals([
                    some(3n),
                    some(1n),
                    none,
                ]);
            });

            it('push', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let s: Stack<string> = ['a'];
                        s.push('b');
                        s.push('c');
                        debug s.peek(), s.pop(), s.peek(), s.pop(), s.pop();
                    }
                `));
                expect(result).deep.equals([
                    some('c'),
                    some('c'),
                    some('b'),
                    some('b'),
                    some('a'),
                ]);
            });

            it('length', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let s: Stack<int> = [0];
                        debug s.length;
                        s.push(1);
                        debug s.length;
                        s.peek();
                        debug s.length;
                        s.pop();
                        debug s.length;
                        s.pop();
                        s.pop();
                        debug s.length;
                    }
                `));
                expect(result).deep.equals([
                    1n,
                    2n,
                    2n,
                    1n,
                    0n,
                ]);
            });

            it('serialize/deserialize', async () => {
                const program = await compileDefault(`
                    state s: Stack<int> = [];

                    on test() {
                        if s.length == 0 {
                            s = [1, 2, 3];
                        }
                        else {
                            s.push(4);
                            s.pop();
                            s.push(5);
                        }
                    }
                `);

                const st1 = program.serialize(getStateAfterRunning(program).state);

                expect(JSON.parse(st1)).deep.equals({
                    objs: [[1, 2, 3], '1', '2', '3'],
                    refs: { s: 0 }
                });

                const st2 = program.serialize(getStateAfterRunning(program, {
                    state: program.deserialize(st1)
                }).state);

                expect(JSON.parse(st2)).deep.equals({
                    objs: [[1, 2, 3, 4], '1', '2', '3', '5'],
                    refs: { s: 0 }
                });

            });

        });

        describe('Set', () => {

            it('has', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let s = Set[1, 2, 3];
                        debug s.has(1), s.has(0), s.has(3);
                    }
                `));
                expect(result).deep.equals([
                    true,
                    false,
                    true,
                ]);
            });

            it('add', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let s = Set[1];
                        debug s.has(5);
                        s.add(5);
                        debug s.has(5), s.has(10);
                        s.add(10);
                        debug s.has(10), s.has(5), s.has(1), s.has(6);
                    }
                `));
                expect(result).deep.equals([
                    false,
                    true,
                    false,
                    true,
                    true,
                    true,
                    false,
                ]);
            });

            it('remove', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let s = Set[1, 2];
                        debug s.remove(1), s.remove(0);
                        debug s.has(1), s.has(0), s.has(2);
                    }
                `));
                expect(result).deep.equals([
                    true,
                    false,
                    false,
                    false,
                    true,
                ]);
            });

            it('length', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let s: Set<int> = [1];
                        debug s.length;
                        s.add(1);
                        debug s.length;
                        s.add(2);
                        debug s.length;
                        s.remove(1);
                        debug s.length;
                    }
                `));
                expect(result).deep.equals([
                    1n,
                    1n,
                    2n,
                    1n,
                ]);
            });

            it('serialize/deserialize', async () => {
                const program = await compileDefault(`
                    state s: Set<int> = [];

                    on test() {
                        if s.length == 0 {
                            s = [1, 2, 3];
                        }
                        else {
                            s.remove(2);
                            s.remove(3);
                            s.add(4);
                        }
                    }
                `);

                const st1 = program.serialize(getStateAfterRunning(program).state);

                expect(JSON.parse(st1)).deep.equals({
                    objs: [[1, 2, 3], '1', '2', '3'],
                    refs: { s: 0 }
                });

                const st2 = program.serialize(getStateAfterRunning(program, {
                    state: program.deserialize(st1)
                }).state);

                expect(JSON.parse(st2)).deep.equals({
                    objs: [[1, 2], '1', '4'],
                    refs: { s: 0 }
                });

            });

        });

        describe('QueueSet', () => {

            it('has', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let q = QueueSet[1, 2, 3];
                        debug q.has(1), q.has(0), q.has(3);
                    }
                `));
                expect(result).deep.equals([
                    true,
                    false,
                    true,
                ]);
            });

            it('pop', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let q = QueueSet[3, 2, 1];
                        debug q.pop(), q.pop(), q.pop(), q.pop(), q.pop();
                    }
                `));
                expect(result).deep.equals([
                    some(3n),
                    some(2n),
                    some(1n),
                    none,
                    none,
                ]);
            });

            it('enqueue', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let q: QueueSet<string> = ['a'];
                        q.enqueue('b');
                        q.enqueue('c');
                        q.enqueue('b');
                        q.enqueue('a');
                        debug q.pop(), q.pop(), q.pop(), q.pop();
                    }
                `));
                expect(result).deep.equals([
                    some('a'),
                    some('b'),
                    some('c'),
                    none,
                ]);
            });

            it('remove', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let q = QueueSet[1, 2];
                        debug q.remove(1), q.remove(1), q.remove(3);
                        q.enqueue(3);
                        debug q.remove(3);
                    }
                `));
                expect(result).deep.equals([
                    true,
                    false,
                    false,
                    true,
                ]);
            });

            it('peek', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let q = QueueSet[3, 2, 1];
                        debug q.peek();
                        q.enqueue(3);
                        debug q.peek();
                        q.remove(3);
                        q.enqueue(3);
                        debug q.peek();
                        q.pop();
                        q.pop();
                        debug q.peek();
                        q.pop();
                        debug q.peek();
                    }
                `));
                expect(result).deep.equals([
                    some(3n),
                    some(3n),
                    some(2n),
                    some(3n),
                    none,
                ]);
            });

            it('length', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let s: QueueSet<int> = [1];
                        debug s.length;
                        s.enqueue(1);
                        debug s.length;
                        s.enqueue(2);
                        s.enqueue(3);
                        debug s.length;
                        s.remove(2);
                        debug s.length;
                    }
                `));
                expect(result).deep.equals([
                    1n,
                    1n,
                    3n,
                    2n,
                ]);
            });

            it('serialize/deserialize', async () => {
                const program = await compileDefault(`
                    state s: QueueSet<int> = [];

                    on test() {
                        if s.length == 0 {
                            s = [1, 2, 3];
                        }
                        else {
                            s.enqueue(1);
                            s.remove(2);
                            s.remove(3);
                            s.enqueue(4);
                        }
                    }
                `);

                const st1 = program.serialize(getStateAfterRunning(program).state);

                expect(JSON.parse(st1)).deep.equals({
                    objs: [[1, 2, 3], '1', '2', '3'],
                    refs: { s: 0 }
                });

                const st2 = program.serialize(getStateAfterRunning(program, {
                    state: program.deserialize(st1)
                }).state);

                expect(JSON.parse(st2)).deep.equals({
                    objs: [[1, 2], '1', '4'],
                    refs: { s: 0 }
                });

            });

        });

        describe('Map', () => {

            it('has', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let m = Map{ 'a': 1, 'b': 2 };
                        debug m.has('a'), m.has('b'), m.has('c');
                    }
                `));
                expect(result).deep.equals([
                    true,
                    true,
                    false,
                ]);
            });

            it('get', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let m = Map{ 'a': 1, 'b': 2 };
                        debug m.get('a'), m.get('b'), m.get('c');
                    }
                `));
                expect(result).deep.equals([
                    some(1n),
                    some(2n),
                    none,
                ]);
            });

            it('put', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let m = Map{ 'a': 1, 'b': 2 };
                        m.set('c', 3);
                        debug m.get('c');
                        m.set('b', 10);
                        m.set('c', 11);
                        debug m.get('c'), m.get('b');
                    }
                `));
                expect(result).deep.equals([
                    some(3n),
                    some(11n),
                    some(10n),
                ]);
            });

            it('remove', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let m = Map{ 'a': 1, 'b': 2 };
                        debug m.remove('a'), m.remove('a');
                        m.set('c', 3);
                        debug m.remove('d'), m.remove('c');
                    }
                `));
                expect(result).deep.equals([
                    true,
                    false,
                    false,
                    true,
                ]);
            });

            it('length', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let m: Map<string, int> = { 'a': 1 };
                        debug m.length;
                        m.set('b', 2);
                        debug m.length;
                        m.set('b', 2);
                        debug m.length;
                        m.remove('a');
                        debug m.length;
                    }
                `));
                expect(result).deep.equals([
                    1n,
                    2n,
                    2n,
                    1n,
                ]);
            });

            it('serialize/deserialize', async () => {
                const program = await compileDefault(`
                    state s: Map<string, int> = {};

                    on test() {
                        if s.length == 0 {
                            s = { 'a': 1, 'b': 2, 'c': 3 };
                        }
                        else {
                            s.remove('a');
                            s.remove('b');
                            s.set('d', 4);
                        }
                    }
                `);

                const st1 = program.serialize(getStateAfterRunning(program).state);

                expect(JSON.parse(st1)).deep.equals({
                    objs: [[[1, 2], [3, 4], [5, 6]], 'a', '1', 'b', '2', 'c', '3'],
                    refs: { s: 0 }
                });

                const st2 = program.serialize(getStateAfterRunning(program, {
                    state: program.deserialize(st1)
                }).state);

                expect(JSON.parse(st2)).deep.equals({
                    objs: [[[1, 2], [3, 4]], 'c', '3', 'd', '4'],
                    refs: { s: 0 }
                });

            });

        });

        describe('option', () => {

            it('hasValue', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        debug some(1).hasValue, none.hasValue;
                    }
                `));
                expect(result).deep.equals([
                    true,
                    false,
                ]);
            });

            it('getOrDefault', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        debug some(1).getOrDefault(10), none.getOrDefault(10);
                        let f = some(1).getOrDefault;
                        debug f(10);
                    }
                `));
                expect(result).deep.equals([
                    1n,
                    10n,
                    1n,
                ]);
            });

            it('condition', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        if some(1) {
                            debug 1;
                        }
                    }
                `));
                expect(result).deep.equals([
                    1n,
                ]);
            });

            it('destructure', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        if some(1) |x| {
                            debug x;
                        }
                    }
                `));
                expect(result).deep.equals([
                    1n,
                ]);
            });

            it('nesting', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        if some(none) |x| {
                            debug x.hasValue;
                        }
                    }
                `));
                expect(result).deep.equals([
                    false,
                ]);
            });

            it('serialize/deserialize', async () => {
                const program = await compileDefault(`
                    state s: option<int> = none;

                    on test() {
                        if s {
                            s = none;
                        }
                        else {
                            s = some(4);
                        }
                    }
                `);

                const st1 = program.serialize(getStateAfterRunning(program).state);

                expect(JSON.parse(st1)).deep.equals({
                    objs: [{ hasValue: true, value: 1 }, '4'],
                    refs: { s: 0 }
                });

                const st2 = program.serialize(getStateAfterRunning(program, {
                    state: program.deserialize(st1)
                }).state);

                expect(JSON.parse(st2)).deep.equals({
                    objs: [{ hasValue: false }],
                    refs: { s: 0 }
                });

            });

        });

    });

    describe('values', () => {

        it('none', async () => {
            const result = getDebugFragments(await compile(`
                on test() {
                    debug none;
                    debug none.hasValue;
                    if none |x| {
                        debug x;
                    }
                }
            `));
            expect(result).deep.equals([
                none,
                false,
            ]);
        });

        it('some', async () => {
            const result = getDebugFragments(await compile(`
                on test() {
                    debug some(1);
                    debug some(false).hasValue;
                    if some('abc') |x| {
                        debug x;
                    }
                }
            `));
            expect(result).deep.equals([
                some(1n),
                true,
                'abc',
            ]);
        });

        it('toInt', async () => {
            const result = getDebugFragments(await compile(`
                on test() {
                    debug toInt(1.0), toInt(0.0), toInt(-1.0), toInt(1.2), toInt(1e400), toInt(0.0/0.0);
                }
            `));
            
            expect(result).deep.equals([
                some(1n),
                some(0n),
                some(-1n),
                none,
                none,
                none,
            ]);
        });

        it('toFloat', async () => {
            const result = getDebugFragments(await compile(`
                on test() {
                    debug toFloat(1), toFloat(0), toFloat(-1), toFloat(${Number.MAX_SAFE_INTEGER} + 2)
                        , toFloat(${String(10n**400n)}), toFloat(-${String(10n**400n)});
                }
            `));
            
            expect(result).deep.equals([
                1,
                0,
                -1,
                Number.MAX_SAFE_INTEGER + 1, // MAX_SAFE_INTEGER + 1 === MAX_SAFE_INTEGER + 2
                Infinity,
                -Infinity,
            ]);
        });

    });
    
});