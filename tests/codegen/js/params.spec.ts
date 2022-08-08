import { expect } from 'chai';
import { compileJs } from '../../util';

export default () => describe('parameters', () => {

    compileJs`
        param i: int;
        param f: float;
        param s: string;
        param b: boolean;
    `.thenIt('can handle primitive parameters', program => {
        expect(program.params).deep.equals([
            { name: 'i', type: 'int' },
            { name: 'f', type: 'float' },
            { name: 's', type: 'string' },
            { name: 'b', type: 'boolean' },
        ]);
    });

    compileJs`
        param case: string;
    `.thenIt('can have a Javascript keyword as a parameter', program => {
        expect(program.params).deep.equals([{ name: 'case', type: 'string' }]);
    });

});