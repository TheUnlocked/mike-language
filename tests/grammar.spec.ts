import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import MiKe from '../src/api/MiKe';
import { Position } from '../src/ast/Ast';
import { createTestFunction } from './util';

const sourceFilesDir = path.join(__dirname, './grammar');

const files = readdirSync(sourceFilesDir);

const data = files.map(filename => {
    const contents = readFileSync(path.join(sourceFilesDir, filename), { encoding: 'utf8' });
    return [filename, contents] as const;
});

describe('grammar', () => {
    for (const [filename, contents] of data) {
        describe(filename, () => {
            const mike = new MiKe();
            mike.init();
            mike.loadScript(filename, contents);
    
            const imports = [] as { importPath: string, members: string }[];
            const assertions = [] as { pos: Position, assertion: string }[];
    
            for (const comment of mike.getComments(filename) ?? []) {
                if (comment.content.includes('expect')) {
                    const assertion = comment.content.match(/v\s+expect\s+(.*)/)?.[1].trim();
                    if (assertion) {
                        const cursorPosInString = comment.content.indexOf('v');
                        const line = comment.metadata.extent.start.line + 1;
                        const col = comment.metadata.extent.start.col + 2 + cursorPosInString;
                        assertions.push({ pos: { line, col }, assertion });
                    }
                }
                else if (comment.content.includes('import')) {
                    const [valid, members, path] = comment.content.match(/import\s+(.*?)\s+from\s+('.*?'|".*?")/) ?? [];
                    if (valid) {
                        imports.push({ importPath: path.slice(1, -1), members });
                    }
                }
            }
    
            if (assertions.length === 0) {
                it('there are no tests in this file');
            }
            else {
                let importedContext: { [name: string]: any };
                before(async () => {
                    importedContext = Object.fromEntries((await Promise.all(imports.map(async ({ members, importPath }) => {
                        const contents = await import(path.join(sourceFilesDir, importPath));
                        if (/^{(.*)}$/.test(members)) {
                            return members
                                .slice(1, -1)
                                .split(',')
                                .map(x => {
                                    const [member, alias] = x.split(':');
                                    return [(alias ?? member).trim(), contents[member.trim()]];
                                });
                        }
                        return [[members, contents]];
                    }))).flat(1));
                });
    
                for (const { pos, assertion } of assertions) {
                    it(`line ${pos.line}, col ${pos.col + 1}: ${assertion.trim()}`, () => {
                        const node = mike.getNodeAt(filename, pos);
                        createTestFunction(assertion, { ...importedContext, $: node })()
                    });
                }
            }
        });
    }
});
