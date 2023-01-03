import { expect } from 'chai';
import { AnyNode, ASTNodeKind, isExpression } from '../src/ast/Ast';
import { StringLexer } from '../src/parser/lexer';
import { Parser } from '../src/parser/parser';
import scaffoldTests from './scaffolding';

scaffoldTests('types', ({ mike, filename, diagnosticsManager }) => {
    mike.setEvents([
        { name: 'test', required: false, argumentTypes: [parseType('(Queue<boolean>) => unit')] }
    ]);
    mike.validate(filename);

    function fetchType(node: AnyNode) {
        if (isExpression(node)) {
            return mike.typechecker.fetchType(node);
        }
        if (node.kind === ASTNodeKind.Identifier) {
            return mike.typechecker.fetchTypeFromIdentifier(node);
        }
    }
    
    function parseType(str: string) {
        const lexer = new StringLexer(str);
        lexer.setDiagnostics(diagnosticsManager.getReporter('mike'));
        const parser = new Parser(lexer.readAllTokens());
        parser.setDiagnostics(diagnosticsManager.getReporter('mike'));
        const ast = parser.type();
        expect(ast).to.exist;
        return mike.typechecker.fetchTypeOfTypeNode(ast!);
    }

    return node => ({
        $t: node ? fetchType(node) : undefined,
        fetchType,
        type: parseType,
    });
});