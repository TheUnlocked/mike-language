import { intType } from '../src/types/Primitives';
import incrementalSpec from './grammar/incremental.spec';
import lexerSpec from './grammar/lexer.spec';
import scaffoldTests from './scaffolding';

describe('grammar', () => {
    lexerSpec();
    incrementalSpec();

    scaffoldTests('grammar_generated', () => {
        return () => ({});
    });

    scaffoldTests('grammar_validateInvalid', ({ mike }) => {
        mike.setEvents([
            { name: 'test', required: true, argumentTypes: [intType] }
        ]);
        mike.validate();
        
        return () => ({});
    });

});

