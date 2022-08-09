import { boundMethod } from 'autobind-decorator';
import { groupBy, identity, isEqual } from 'lodash';
import { check as isReserved } from 'reserved-words';
import { AnyNode, ASTNodeKind, BinaryOp, Block, Expression, Identifier, IfElseChain, InfixOperator, ListenerDefinition, MapLiteral, ParameterDefinition, PrefixOperator, Program, SequenceLiteral, StateDefinition, Statement, StatementOrBlock, TypeDefinition, TypeIdentifier, UnaryOp } from '../../ast/Ast';
import { ParameterType } from './types';
import { Typechecker } from '../../semantics/Typechecker';
import { KnownType, stringifyType, TypeKind } from '../../types/KnownType';
import { intType } from '../../types/Primitives';
import { expectNever, staticContract } from '../../utils/types';
import { Target, TargetFactory } from '../Target';
import { LibraryImplementation } from '../../library/Library';
import jsStdlibImpl from './stdlib';

@staticContract<TargetFactory>()
export default class JavascriptTarget implements Target {

    private builtins = new Map<string, string>();

    private identifierMappings = new Map<string, string>();
    private usedNames = new Set<string>();

    static get defaultImplementations() {
        return [jsStdlibImpl];
    }

    static create(typechecker: Typechecker, impl: LibraryImplementation) {
        return new JavascriptTarget(typechecker, impl);
    }

    constructor(private readonly typechecker: Typechecker, private readonly impl: LibraryImplementation) {

    }

    generate(program: Program): ArrayBuffer {
        return new TextEncoder().encode(this.visitProgram(program));
    }

    private getSafeName(name: string) {
        let safeName = this.identifierMappings.get(name);
        if (!safeName) {
            safeName = name;
            while (this.usedNames.has(safeName) || isReserved(safeName, 'next', true)) {
                safeName = `_${safeName}`;
            }
            this.identifierMappings.set(name, safeName);
            this.usedNames.add(safeName);
        }
        return safeName;
    }

    private defineBuiltin(name: string, lazyCode: () => string): string {
        name = this.getSafeName(`$${name}`);
        if (!this.builtins.has(name)) {
            this.builtins.set(name, lazyCode());
        }
        return name;
    }

    private visitProgram(program: Program): string {
        const defsByKind = groupByKind(program.definitions);
        const params = defsByKind[ASTNodeKind.ParameterDefinition] ?? [];
        const state = defsByKind[ASTNodeKind.StateDefinition] ?? [];
        const typeDefs = defsByKind[ASTNodeKind.TypeDefinition] ?? [];
        const listeners = defsByKind[ASTNodeKind.ListenerDefinition] ?? [];

        const userCode = `${
            joinBy('', typeDefs, this.visitTypeDefinition)
        }export default{${seq(',',
            `params:[${joinBy(',', params, this.visitParameterDefinition)}]`,
            `state:[${joinBy(',', state, this.visitStateDefinition)}]`,
            `listeners:[${joinBy(',', listeners, def => this.visitListenerDefinition(def, params, state))}]`,
        )}};`;

        return joinBy('', this.builtins, ([name, code]) => `const ${name}=${code};`) + userCode;
    }

    @boundMethod
    private visitParameterDefinition(ast: ParameterDefinition) {
        return `{${seq(',',
            `name:${this.getPublicIdentifierString(ast.name)}`,
            `type:${JSON.stringify(this.toParameterType(this.typechecker.fetchVariableDefinitionType(ast)))}`,
        )}}`;
    }

    @boundMethod
    private visitStateDefinition(ast: StateDefinition) {
        return `{name:${this.getPublicIdentifierString(ast.name)},default:${this.visitExpression(ast.default!)}}`;
    }

    private toParameterType(type: KnownType): ParameterType {
        if (type.kind !== TypeKind.Simple) {
            throw new Error(`Codegen found invalid parameter type: ${stringifyType(type)}`);
        }
        switch (type.name) {
            case 'int':
            case 'float':
            case 'string':
            case 'boolean':
                return type.name;
            case 'option':
                return { variant: 'option', type: this.toParameterType(type.typeArguments[0]) };
        }
        if (type.typeArguments.length > 0) {
            throw new Error(`Generic custom parameter types are not supported.`);
        }
        return { variant: 'custom', name: type.name };
    }

