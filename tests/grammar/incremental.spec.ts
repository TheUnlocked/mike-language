import { expect, use } from 'chai';
import { Parser } from '../../src/parser/parser';
import chaiExclude from 'chai-exclude';
import { createMiKeDiagnosticsManager } from '../../src/diagnostics';

use(chaiExclude);

function testIncremental(title: string) {
    return ([part1, part2]: TemplateStringsArray, [remove, insert]: [remove: string, insert: string]) => {
        function performTest(remove: string, insert: string) {
            const original = part1 + remove + part2;
            const modified = part1 + insert + part2;

            // Edit
            const d1 = createMiKeDiagnosticsManager();
            const p1 = new Parser();
            p1.setDiagnostics(d1.getReporter('mike'));
            p1.loadSource(original);
            p1.parse();
            d1.clear();
            p1.editSource(part1.length, remove.length, insert);
            
            // No edit
            const d2 = createMiKeDiagnosticsManager();
            const p2 = new Parser();
            p2.setDiagnostics(d2.getReporter('mike'));
            p2.loadSource(modified);
            const reference = p2.parse();
    
            expect(p1.parse()).excludingEvery(['_edits']).to.deep.equal(reference);

            expect(d1.getDiagnostics()).to.deep.equal(d2.getDiagnostics());
        }

        describe(title, () => {
            it('forwards', () => {
                performTest(remove, insert);
            });
            it('reverse', () => {
                performTest(insert, remove);
            });
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

    testIncremental('remove left parenthesis to make listener invalid')`
        on bar${['(', '']}) {
            
        }
    `;

    testIncremental('remove right parenthesis to make listener invalid')`
        on bar(${[')', '']} {
            
        }
    `;

    testIncremental('add "on" keyword to create listener')`
        ${['on', '']} foo() {
            
        }
    `;

    testIncremental('add whitespace before listener')`
        ${['', ' ']}on foo() {
            
        }
    `;

    testIncremental('append characters to identifier')`
        on foo() {
            let x${['', 'yz']} = 1;
        }
    `;

    testIncremental('make change in the presence of parser diagnostic earlier in file')`
        on foo() {
            x
        }

        on bar() {
            let x = ${['1', '15']};
        }
    `;

    testIncremental('make change in the presence of parser diagnostic later in file')`
        on foo() {
            let x = ${['1', '15']};
        }

        on bar() {
            x
        }
    `;

    testIncremental('make change which would shift lexer diagnostic to another column')`
        on foo() {
            let x = ${['1', '15']}; @
        }
    `;

    testIncremental('make change which would shift lexer diagnostic to another line')`
        on foo() {
            let x = ${['1', `"
            "`]}; @
        }
    `;

    testIncremental('make change which would shift parser diagnostic to another column')`
        on foo() {
            let x = ${['1', '15']}; x123
        }
    `;

    testIncremental('make change which would shift parser diagnostic to another line')`
        on foo() {
            let x = ${['1', `
                1`]}; x123
        }
    `;

    testIncremental('insert into empty document')`${['', `
        on foo() {
            let x = 1;
        }
    `]}`;

    testIncremental('modify condition in if statement')`
        on foo() {
            let x = 1;
            if x ${['', '== 1']} {

            }
        }
    `;

    testIncremental('modify identifier to create else keyword')`
        on foo() {
            if true {

            }
            els${['', 'e']} {

            }
        }
    `;

    it('should be a no-op if a mutation is reversed', () => {
        const p1 = new Parser();
        //            0    5    10   15   20   25   30   35   40
        const code = 'on test() { debug "this is a test", 15; }';
        p1.loadSource(code);
        p1.parse();
        p1.editSource(19, 4, 'x');
        p1.parse();
        p1.editSource(19, 1, 'this');
        const mutated = p1.parse();
        
        const p2 = new Parser();
        p2.loadSource(code);
        const reference = p2.parse();

        expect(mutated).excludingEvery(['_edits']).to.deep.equal(reference);
    });

});