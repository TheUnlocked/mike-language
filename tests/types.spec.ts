import { expect } from 'chai';
import { AnyNode, ASTNodeKind, isExpression } from '../src/ast/Ast';
import { Parser } from '../src/parser/parser';
import scaffoldTests from './scaffolding';

scaffoldTests('types', ({ mike, diagnosticsManager }) => {
    mike.setEvents([
        { name: 'test', required: false, argumentTypes: [parseType('(Queue<boolean>) => unit')] }
    ]);
    mike.validate();

    function fetchType(node: AnyNode) {
        if (isExpression(node)) {
            return mike.typechecker.fetchType(node);
        }
        if (node.kind === ASTNodeKind.Identifier) {
            return mike.typechecker.fetchTypeFromIdentifier(node);
        }
    }
    
    function parseType(str: string) {
        const parser = new Parser();
        parser.setDiagnostics(diagnosticsManager.getReporter('mike'));
        parser.loadSource(str);
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