import { expect } from 'chai';
import MiKe from '../src/MiKe';
import { createMiKeDiagnosticsManager } from '../src/diagnostics/DiagnosticCodes';
import { DiagnosticsManager } from '../src/diagnostics/Diagnostics';
import { CreateParamsFunctions, EventData, MiKeProgram, MiKeProgramWithoutExternals, StateRecord } from '../src/codegen/js/types';
import JavascriptTarget, { createJavascriptTarget } from '../src/codegen/js/JavascriptTarget';
import { loadModule } from '@brillout/load-module';
import path from 'path';
import { LibraryInterface } from '../src/library/Library';
import { JsLibraryImplementation } from '../src/codegen/js/LibraryImpl';
import { noop } from 'lodash';
import { getNodePosition, Position } from '../src/ast/AstUtils';

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
                    return `expect(${lhs}, ${lhs}.join('\\n')).empty;`
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
        mike.loadScript(contents);

        const imports = [] as TestImport[];
        const assertions = [] as TestAssertion[];

        const comments = mike.getComments() ?? [];
        for (let i = 0; i < comments.length; i++) {
            const comment = comments[i];
            if (comment.content.includes('expect')) {
                const condition = comment.content.match(/v\s+expect\s+(.*)$/)?.[1].trim();
                
                if (condition) {
                    const cursorPosInString = comment.content.indexOf('v');
                    let commentIndex = i;
                    const commentPos = getNodePosition(comment);
                    let line = commentPos.line + 1;
                    const col = commentPos.col + cursorPosInString;
                    while (comments[++commentIndex]) {
                        const belowComment = comments[commentIndex];
                        const belowCommentPos = getNodePosition(belowComment);
                        if (belowCommentPos.line !== line) {
                            break;
                        }
                        // -2 for //
                        const commentIndexAtCol = col - belowCommentPos.col;
                        // + 1 to include the character at that column
                        if (!/^\/\/\s*$/.test(belowComment.content.slice(0, Math.max(0, commentIndexAtCol + 1)))) {
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
                    assertions.push({ position: getNodePosition(comment), condition, isTargeted: false });
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
    mike.loadScript(source);

    mike.setTarget(JavascriptTarget);
    for (const impl of options?.impls ?? []) {
        mike.addLibraryImplementation(impl);
    }

    const output = mike.tryValidateAndEmit();
    if (!output) {
        expect.fail(`Failed to compile:\n\t${diagnostics.getDiagnostics().map(x => x.toString()).join('\n\t')}`);
    }

    return new TextDecoder().decode(output);
}

export async function compileMiKeToJavascriptWithoutExternals<Exposed extends {} = {}>(source: string, options?: {
    libs?: LibraryInterface[];
    impls?: JsLibraryImplementation[];
    exposeNames?: (keyof Exposed extends string ? keyof Exposed : never)[];
}): Promise<MiKeProgramWithoutExternals<Exposed>> {
    const diagnostics = createMiKeDiagnosticsManager();
    const mike = new MiKe();
    mike.setDiagnosticsManager(diagnostics);
    for (const lib of options?.libs ?? []) {
        mike.addLibrary(lib);
    }
    mike.setEvents([
        { name: 'test', required: false, argumentTypes: [] }
    ]);
    mike.init();
    mike.loadScript(source);

    mike.setTarget(createJavascriptTarget(options?.exposeNames));
    for (const impl of options?.impls ?? []) {
        mike.addLibraryImplementation(impl);
    }

    const output = mike.tryValidateAndEmit();
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

export function getDebugFragments<Exposed extends {} = {}>(
    programFn: MiKeProgramWithoutExternals<Exposed>,
    createParamsFns?: Partial<CreateParamsFunctions>,
    state?: StateRecord,
): unknown[] & Exposed {
    const debugFragments = [] as unknown[];

    const program = programFn({ debug: debugFragments.push.bind(debugFragments) });
    program.listeners.find(x => x.event === 'test')!.callback({
        args: [],
        params: createParamsFns
            ? program.createParams(Object.assign({
                getIntParam(name) { throw new Error(`Expected value for parameter ${name}`) },
                getFloatParam(name) { throw new Error(`Expected value for parameter ${name}`) },
                getStringParam(name) { throw new Error(`Expected value for parameter ${name}`) },
                getBooleanParam(name) { throw new Error(`Expected value for parameter ${name}`) },
                getOptionParam(name) { throw new Error(`Expected value for parameter ${name}`) },
                getCustomParam(name) { throw new Error(`Expected value for parameter ${name}`) },
            } satisfies CreateParamsFunctions, createParamsFns))
            : {},
        state: state ?? program.createInitialState(),
    });
    
    return Object.assign(debugFragments, program.exposed);
}

export function createOptionFieldParamFunctions(fns: Partial<CreateParamsFunctions<[]>>) {
    return Object.assign({
        getIntParam() { throw new Error(`Expected value for option field parameter`) },
        getFloatParam() { throw new Error(`Expected value for option field parameter`) },
        getStringParam() { throw new Error(`Expected value for option field parameter`) },
        getBooleanParam() { throw new Error(`Expected value for option field parameter`) },
        getOptionParam() { throw new Error(`Expected value for option field parameter`) },
        getCustomParam() { throw new Error(`Expected value for option field parameter`) },
    } satisfies CreateParamsFunctions<[]>, fns);
}

export function getStateAfterRunning(program: MiKeProgram, evtData?: Partial<EventData>) {
    return program.listeners.find(x => x.event === 'test')!.callback(Object.assign({
        args: [],
        params: {},
        state: program.createInitialState(),
    } as EventData, evtData));
}
