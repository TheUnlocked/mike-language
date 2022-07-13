import omitDeep from 'omit-deep-lodash';
import { getParser } from '../Parser';
import { AnyNode, Expression, Program, Statement } from '../../ast/Ast';
import { Diagnostics, Severity } from '../../diagnostics/Diagnostics';
import { ExprAstGenVisitor } from '../Expressions';
import { MiKeParser } from '../generated/MiKeParser';
import { StatementAstGenVisitor } from '../Statements';
import { ProgramAstGenVisitor } from '../Program';

export function parseExpression(expr: string, diagnostics = new Diagnostics(), includeMetadata = false): Expression<undefined> {
    const parser = getParser(expr, diagnostics.getReporter('mike'));
    const visitor = new ExprAstGenVisitor();
    visitor.setDiagnostics(diagnostics);
    const ast = parser.expression().accept(visitor);

    if (parser.currentToken.type !== MiKeParser.EOF) {
        throw new Error('Unexpected trailing input');
    }

    if (diagnostics.getDiagnostics().filter(x => x.severity === Severity.Error).length > 0) {
        throw new Error(JSON.stringify(diagnostics.getDiagnostics(), null, 4));
    }

    if (!includeMetadata) {
        return omitDeep(ast, ['metadata']) as Expression<undefined>;
    }

    return ast;
}

export function parseStatement(expr: string, diagnostics = new Diagnostics(), includeMetadata = false): Statement<undefined> {
    const parser = getParser(expr, diagnostics.getReporter('mike'));
    const exprVisitor = new ExprAstGenVisitor();
    exprVisitor.setDiagnostics(diagnostics);
    const statementVisitor = new StatementAstGenVisitor(exprVisitor);
    statementVisitor.setDiagnostics(diagnostics);
    const ast = parser.statement().accept(statementVisitor);

    if (parser.currentToken.type !== MiKeParser.EOF) {
        throw new Error('Unexpected trailing input');
    }

    if (diagnostics.getDiagnostics().filter(x => x.severity === Severity.Error).length > 0) {
        throw new Error(JSON.stringify(diagnostics.getDiagnostics(), null, 4));
    }

    if (!includeMetadata) {
        return omitDeep(ast, ['metadata']) as Statement<undefined>;
    }

    return ast;
}

export function parseProgram(expr: string, diagnostics = new Diagnostics(), includeMetadata = false): Program<undefined> {
    const parser = getParser(expr, diagnostics.getReporter('mike'));
    const exprVisitor = new ExprAstGenVisitor();
    exprVisitor.setDiagnostics(diagnostics);
    const statementVisitor = new StatementAstGenVisitor(exprVisitor);
    statementVisitor.setDiagnostics(diagnostics);
    const programVisitor = new ProgramAstGenVisitor(exprVisitor, statementVisitor);
    programVisitor.setDiagnostics(diagnostics);
    const ast = parser.program().accept(programVisitor);

    if (parser.currentToken.type !== MiKeParser.EOF) {
        throw new Error('Unexpected trailing input');
    }

    if (diagnostics.getDiagnostics().filter(x => x.severity === Severity.Error).length > 0) {
        throw new Error(JSON.stringify(diagnostics.getDiagnostics(), null, 4));
    }

    if (!includeMetadata) {
        return omitDeep(ast, ['metadata']) as Program<undefined>;
    }

    return ast as Program<undefined>;
}
