import { expect } from 'chai';
import { compileMiKeToJavascriptWithoutExternals as compile, getDebugFragments } from '../../util';

export default () => describe('control', () => {

    describe('if/else', () => {

        it('if', async () => {
            const result = getDebugFragments(await compile(`
                on test() {
                    if true {
                        debug 1;
                    }
                    if false {
                        debug 2;
                    }
                    debug 3;
                }
            `));
            expect(result).deep.equals([
                1n,
                3n,
            ]);
        });

        it('if/else', async () => {
            const result = getDebugFragments(await compile(`
                on test() {
                    if true {
                        debug 1;
                    }
                    else {
                        debug 2;
                    }
                    if false {
                        debug 3;
                    }
                    else {
                        debug 4;
                    }
                }
            `));
            expect(result).deep.equals([
                1n,
                4n,
            ]);
        });

        it('if/else if', async () => {
            const result = getDebugFragments(await compile(`
                on test() {
                    if true {
                        debug 1;
                    }
                    else if true {
                        debug 2;
                    }
                    if false {
                        debug 3;
                    }
                    else if false {
                        debug 4;
                    }
                    else if true {
                        debug 4;
                    }
                }
            `));
            expect(result).deep.equals([
                1n,
                4n,
            ]);
        });

        it('if/else if/else', async () => {
            const result = getDebugFragments(await compile(`
                on test() {
                    if true {
                        debug 1;
                    }
                    else if true {
                        debug 2;
                    }
                    else {
                        debug 3;
                    }
                    if false {
                        debug 4;
                    }
                    else if false {
                        debug 5;
                    }
                    else {
                        debug 6;
                    }
                }
            `));
            expect(result).deep.equals([
                1n,
                6n,
            ]);
        });

    });
    
});