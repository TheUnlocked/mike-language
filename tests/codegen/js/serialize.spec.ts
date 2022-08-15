import { expect } from 'chai';
import { compileMiKeToJavascript as compile, compileMiKeToJavascriptWithoutExternals as compileToFn, getDebugFragments } from '../../util';

export default () => describe('parameters', () => {

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

});