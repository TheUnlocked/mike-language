import { expect, use } from 'chai';
import { Parser } from '../../src/parser/parser';
import chaiExclude from 'chai-exclude';

use(chaiExclude);

function testIncremental(title: string) {
    return ([part1, part2]: TemplateStringsArray, [remove, insert]: [remove: string, insert: string]) => {
        const original = part1 + remove + part2;
        const modified = part1 + insert + part2;

        it(title, () => {
            // Edit before initial parse
            const p1 = new Parser();
            p1.loadSource(original);
            p1.editSource(part1.length, remove.length, insert);
            
            // Edit after initial parse
            const p2 = new Parser();
            p2.loadSource(original);
            p2.parse();
            p2.editSource(part1.length, remove.length, insert);
            
            // No edit
            const p3 = new Parser();
            p3.loadSource(modified);
            const reference = p3.parse();
    
            expect(p1.parse()).excludingEvery(['_edits']).to.deep.equal(reference);
            expect(p2.parse()).excludingEvery(['_edits']).to.deep.equal(reference);
        });

    };
}

export default () => describe('incremental', () => {

    testIncremental('delete comment')`
        on foo() {
            ${['// abc', '']}
            let x = 1;
        }
    `;

    testIncremental('delete binary expression part')`
        on foo() {
            let x = 1;
            x = x${[' + 1', '']};
        }
    `;

    testIncremental('change start of binary expression')`
        on foo() {
            let x = 1;
            x = ${['1', 'x']} + x;
        }
    `;

    testIncremental('delete middle of string')`
        on foo() {
            debug "fi${['zzbu', '']}zz";
        }
    `;

    testIncremental('delete to combine strings')`
        on foo() {
            debug "fizz${['", "', '']}buzz";
        }
    `;

    testIncremental('delete end quote to create error')`
        on foo() {
            debug "fizzbuzz${['"', '']};
        }
    `;

    testIncremental('insert start quote to fix error')`
        on foo() {
            debug ${['', '"']}fizzbuzz";
        }
    `;

    testIncremental('insert end quote to fix error')`
        on foo() {
            debug "fizzbuzz${['', '"']};
        }
    `;


    testIncremental('delete a branch of an if-else-if chain')`
        on foo() {
            if true {
                foo();
            }
            ${[`else if a || b {
                bar();
            }`, '']}
            else {
                a.x = 5;
            }
        }
    `;

    testIncremental('insert a branch of an if-else-if chain')`
        on foo() {
            if true {
                foo();
            }
            ${['', `else if a || b {
                bar();
            }`]}
            else {
                a.x = 5;
            }
        }
    `;

    testIncremental('change a listener in a multi-listener program')`
        state x = 0;
    
        on foo() {
            let x = 1;
            ${[`x = 2`, `print(x)`]};
            debug x;
        }

        on bar() {
            
        }
    `;

});