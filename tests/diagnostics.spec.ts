import { AnyNode, ASTNodeKind, isExpression } from '../src/ast/Ast';
import { Parser } from '../src/parser/parser';
import { intType } from '../src/types/Primitives';
import scaffoldTests from './scaffolding';

scaffoldTests('diagnostics', ({ mike, filename, diagnosticsManager }) => {
    mike.setEvents([
        { name: 'test', required: true, argumentTypes: [intType] }
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
        const parser = new Parser();
        parser.setDiagnostics(diagnosticsManager.getReporter('mike'));
        parser.loadSource(str);
        const ast = parser.type()!;
        return mike.typechecker.fetchTypeOfTypeNode(ast);
    }

    return node => ({
        $t: node ? fetchType(node) : undefined,
        fetchType,
        type: parseType,
    });
});