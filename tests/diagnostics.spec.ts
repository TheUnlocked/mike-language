import { AnyNode, ASTNodeKind, isExpression } from '../src/ast/Ast';
import { getLexer, getParser } from '../src/grammar/Parser';
import { TypeAstGenVisitor } from '../src/grammar/Types';
import scaffoldTests from './scaffolding';

scaffoldTests('diagnostics', ({ mike, filename, diagnosticsManager }) => {
    mike.validate(filename);

    function fetchType(node: AnyNode) {
        if (isExpression(node)) {
            return mike.typechecker.fetchType(node);
        }
        if (node.kind === ASTNodeKind.Identifier) {
            return mike.typechecker.fetchSymbolType(node);
        }
    }
    
    function parseType(str: string) {
        const lexer = getLexer(str, diagnosticsManager.getReporter('test'))
        const parser = getParser(lexer, diagnosticsManager.getReporter('test'));
        const ast = parser.type().accept(new TypeAstGenVisitor());
        return mike.typechecker.fetchTypeOfTypeNode(ast);
    }

    return node => ({
        $t: node ? fetchType(node) : undefined,
        fetchType,
        type: parseType,
    });
});