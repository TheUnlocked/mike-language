import { expect } from 'chai';
import { MiKeSemanticError } from '../../exception/Exception';
import { parseExpression } from '../../grammar/Expressions';
import Scope from '../../semantics/Scope';
import { resolveExpressionTypesWithMetadata } from '../../semantics/Typechecking.gen';
import { builtinTypesMap } from '../../types/BuiltinTypes.gen';
import { MetadataManager } from '../MetadataManager';


describe('metadata', () => {
    const types = builtinTypesMap;
    const root = new Scope();

    it('should indicate the errored token in `1 * (1 - (true * 4)) / 3` is `true`', () => {
        const metadata = new MetadataManager();
        const untyped = parseExpression('1 * (1 - (true * 4)) / 3', { metadata });
        const reporter = metadata.makeReporter();
    
        try {
            resolveExpressionTypesWithMetadata(reporter, types, root, untyped);
            expect.fail();
        }
        catch (e) {
            if (e instanceof MiKeSemanticError) {
                expect(metadata.getMetadata(e.expression)?.text).to.equal('true');
            }
            else {
                expect.fail();
            }
        }
    });
});