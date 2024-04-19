import { ASTNodeKind, AnyNode, InfixOperator, PrefixOperator } from "../ast";
import { expectNever } from "../utils";

interface FormattingContext {
    readonly identationLevel: number;
}

/**
 * An experimental function to convert an AST node into a string.
 * This will not necessarily provide correct results and is currently just used for debugging purposes.
 * @param node A node to format
 * @returns A string representing a textual representation of the node
 */
export function format(node: AnyNode) {
    return _format(node, {
        identationLevel: 0,
    });
}

function formatInfixOperator(operator: InfixOperator) {
    switch (operator) {
        case InfixOperator.Add: return '+';
        case InfixOperator.Subtract: return '-';
        case InfixOperator.Multiply: return '*';
        case InfixOperator.Divide: return '/';
        case InfixOperator.Equals: return '==';
        case InfixOperator.NotEquals: return '!=';
        case InfixOperator.LessThan: return '<';
        case InfixOperator.LessThanEqual: return '<=';
        case InfixOperator.GreaterThan: return '>';
        case InfixOperator.GreaterThanEqual: return '>=';
        case InfixOperator.And: return '&&';
        case InfixOperator.Or: return '||';
    }
}

function seq(...strs: readonly string[]) {
    return strs.filter(Boolean).join('');
}

function formatPrefixOperator(operator: PrefixOperator) {
    switch (operator) {
        case PrefixOperator.Minus: return '-';
        case PrefixOperator.Not: return '!';
    }
}

function _format(node: AnyNode, context: FormattingContext): string {
    function format(node: AnyNode, contextMod?: Partial<FormattingContext>) {
        return _format(node, contextMod ? { ...context, ...contextMod } : context);
    }

    function formatMany(nodes: readonly AnyNode[], sep: string = '', contextMod?: Partial<FormattingContext>) {
        return nodes.map(x => format(x, contextMod)).join(sep);
    }

    function formatManyIndented(nodes: readonly AnyNode[]) {
        return formatMany(nodes, '', { identationLevel: context.identationLevel + 1 });
    }

    function line(content: string, indentOnly = false) {
        const indent = new Array(context.identationLevel * 4).fill(' ').join('');
        if (indentOnly) {
            return indent + content;
        }
        return indent + content + '\n';
    }

    switch (node.kind) {
        default: expectNever(node);
        
        // Expressions
        case ASTNodeKind.Invoke:
            return seq(format(node.fn), '(', formatMany(node.args, ', '), ')');
        case ASTNodeKind.BinaryOp:
            return seq('(', format(node.lhs), ' ', formatInfixOperator(node.op), ' ', format(node.rhs), ')');
        case ASTNodeKind.UnaryOp:
            return seq(formatPrefixOperator(node.op), format(node.expr));
        case ASTNodeKind.Dereference:
            return seq(format(node.obj), '.', format(node.member));
        case ASTNodeKind.Variable:
            return format(node.identifier);
        case ASTNodeKind.FloatLiteral:
            return node.value.toString();
        case ASTNodeKind.IntLiteral:
            return node.value;
        case ASTNodeKind.BoolLiteral:
            return node.value ? 'true' : 'false';
        case ASTNodeKind.StringLiteral:
            return JSON.stringify(node.value);
        case ASTNodeKind.SequenceLiteral:
            return seq(node.type ? format(node.type) : '', '[', formatMany(node.elements, ', '), ']');
        case ASTNodeKind.MapLiteral:
            return seq(node.type ? format(node.type) : '', '{', formatMany(node.pairs, ', '), '}');
        
            // Statements
        case ASTNodeKind.ExpressionStatement:
            return line(seq(format(node.expr), ';'));
        case ASTNodeKind.LetStatement:
            return line(seq(
                'let ', format(node.name),
                ...node.type ? [': ', format(node.type)] : [],
                ...node.value ? [' = ', format(node.value)] : [],
                ';'
            ));
        case ASTNodeKind.AssignVar:
            return line(seq(format(node.variable), ' = ', format(node.value), ';'));
        case ASTNodeKind.AssignField:
            return line(seq(format(node.obj), '.', format(node.member), ' = ', format(node.value), ';'));
        case ASTNodeKind.IfElseChain:
            return seq(
                ...node.cases.map((x, i) => line(seq(
                    i > 0 ? 'else ' : '',
                    format(x),
                ), true)),
                ...node.else ? [
                    line('else {'),
                    formatManyIndented(node.else.statements),
                    line('}'),
                ] : [],
            );
        case ASTNodeKind.DebugStatement:
            return line(seq('debug ', formatMany(node.arguments, ', '), ';'));
        case ASTNodeKind.Block:
            return seq(
                line('{'),
                formatMany(node.statements, '', { identationLevel: context.identationLevel + 1 }),
                line('}'),
            );
        
        // Top-level
        case ASTNodeKind.ParameterDefinition:
            return line(seq('param ', format(node.name), ': ', format(node.type)));
        case ASTNodeKind.StateDefinition:
            return line(seq(
                'state ', format(node.name),
                ...node.type ? [': ', format(node.type)] : [],
                ...node.default ? [' = ', format(node.default)] : [],
                ';'
            ));
        case ASTNodeKind.ListenerDefinition:
            return seq(
                line(seq('on ', node.event, '(', formatMany(node.parameters, ', '), ') {')),
                formatManyIndented(node.body.statements),
                line('}'),
            );
        case ASTNodeKind.TypeDefinition:
            return line(seq('type ', format(node.name), ' (', formatMany(node.parameters, ', '), ');'));
        case ASTNodeKind.Program:
            return formatManyIndented(node.definitions);
        
        // Fragments
        case ASTNodeKind.Identifier:
            return node.name;
        case ASTNodeKind.Parameter:
            return seq(format(node.name), ': ', format(node.type));
        case ASTNodeKind.IfCase:
            return seq(
                // IfElseChain handles the indentation
                'if ', format(node.condition),
                ...node.deconstruct ? [' |', format(node.deconstruct), '|'] : [],
                ' {\n',
                formatManyIndented(node.body.statements),
                line('}')
            );
        case ASTNodeKind.Pair:
            return seq(format(node.key), ': ', format(node.value));
        
        // Types
        case ASTNodeKind.TypeIdentifier:
            return node.name;
        case ASTNodeKind.GenericType:
            return seq(format(node.name), '<', formatMany(node.typeArguments, ', '), '>');
        case ASTNodeKind.FunctionType:
            return seq('(', formatMany(node.parameters, ', '), ') => ', format(node.returnType));
        // Misc

        case ASTNodeKind.Comment:
            return line(node.content);
    }
}