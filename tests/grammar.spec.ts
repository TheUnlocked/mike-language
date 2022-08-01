import { expect } from 'chai';
import scaffoldTests from './scaffolding';

scaffoldTests('grammar', ({ diagnosticsManager, filename }) => {
    for (const diagnostic of diagnosticsManager.getDiagnostics()) {
        let locationStr = '';
        if (diagnostic.range) {
            const { line, col } = diagnostic.range.start;
            locationStr = `${filename.replace(/\..*$/, '')}:${line}:${col + 1} -- `;
        }
        it(`${locationStr}${diagnostic.id}: ${diagnostic.getDescription().replace(/\.$/, '')}`, () => {
            expect.fail(diagnostic.getDescription());
        });
    }

    return () => ({});
});