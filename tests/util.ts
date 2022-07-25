import { expect } from 'chai';
import MiKe from '../src/api/MiKe';
import { Position, Program } from '../src/ast/Ast';
import { createMiKeDiagnosticsManager } from '../src/diagnostics/DiagnosticCodes';
import { DiagnosticsManager } from '../src/diagnostics/Diagnostics';
import path from 'path';

export function createTestFunction(assertion: string, variables: { [name: string]: any }) {
    const testContext = { ...variables, expect } as { [name: string]: any };
    const args = Object.keys(testContext);
    return () => new Function(...args, assertionToJs(assertion))(...args.map(x => testContext[x]));
}

const COMMA_REGEX = /,(?=(?:(?:[^']*'){2})*[^']*$)/;

function assertionToJs(assertion: string): string {
    if (COMMA_REGEX.test(assertion)) {
        return assertion.split(COMMA_REGEX).map(assertionToJs).join('');
    }
    if (assertion.includes('~')) {
        const [lhs, operator, ...rest] = assertion.split('~').map(x => x.trim());

        switch (operator) {
            case 'none':
                if (rest.length === 0) {
                    return `expect(${lhs}).empty;`
                }
            case 'has':
                if (rest.length > 0) {
                    return `expect(${lhs}.some(___$ => {
                        eval(\`var {\${Object.keys(___$)}} = ___$;\`);
                        try {
                            ${assertionToJs(rest.join('~'))}
                        }
                        catch (e) {
                            return false;
                        }
                        return true;
                    })).true;`;
                }
        }
    }
    if (assertion.includes('==')) {
        const [lhs, rhs] = assertion.split('==').map(x => x.trim());
        return `expect(${lhs}).deep.equal(${rhs});`;
    }
    return `expect.fail('Invalid assertion: ' + ${JSON.stringify(assertion)});`;
}

export interface TestAssertion {
    condition: string;
    position: Position;
}

export interface TestImport {
    path: string;
    members: string;
}

export interface TestData {
    mike: MiKe;
    filename: string;
    diagnosticsManager: DiagnosticsManager;
    isEmpty: boolean;
    assertions: TestAssertion[];
    imports: TestImport[];
}

export interface AssertionContext {
    [name: string]: any;
}

export function getTestData(filename: string, contents: string): TestData {
    const diagnosticsManager = createMiKeDiagnosticsManager();
    const mike = new MiKe();
    mike.setDiagnosticsManager(diagnosticsManager);
    mike.init();
    
    try {
        mike.loadScript(filename, contents);

        const imports = [] as TestImport[];
        const assertions = [] as TestAssertion[];

        const comments = mike.getComments(filename) ?? [];
        for (let i = 0; i < comments.length; i++) {
            const comment = comments[i];
            if (comment.content.includes('expect')) {
                const condition = comment.content.match(/v\s+expect\s+(.*)/)?.[1].trim();
                
                if (condition) {
                    const cursorPosInString = comment.content.indexOf('v');
                    let commentIndex = i;
                    let line = comment.metadata.extent.start.line + 1;
                    const col = comment.metadata.extent.start.col + 2 + cursorPosInString;
                    while (comments[++commentIndex]) {
                        const belowComment = comments[commentIndex];
                        if (belowComment.metadata.extent.start.line !== line) {
                            break;
                        }
                        // -2 for //
                        const commentIndexAtCol = col - 2 - belowComment.metadata.extent.start.col;
                        // + 1 to include the character at that column
                        if (!/^\s*$/.test(belowComment.content.slice(0, Math.max(0, commentIndexAtCol + 1)))) {
                            break;
                        }
                        line++;
                    }
                    assertions.push({ position: { line, col }, condition });
                }
            }
            else if (comment.content.includes('assert')) {
                const condition = comment.content.match(/assert\s+(.*)/)?.[1].trim();
                if (condition) {
                    assertions.push({ position: comment.metadata.extent.start, condition });
                }
            }
            else if (comment.content.includes('import')) {
                const [valid, members, path] = comment.content.match(/import\s+(.*?)\s+from\s+('.*?'|".*?")/) ?? [];
                if (valid) {
                    imports.push({ path: path.slice(1, -1), members });
                }
            }
        }

        return {
            mike,
            filename,
            diagnosticsManager,
            isEmpty: assertions.length === 0,
            assertions,
            imports,
        };
    }
    catch (e) {
        if (diagnosticsManager.getDiagnostics().length === 0) {
            throw e instanceof Error ? e : new Error(`${e}`);
        }
    }

    return {
        mike,
        filename,
        diagnosticsManager,
        isEmpty: false,
        assertions: [],
        imports: [],
    };
}

export async function createContextFromImports(imports: TestImport[], relativeTo: string): Promise<AssertionContext> {
    return Object.fromEntries((await Promise.all(imports.map(async ({ members, path: importPath }) => {
        const contents = await import(path.join(relativeTo, importPath));
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
}