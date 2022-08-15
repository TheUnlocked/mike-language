import { expect } from 'chai';
import { compileMiKeToJavascript as compile, compileMiKeToJavascriptWithoutExternals as compileToFn, getDebugFragments } from '../../util';

export default () => describe('parameters', () => {

    it('can handle primitive parameters', async () => {
        const program = await compile(`
            param i: int;
            param f: float;
            param s: string;
            param b: boolean;
        `);
        expect(program.params).deep.equals([
            { name: 'i', type: { variant: 'int' } },
            { name: 'f', type: { variant: 'float' } },
            { name: 's', type: { variant: 'string' } },
            { name: 'b', type: { variant: 'boolean' } },
        ]);
    });

    it('can have a Javascript keyword as a parameter', async () => {
        const program = await compile(`
            param case: string;
        `);
        expect(program.params).deep.equals([{ name: 'case', type: { variant: 'string' } }]);
    });

    it('can have certain special variables as parameter names', async () => {
        const program = await compile(`
            param externals: string;
            param globalThis: string;
        `);
        expect(program.params).deep.equals([
            { name: 'externals', type: { variant: 'string' } },
            { name: 'globalThis', type: { variant: 'string' } },
        ]);
    });

    it('works in runtime', async () => {
        const result = getDebugFragments(await compileToFn(`
            param a: int;
            param b: int;

            on test() {
                debug a + b;
            }
        `), {
            params: {
                a: 1n,
                b: 2n,
            }
        });
        
        expect(result).deep.equals([3n]);
    });

});