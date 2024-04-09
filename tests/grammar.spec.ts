import incrementalSpec from './grammar/incremental.spec';
import lexerSpec from './grammar/lexer.spec';
import scaffoldTests from './scaffolding';

describe('grammar', () => {
    lexerSpec();
    incrementalSpec();

    scaffoldTests('grammar_generated', () => {
        return () => ({});
    });

});

