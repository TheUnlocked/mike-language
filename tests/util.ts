import { expect } from 'chai';
import MiKe from '../src/MiKe';
import { Position } from '../src/ast/Ast';
import { createMiKeDiagnosticsManager } from '../src/diagnostics/DiagnosticCodes';
import { DiagnosticsManager } from '../src/diagnostics/Diagnostics';
import { MiKeProgram, MiKeProgramWithoutExternals } from '../src/codegen/js/types';
import JavascriptTarget from '../src/codegen/js/JavascriptTarget';
import { loadModule } from '@brillout/load-module';
import path from 'path';
import { LibraryInterface } from '../src/library/Library';
import { JsLibraryImplementation } from '../src/codegen/js/LibraryImpl';
import { noop } from 'lodash';

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
                            return true;
                        }
                        catch (e) {
                            return false;
                        }
                    }), \`\${JSON.stringify(${lhs})} does not include an element which has ${rest.join('~')}\`).true;`;
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
    isTargeted: boolean;
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
                const condition = comment.content.match(/v\s+expect\s+(.*)$/)?.[1].trim();
                
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
                    assertions.push({ position: { line, col }, condition, isTargeted: true });
                }
            }
            else if (comment.content.includes('assert')) {
                const condition = comment.content.match(/assert\s+(.*)$/)?.[1].trim();
                if (condition) {
                    assertions.push({ position: comment.metadata.extent.start, condition, isTargeted: false });
                }
            }
            else if (comment.content.includes('import')) {
                const [valid, members, path] = comment.content.match(/import\s+(.*?)\s+from\s+('.*?'|".*?")$/) ?? [];
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

export async function compileMiKeToJavascriptText(source: string, options?: {
    libs?: LibraryInterface[];
    impls?: JsLibraryImplementation[];
}): Promise<string> {
    const diagnostics = createMiKeDiagnosticsManager();
    const mike = new MiKe();
    mike.setDiagnosticsManager(diagnostics);
    for (const lib of options?.libs ?? []) {
        mike.addLibrary(lib);
    }
    mike.init();
    mike.loadScript('.', source);

    mike.setTarget(JavascriptTarget);
    for (const impl of options?.impls ?? []) {
        mike.addLibraryImplementation(impl);
    }

    const output = mike.tryValidateAndEmit('.');
    if (!output) {
        expect.fail(`Failed to compile:\n\t${diagnostics.getDiagnostics().map(x => x.toString()).join('\n\t')}`);
    }

    return new TextDecoder().decode(output);
}

export async function compileMiKeToJavascriptWithoutExternals(source: string, options?: {
    libs?: LibraryInterface[];
    impls?: JsLibraryImplementation[];
}): Promise<MiKeProgramWithoutExternals> {
    const diagnostics = createMiKeDiagnosticsManager();
    const mike = new MiKe();
    mike.setDiagnosticsManager(diagnostics);
    for (const lib of options?.libs ?? []) {
        mike.addLibrary(lib);
    }
    mike.init();
    mike.loadScript('.', source);

    mike.setTarget(JavascriptTarget);
    for (const impl of options?.impls ?? []) {
        mike.addLibraryImplementation(impl);
    }

    const output = mike.tryValidateAndEmit('.');
    if (!output) {
        expect.fail(`Failed to compile:\n\t${diagnostics.getDiagnostics().map(x => x.toString()).join('\n\t')}`);
    }

    const importString = `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`;
    const module = await loadModule(importString);
    return module.default;
}

export async function compileMiKeToJavascript(source: string, options?: {
    libs?: LibraryInterface[];
    impls?: JsLibraryImplementation[];
    debug?: (...args: any[]) => void;
    externals?: { [extName: string]: any };
}): Promise<MiKeProgram> {
    return (await compileMiKeToJavascriptWithoutExternals(source, options))({
        debug: options?.debug ?? noop,
        ...options?.externals,
    });
}