    @boundMethod
    private visitTypeDefinition(ast: TypeDefinition) {
        return `const ${this.visitTypeIdentifier(ast.name)}=(${
            joinBy(',', ast.parameters, x => this.visitIdentifier(x.name))
        })=>({${
            joinBy(',', ast.parameters, x => this.getPublicPrivateObjectBinding(x.name))
        }});`;
    }

    @boundMethod
    private visitListenerDefinition(ast: ListenerDefinition, params: ParameterDefinition[], state: StateDefinition[]) {
        const paramNames = new Set(params.map(x => x.name));
        const stateNames = new Set(state.map(x => x.name));

        const argNames = ast.parameters.map(x => x.name);
        for (const arg of argNames) {
            paramNames.delete(arg);
            stateNames.delete(arg);
        }

        const stateObject = `{${joinBy(',', stateNames, this.getPublicPrivateObjectBinding)}}`;

        return `{${seq(',',
            `event:${JSON.stringify(ast.event)}`,
            `callback:({${seq(',',
                `params:{${joinBy(',', paramNames, this.getPublicPrivateObjectBinding)}}`,
                `state:${stateObject}`,
                `args:[${join(',', argNames)}]`,
            )}})=>{${this.visitBlock(ast.body, false)}return${stateObject};}`,
        )}}`;
    }

    @boundMethod
    private getPublicPrivateObjectBinding(id: Identifier) {
        return `${this.getPublicIdentifierString(id)}:${this.visitIdentifier(id)}`;
    }

    @boundMethod
    private visitBlock(ast: Block, includeBraces = true): string {
        const contents = joinBy('', ast.statements, this.visitStatementOrBlock);
        return includeBraces ? `{${contents}}` : contents;
    }

    @boundMethod
    private visitStatementOrBlock(ast: StatementOrBlock): string {
        switch (ast.kind) {
            default: expectNever(ast);
            case ASTNodeKind.Block:
                return this.visitBlock(ast);
            case ASTNodeKind.ExpressionStatement:
                return `${this.visitExpression(ast.expr)};`;
            case ASTNodeKind.DebugStatement:
                return `console.log(${joinBy(',', ast.arguments, this.visitExpression)});`;
            case ASTNodeKind.LetStatement:
                if (ast.value) {
                    return `let ${this.visitIdentifier(ast.name)}=${this.visitExpression(ast.value)};`;
                }
                return `let ${this.visitIdentifier(ast.name)};`;
            case ASTNodeKind.AssignVar:
                return `${this.visitIdentifier(ast.variable)}=${this.visitExpression(ast.value)};`;
            case ASTNodeKind.AssignField:
                return `${this.dereference(ast.obj, ast.member)}=${this.visitExpression(ast.value)};`;
            case ASTNodeKind.IfElseChain:
                return this.visitIfElseChain(ast);
        }
    }

    private visitIfElseChain(ast: IfElseChain) {
        return joinBy(',', ast.cases, ($case, idx) => {
            const keyword = idx === 0 ? 'if' : 'else if';
            const conditionType = this.typechecker.fetchType($case.condition);
            if (conditionType.kind !== TypeKind.Simple) {
                throw new Error(`Invalid condition type: ${stringifyType(conditionType)}`);
            }

            const conditionMethods = conditionType.name === 'boolean'
                ? { condition: identity, destructure: identity }
                : this.impl.types[conditionType.name]?.conditionMethods;
            if (!conditionMethods) {
                throw new Error(`Condition not implemented for ${stringifyType(conditionType)}`);
            }
            const { condition: processCondition, destructure } = conditionMethods;

            const rawCondition = this.visitExpression($case.condition);
            const condition = processCondition(rawCondition);

            let destructureDef = '';
            if ($case.deconstruct) {
                if (!destructure) {
                    throw new Error(`If destructuring not properly implemented for ${stringifyType(conditionType)}`);
                }
                destructureDef = `let ${this.visitIdentifier($case.deconstruct)}=${destructure(condition)};`;
            }
            
            return `${keyword}(${condition}){${destructureDef}${this.visitBlock($case.body, false)}}`;
        });
    }

    @boundMethod
    private visitExpression(ast: Expression): string {
        switch (ast.kind) {
            default: expectNever(ast);
            case ASTNodeKind.IntLiteral:
                return `${ast.value}n`;
            case ASTNodeKind.FloatLiteral:
            case ASTNodeKind.StringLiteral:
            case ASTNodeKind.BoolLiteral:
                return JSON.stringify(ast.value);
            case ASTNodeKind.Variable:
                return this.visitIdentifier(ast.identifier);
            case ASTNodeKind.SequenceLiteral:
                return this.visitSequenceLiteral(ast);
            case ASTNodeKind.MapLiteral:
                return this.visitMapLiteral(ast);
            case ASTNodeKind.Dereference:
                return this.dereference(ast.obj, ast.member);
            case ASTNodeKind.Invoke:
                return this.makeCall(this.visitExpression(ast.fn), ast.args);
            case ASTNodeKind.UnaryOp:
                return this.visitUnaryOp(ast);
            case ASTNodeKind.BinaryOp:
                return this.visitBinaryOp(ast);
        }
    }

