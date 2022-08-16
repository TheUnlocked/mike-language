import { expect } from 'chai';
import { compileMiKeToJavascript as compile, compileMiKeToJavascriptWithoutExternals as compileToFn, getDebugFragments } from '../../util';

export default () => describe('serialization', () => {

    it('can serialize cycles', async () => {
        const result = [] as string[];
        const program = (await compileToFn(`
            type Foo(f: option<Foo>);

            state foo = Foo(none);

            on test() {
                foo.f = some(foo);
            }
        `))({ debug: result.push.bind(result) });

        const state = program.listeners.find(x => x.event === 'test')!.callback({
            args: [],
            params: {},
            state: Object.fromEntries(program.state.map(st => [st.name, st.default])),
        }).state;
        
        expect(JSON.parse(program.serialize(state))).deep.equals({
            objs: [{ f: 1 }, { hasValue: true, value: 0 }],
            refs: { foo: 0 }
        });
    });

    it('can deserialize multiple references to the same object', async () => {
        const result = [] as string[];
        const program = (await compileToFn(`
            type Pair(left: Box, right: Box);
            type Box(v: int);

            state p = Pair(Box(-1), Box(-1));

            on test() {
                p.left.v = 1;
                debug p.right.v;
            }
        `))({ debug: result.push.bind(result) });

        program.listeners.find(x => x.event === 'test')!.callback({
            args: [],
            params: {},
            state: program.deserialize(JSON.stringify({
                objs: [{ left: 1, right: 1 }, { v: 2 }, '0'],
                refs: { p: 0 }
            }))
        });
        
        expect(result).deep.equals([1n]);
    });

    it('can deserialize multiple references to the same object with stdlib objects', async () => {
        const result = [] as string[];
        const program = (await compileToFn(`
            state m: Map<Set<string>, Set<string>> = {};
            state s: Set<string> = [];

            on test() {
                if m.get(s) |set| {
                    set.add('a');
                    debug s.has('a');
                }
            }
        `))({ debug: result.push.bind(result) });

        program.listeners.find(x => x.event === 'test')!.callback({
            args: [],
            params: {},
            state: program.deserialize(JSON.stringify({
                objs: [[[1, 1]], []],
                refs: { m: 0, s: 1 }
            }))
        });
        
        expect(result).deep.equals([true]);
    });

    it('can deserialize cycles', async () => {
        const result = [] as string[];
        const program = (await compileToFn(`
            type Foo(v: int, f: option<Foo>);

            state foo = Foo(0, none);

            on test() {
                foo.v = 1;
                if foo.f |foo2| {
                    debug foo2.v;
                }
                else {
                    debug -1;
                }
            }
        `))({ debug: result.push.bind(result) });

        program.listeners.find(x => x.event === 'test')!.callback({
            args: [],
            params: {},
            state: program.deserialize(JSON.stringify({
                objs: [{ v: 1, f: 2 }, '1', { hasValue: true, value: 0 }],
                refs: { foo: 0 }
            }))
        });
        
        expect(result).deep.equals([1n]);
    });

    it('can deserialize clever-er cycles', async () => {
        const result = [] as string[];
        const program = (await compileToFn(`
            type Foo(s: Set<Foo>);

            state s: Set<Foo> = [];

            on test() {
                debug true;
            }
        `))({ debug: result.push.bind(result) });

        program.listeners.find(x => x.event === 'test')!.callback({
            args: [],
            params: {},
            state: program.deserialize(JSON.stringify({
                objs: [[1], { s: 0 }],
                refs: { s: 0 }
            }))
        });
        
        expect(result).deep.equals([true]);
    });

});