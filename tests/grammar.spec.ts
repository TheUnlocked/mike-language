import lexerSpec from './grammar/lexer.spec';
import scaffoldTests from './scaffolding';

describe('grammar', () => {
    lexerSpec();

    scaffoldTests('grammar_generated', () => {
        return () => ({});
    });
});

