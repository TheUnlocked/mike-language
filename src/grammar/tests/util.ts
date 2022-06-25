import { cloneDeepWith } from 'lodash';
import omitDeep from 'omit-deep-lodash';
import { Expression } from '../../ast/Ast';
import { Diagnostics } from '../../diagnostics/Diagnostics';
import { ExprAstGenVisitor, getParser } from '../Expressions';
import { ExpressionContext, MiKeParser } from '../generated/MiKeParser';

export function parseExpression(expr: string | ExpressionContext, includeMetadata = false): Expression<undefined> {
    if (typeof expr === 'string') {
        const diagnostics = new Diagnostics();
        const parser = getParser(expr, diagnostics.getReporter('mike'));
        const tree = parser.expression();
        const ast = tree.accept(new ExprAstGenVisitor());

        if (parser.currentToken.type !== MiKeParser.EOF) {
            throw new Error('Unexpected trailing input');
        }

        if (diagnostics.getDiagnostics().length > 0) {
            throw new Error(JSON.stringify(diagnostics.getDiagnostics(), null, 4));
        }

        if (!includeMetadata) {
            return omitDeep(ast, ['metadata']) as Expression<undefined>;
        }

        return ast;
    }
    else {
        return expr.accept(new ExprAstGenVisitor());
    }
}