    @boundMethod
    private visitSequenceLiteral(ast: SequenceLiteral) {
        const type = this.typechecker.fetchType(ast);
        if (type.kind !== TypeKind.Simple) {
            throw new Error(`Codegen found illegal sequence literal type: ${stringifyType(type)}`);
        }

        return `${type.name}([${joinBy(',', ast.elements, this.visitExpression)}])`;
    }

    @boundMethod
    private visitMapLiteral(ast: MapLiteral) {
        const type = this.typechecker.fetchType(ast);
        if (type.kind !== TypeKind.Simple) {
            throw new Error(`Codegen found illegal map literal type: ${stringifyType(type)}`);
        }

        return `${type.name}([${joinBy(
            ',',
            ast.pairs,
            pair => `[${this.visitExpression(pair.key)},${this.visitExpression(pair.value)}]`
        )}])`;
    }

    @boundMethod
    private visitUnaryOp(ast: UnaryOp) {
        const op = {
            [PrefixOperator.Minus]: '-',
            [PrefixOperator.Not]: '!',
        }[ast.op];
        return `${op}(${this.visitExpression(ast.expr)})`;
    }

    private get builtin_safe_div_int() {
        return this.defineBuiltin('safe_div_int', () => `(lhs,rhs)=>rhs===0n?undefined:lhs/rhs`);
    }

    @boundMethod
    private visitBinaryOp(ast: BinaryOp): string {
        if (isEqual(this.typechecker.fetchType(ast), intType)) {
            if (ast.op === InfixOperator.Divide) {
                return this.makeCall(this.builtin_safe_div_int, [ast.lhs, ast.rhs]);
            }
        }
        const op = {
            [InfixOperator.Add]: '+',
            [InfixOperator.Subtract]: '+',
            [InfixOperator.Multiply]: '*',
            [InfixOperator.Divide]: '/',
            [InfixOperator.Equals]: '===',
            [InfixOperator.NotEquals]: '!==',
            [InfixOperator.LessThan]: '<',
            [InfixOperator.LessThanEqual]: '<=',
            [InfixOperator.GreaterThan]: '>',
            [InfixOperator.GreaterThanEqual]: '>=',
            [InfixOperator.And]: '&&',
            [InfixOperator.Or]: '||',
        }[ast.op];
        return `(${this.visitExpression(ast.lhs)})${op}(${this.visitExpression(ast.rhs)})`;
    }

    private dereference(obj: Expression, member: Identifier) {
        return `${this.visitExpression(obj)}[${this.getPublicIdentifierString(member)}]`;
    }

    @boundMethod
    private visitTypeIdentifier(ast: TypeIdentifier) {
        return this.getSafeName(ast.name);
    }

    @boundMethod
    private visitIdentifier(ast: Identifier) {
        if (this.typechecker.binder.getVariableDefinition(ast).kind === ASTNodeKind.OutOfTree) {
            const valueImpl = this.impl.values[ast.name];
            if (valueImpl) {
                this.defineBuiltin(ast.name, () => valueImpl.emit);
            }
        }
        return this.getSafeName(ast.name);
    }

    @boundMethod
    private getPublicIdentifierString(ast: Identifier | TypeIdentifier) {
        return JSON.stringify(ast.name);
    }

    private makeCall(fn: string, args: readonly Expression[]) {
        return `${fn}(${joinBy(',', args, this.visitExpression)})`;
    }
}

function groupByKind<T extends AnyNode>(arr: readonly T[]) {
    return groupBy(arr, x => x.kind) as { [Kind in T['kind']]?: (T & { kind: Kind })[] };
}

function seq(joiner: string, ...arr: readonly string[]) {
    return arr.join(joiner);
}

function join(joiner: string, arr: Iterable<any>) {
    return [...arr].join(joiner);
}

function joinBy<T>(joiner: string, arr: Iterable<T>, callback: (arg: T, idx: number) => string) {
    return [...arr].map(callback).join(joiner);
}
