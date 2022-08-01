import { expect } from 'chai';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { AnyNode } from '../src/ast/Ast';
import { inRange, isAfter } from '../src/ast/AstUtils';
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
            describe(filenameWithoutExt, () => {
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
            
                        for (const { position, condition, isTargeted } of assertions) {
                            it(`${filenameWithoutExt}:${position.line}:${position.col + 1} -- ${condition.trim()}`, () => {
                                if (isTargeted) {
                                    const node = mike.getNodeAt(filename, position);
                                    createTestFunction(condition, {
                                        ...context,
                                        ...createAdditionalContext(node),
                                        $: node,
                                        diagnostics: diagnosticsManager.getDiagnostics()
                                            .filter(x => x.range ? inRange(x.range, position) : false),
                                    })();
                                }
                                else {
                                    createTestFunction(condition, {
                                        ...context,
                                        diagnostics: diagnosticsManager.getDiagnostics()
                                            .filter(x => x.range ? isAfter(position, x.range.end) : true),
                                    })();
                                }
                            });
                        }
                    }
                }
                catch (e) {
                    const err = e as Error;
                    it(`${err.name}: ${err.message}`, () => {
                        getCreateAdditionalContext(getTestData(filename, contents));
                    });
                }
            });
        }
    });
}