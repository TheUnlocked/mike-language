import { expect } from 'chai';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { AnyNode } from '../src/ast/Ast';
import { AssertionContext, createContextFromImports, createTestFunction, getTestData, TestData } from './util';

export default function scaffoldTests(
    suiteName: string,
    getCreateAdditionalContext: (testData: TestData) => (node: AnyNode | undefined) => AssertionContext
) {
    const sourceFilesDir = path.join(__dirname, suiteName);

    const files = readdirSync(sourceFilesDir);

    const data = files.map(filename => {
        const contents = readFileSync(path.join(sourceFilesDir, filename), { encoding: 'utf8' });
        return [filename, contents] as const;
    });

    describe(suiteName, () => {
        for (const [filename, contents] of data) {
            const filenameWithoutExt = filename.replace(/\..*$/, '');
            describe(filenameWithoutExt.replace(/\..*$/, ''), () => {
                try {
                    const testData = getTestData(filename, contents);
                    const {
                        mike,
                        diagnosticsManager,
                        assertions,
                        imports,
                        isEmpty
                    } = testData;

                    const createAdditionalContext = getCreateAdditionalContext(testData);
                    
                    if (isEmpty) {
                        it('there are no tests in this file');
                        return;
                    }
                    else {
                        let context: AssertionContext;
                        before(async () => {
                            context = {
                                ...await createContextFromImports(imports, sourceFilesDir),
                                parent: (node: AnyNode) => mike.binder.getParent(node),
                            }
                        });
            
                        for (const { position, condition } of assertions) {
                            it(`${filenameWithoutExt}:${position.line}:${position.col + 1} -- ${condition.trim()}`, () => {
                                const node = mike.getNodeAt(filename, position);
                                createTestFunction(condition, {
                                    ...context,
                                    ...createAdditionalContext(node),
                                    $: node,
                                    diagnostics: diagnosticsManager.getDiagnostics(),
                                })();
                            });
                        }
                    }
        
                    for (const diagnostic of diagnosticsManager.getDiagnostics()) {
                        let locationStr = '';
                        if (diagnostic.range) {
                            const { line, col } = diagnostic.range.start;
                            locationStr = `${filenameWithoutExt}:${line}:${col + 1} -- `;
                        }
                        it(`${locationStr}${diagnostic.id}: ${diagnostic.getDescription().replace(/\.$/, '')}`, () => {
                            expect.fail(diagnostic.getDescription());
                        });
                    }
                }
                catch (e) {
                    const err = e as Error;
                    it(`${err.name}: ${err.message}`, () => {
                        expect.fail(err.toString());
                    });
                }
            });
        }
    });
}