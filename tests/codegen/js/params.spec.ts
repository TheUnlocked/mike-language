import { expect } from 'chai';
import { compileMiKeToJavascript as compile, compileMiKeToJavascriptWithoutExternals as compileToFn, createOptionFieldParamFunctions, getDebugFragments } from '../../util';

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

    describe('runtime', () => {

        it('int', async () => {
            const result = getDebugFragments(await compileToFn(`
                param a: int;
                param b: int;
    
                on test() {
                    debug a + b;
                }
            `), {
                getIntParam: name => ({ a: 1n, b: 2n })[name]!
            });
            
            expect(result).deep.equals([3n]);
        });

        it('float', async () => {
            const result = getDebugFragments(await compileToFn(`
                param a: float;
                param b: float;
    
                on test() {
                    debug a + b;
                }
            `), {
                getFloatParam: name => ({ a: 1, b: 2.3 })[name]!
            });
            
            expect(result).deep.equals([3.3]);
        });

        it('string', async () => {
            const result = getDebugFragments(await compileToFn(`
                param a: string;
    
                on test() {
                    debug a;
                }
            `), {
                getStringParam: name => ({ a: "Hello, World!" })[name]!
            });
            
            expect(result).deep.equals(["Hello, World!"]);
        });

        it('boolean', async () => {
            const result = getDebugFragments(await compileToFn(`
                param a: boolean;
                param b: boolean;
    
                on test() {
                    debug a, b;
                }
            `), {
                getBooleanParam: name => ({ a: true, b: false })[name]!
            });
            
            expect(result).deep.equals([true, false]);
        });

        it('option', async () => {
            const result = getDebugFragments(await compileToFn(`
                param a: option<int>;
                param b: option<int>;
    
                on test() {
                    debug a.getOrDefault(1) + b.getOrDefault(1);
                }
            `), {
                getOptionParam: name => ({
                    a: createOptionFieldParamFunctions({ getIntParam: () => 3n }),
                    b: undefined,
                })[name]
            });
            
            expect(result).deep.equals([4n]);
        });

    });

});