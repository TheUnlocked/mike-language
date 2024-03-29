import { boundMethod } from 'autobind-decorator';
import { groupBy, isEqual } from 'lodash';
import { check as isReserved } from 'reserved-words';
import { AnyNode, ASTNodeKind, BinaryOp, Block, Dereference, Expression, Identifier, IfElseChain, InfixOperator, ListenerDefinition, MapLiteral, ParameterDefinition, PrefixOperator, Program, SequenceLiteral, StateDefinition, Statement, StatementOrBlock, TypeDefinition, TypeIdentifier, UnaryOp } from '../../ast/Ast';
import { ParameterType } from './types';
import { Typechecker } from '../../semantics/Typechecker';
import { KnownType, stringifyType, TypeKind } from '../../types/KnownType';
import { intType, primitiveTypes } from '../../types/Primitives';
import { expectNever, staticContract } from '../../utils/types';
import { Target, TargetFactory } from '../Target';
import { LibraryImplementation } from '../../library/Library';
import jsStdlibImpl from './stdlib';
import { JsLibraryImplementation, SerializableType } from './LibraryImpl';
import { TypeAttributeKind } from '../../types/Attribute';

interface StateTypeInfo {
    readonly typeNamesInState: readonly string[];
    readonly nameTypePairs: readonly (readonly [Identifier, SerializableType])[];
}

const MAGIC_VARIABLES = new Set(['globalThis']);

function isCompilerReserved(name: string) {
    return MAGIC_VARIABLES.has(name) || isReserved(name, 'next', true) || name.startsWith('$');
}

export function createJavascriptTarget(exposeNames?: string[]): TargetFactory {
    @staticContract<TargetFactory>()
    class JavascriptTarget implements Target {
    
        private builtins = new Map<string, string>();
    
        private identifierMappings = new Map<string, string>();
        private usedNames = new Set<string>();
    
        static get defaultImplementations() {
            return [jsStdlibImpl];
        }
    
        static create(typechecker: Typechecker, impl: LibraryImplementation) {
            return new JavascriptTarget(typechecker, impl as JsLibraryImplementation);
        }
    
        constructor(private readonly typechecker: Typechecker, private readonly impl: JsLibraryImplementation) {
    
        }
    
        generate(program: Program): ArrayBuffer {
            return new TextEncoder().encode(this.visitProgram(program));
        }
    
        @boundMethod
        private getSafeName(name: string) {
            let safeName = this.identifierMappings.get(name);
            if (!safeName) {
                safeName = name;
                while (this.usedNames.has(safeName) || isCompilerReserved(safeName)) {
                    safeName = `_${safeName}`;
                }
                this.identifierMappings.set(name, safeName);
                this.usedNames.add(safeName);
            }
            return safeName;
        }
    
        private defineBuiltin(name: string, lazyCode: () => string): string {
            if (isCompilerReserved(name)) {
                return this.getSafeName(name);
            }
            name = this.getSafeName(name);
            if (!this.builtins.has(name)) {
                this.builtins.set(name, lazyCode());
            }
            return name;
        }
    
        private get builtin_externals() {
            return this.getSafeName('externals');
        }
    
        private visitProgram(program: Program): string {
            const defsByKind = groupByKind(program.definitions);
            const params = defsByKind[ASTNodeKind.ParameterDefinition] ?? [];
            const state = defsByKind[ASTNodeKind.StateDefinition] ?? [];
            const typeDefs = defsByKind[ASTNodeKind.TypeDefinition] ?? [];
            const listeners = defsByKind[ASTNodeKind.ListenerDefinition] ?? [];
    
            const stateTypeInfo = this.getStateTypeInfo(state);
    
            const externalsName = this.builtin_externals;
    
            const userCode = `${joinBy('', typeDefs, this.visitTypeDefinition)}return{${seq(',',
                `createInitialState:()=>({${joinBy(',', state, this.visitStateDefinition)}})`,
                `listeners:[${joinBy(',', listeners, def => this.visitListenerDefinition(def, params, state))}]`,
                `serialize:${this.generateSerializer(stateTypeInfo)}`,
                `deserialize:${this.generateDeserializer(stateTypeInfo)}`,
                `params:[${joinBy(',', params, this.visitParameterDefinition)}]`,
                `createParams:${this.generateCreateParams(params)}`,
                `exposed:${this.generateExposed()}`
            )}}`;
    
            return `export default ${externalsName}=>{${
                joinBy('', this.builtins, ([name, code]) => `const ${name}=${code};`)
            }${userCode}}`;
        }

        private generateExposed() {
            if (exposeNames) {
                const expose = (name: string) => `${JSON.stringify(name)}:${this.getBuiltinVariableName(name)}`;
                return `{${joinBy(',', exposeNames, expose)}}`;
            }
            return '{}';
        }
        
        private generateCreateParams(params: ParameterDefinition[]) {
            const getIntParam = 'getIntParam';
            const getFloatParam = 'getFloatParam';
            const getStringParam = 'getStringParam';
            const getBooleanParam = 'getBooleanParam';
            const getOptionParam = 'getOptionParam';
            const getCustomParam = 'getCustomParam';
    
            const visitOptionValue = (type: ParameterType): string => {
                switch (type.variant) {
                    case 'int':
                        return `$.${getIntParam}()`;
                    case 'float':
                        return `$.${getFloatParam}()`;
                    case 'string':
                        return `$.${getStringParam}()`;
                    case 'boolean':
                        return `$.${getBooleanParam}()`;
                    case 'option':
                        const some = this.getBuiltinVariableName('some');
                        const none = this.getBuiltinVariableName('none');
                        return `($=>$?${some}(${visitOptionValue(type.type)}):${none})($.${getOptionParam}())`;
                    case 'custom':
                        return `$.${getCustomParam}(${JSON.stringify(type.name)})`;
                }
            };
    
            const visitParameter = (param: ParameterDefinition) => {
                const paramName = this.getPublicIdentifierString(param.name);
                const type = this.toParameterType(this.typechecker.fetchVariableDefinitionType(param));
    
                switch (type.variant) {
                    case 'int':
                        return `${paramName}:$.${getIntParam}(${paramName})`;
                    case 'float':
                        return `${paramName}:$.${getFloatParam}(${paramName})`;
                    case 'string':
                        return `${paramName}:$.${getStringParam}(${paramName})`;
                    case 'boolean':
                        return `${paramName}:$.${getBooleanParam}(${paramName})`;
                    case 'option':
                        const some = this.getBuiltinVariableName('some');
                        const none = this.getBuiltinVariableName('none');
                        const value = visitOptionValue(type.type);
                        return `${paramName}:($=>$?${some}(${value}):${none})($.${getOptionParam}(${paramName}))`;
                    case 'custom':
                        return `${paramName}:$.${getCustomParam}(${paramName}, ${JSON.stringify(type.name)})`;
                }
            };
    
            return `$=>({${joinBy(',', params, visitParameter)}})`;
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
            return `${this.getPublicIdentifierString(ast.name)}: ${this.visitExpression(ast.default!)}`;
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
                    return { variant: type.name };
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
        private toSerializableType(type: KnownType): SerializableType {
            if (type.kind !== TypeKind.Simple) {
                throw new Error(`Non-serializable type in state: ${stringifyType(type)}`);
            }
            return {
                name: type.name,
                typeArguments: type.typeArguments.map(this.toSerializableType),
            };
        };
    
        private getStateTypeInfo(state: readonly StateDefinition[]): StateTypeInfo {
            const typeNames = new Set<string>();
            const toSerializableType = (type: KnownType): SerializableType => {
                if (type.kind !== TypeKind.Simple) {
                    throw new Error(`Non-serializable type in state: ${stringifyType(type)}`);
                }
                typeNames.add(type.name);
                const typeInfo = this.typechecker.fetchTypeInfoFromSimpleType(type);
                if (typeInfo?.attributes.some(x => x.kind === TypeAttributeKind.IsUserDefined)) {
                    for (const memberType of Object.values(typeInfo.members)) {
                        if (memberType.kind !== TypeKind.Simple) {
                            throw new Error(`Non-serializable type ${stringifyType(memberType)} in user type ${stringifyType(type)} used in state`);
                        }
                        if (!typeNames.has(memberType.name)) {
                            typeNames.add(toSerializableType(memberType).name);
                        }
                    }
                }
                return {
                    name: type.name,
                    typeArguments: type.typeArguments.map(toSerializableType),
                };
            };
    
            const nameTypePairs = state.map(st => [
                st.name,
                toSerializableType(this.typechecker.fetchVariableDefinitionType(st))
            ] as const);
    
            return {
                typeNamesInState: [...typeNames],
                nameTypePairs,
            };
        }
        
        private generateSerializer({ nameTypePairs, typeNamesInState }: StateTypeInfo) {
            return `state=>{let id=0;const objs=[];const refMap=new Map();const $serialize=(obj,type)=>{if(refMap.has(obj))return refMap.get(obj);const myId=id++;refMap.set(obj,myId);objs[myId]={${
                joinBy(',', typeNamesInState, name => {
                    let serializer: string;
                    if (primitiveTypes.some(x => x.name === name)) {
                        switch (name) {
                            case 'int':
                            case 'float':
                                serializer = 'x=>globalThis.String(x)';
                                break;
                            default:
                                serializer = 'x=>x';
                                break;
                        }
                    }
                    else {
                        const type = this.typechecker.fetchTypeInfoFromSimpleType({
                            _type: true,
                            kind: TypeKind.Simple,
                            name,
                            typeArguments: [],
                        });
                        if (type?.attributes.some(x => x.kind === TypeAttributeKind.IsUserDefined)) {
                            const members = Object.entries(type.members);
                            serializer = `({${
                                joinBy(',', members, ([name]) => this.getPublicPrivateObjectBindingFromString(name))
                            }})=>({${
                                joinBy(',', members, ([name, type]) => {
                                    const serializableType = this.toSerializableType(type);
                                    return `${JSON.stringify(name)}:$serialize(${this.getSafeName(name)},${JSON.stringify(serializableType)})`;
                                })
                            }})`;
                        }
                        else {
                            serializer = this.impl.types[name](this.getBuiltinVariableName).serialize;
                        }
                    }
                    return `${JSON.stringify(name)}:${serializer}`;
                })
            }}[type.name](obj,type,$serialize);return myId};const refs={${
                joinBy(',', nameTypePairs, ([id, type]) => {
                    const stateName = this.getPublicIdentifierString(id);
                    return `${stateName}:$serialize(state[${stateName}],${JSON.stringify(type)})`;
                })
            }};return globalThis.JSON.stringify({objs,refs})}`;
        }
    
        private generateDeserializer({ nameTypePairs, typeNamesInState }: StateTypeInfo) {
            return `state=>{const{objs,refs}=globalThis.JSON.parse(state);const objMap=new globalThis.Map();const $deserialize=(ref,type)=>{if(objMap.has(ref)){return objMap.get(ref)}const obj={${
                joinBy(',', typeNamesInState, name => {
                    let deserializer: string;
                    if (primitiveTypes.some(x => x.name === name)) {
                        switch (name) {
                            case 'int':
                                deserializer = 'x=>globalThis.BigInt(x)';
                                break;
                            case 'float':
                                deserializer = 'x=>globalThis.Number(x)';
                                break;
                            default:
                                deserializer = 'x=>x';
                                break;
                        }
                    }
                    else {
                        const type = this.typechecker.fetchTypeInfoFromSimpleType({
                            _type: true,
                            kind: TypeKind.Simple,
                            name,
                            typeArguments: [],
                        });
                        if (type?.attributes.some(x => x.kind === TypeAttributeKind.IsUserDefined)) {
                            const members = Object.entries(type.members);
                            deserializer = `({${
                                joinBy(',', members, ([name]) => this.getPublicPrivateObjectBindingFromString(name))
                            }})=>{const obj={};objMap.set(ref,obj);return Object.assign(obj,{${
                                joinBy(',', members, ([name, type]) => {
                                    const serializableType = this.toSerializableType(type);
                                    return `${JSON.stringify(name)}:$deserialize(${this.getSafeName(name)},${JSON.stringify(serializableType)})`;
                                })
                            }})}`;
                        }
                        else {
                            const typeImpl = this.impl.types[name](this.getBuiltinVariableName);
                            if (typeImpl.class) {
                                deserializer = `(a,b,c)=>(${
                                    typeImpl.deserialize.toString()
                                })(a,b,c,${this.defineBuiltin(name, () => typeImpl.class!.toString())})`;
                            }
                            else {
                                deserializer = typeImpl.deserialize.toString();
                            }
                        }
                    }
                    return `${JSON.stringify(name)}:${deserializer}`;
                })
            }}[type.name](objs[ref],type,$deserialize);objMap.set(ref,obj);return obj};return{${
                joinBy(',', nameTypePairs, ([id, type]) => {
                    const stateName = this.getPublicIdentifierString(id);
                    return `${stateName}:$deserialize(refs[${stateName}],${JSON.stringify(type)})`;
                })
            }}}`;
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
                    `args:[${joinBy(',', argNames, id => id.name)}]`,
                )}})=>{${this.visitBlock(ast.body, false)}return{state:${stateObject}};}`,
            )}}`;
        }
    
        @boundMethod
        private getPublicPrivateObjectBinding(id: Identifier) {
            return `${this.getPublicIdentifierString(id)}:${this.visitIdentifier(id)}`;
        }
    
        @boundMethod
        private getPublicPrivateObjectBindingFromString(name: string) {
            return `${JSON.stringify(name)}:${this.getSafeName(name)}`;
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
                    return `${this.builtin_externals}.debug(${joinBy(',', ast.arguments, this.visitExpression)});`;
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
            const $else = ast.else ? `else${this.visitBlock(ast.else)}` : '';
            return joinBy('', ast.cases, ($case, idx) => {
                const keyword = idx === 0 ? 'if' : 'else if';
                const conditionType = this.typechecker.fetchType($case.condition);
                if (conditionType.kind !== TypeKind.Simple) {
                    throw new Error(`Invalid condition type: ${stringifyType(conditionType)}`);
                }
    
                const conditionMethods = conditionType.name === 'boolean'
                    ? { condition: (x: string) => x, destructure: undefined }
                    : this.impl.types[conditionType.name]?.(this.getBuiltinVariableName).conditionMethods;
                if (!conditionMethods) {
                    throw new Error(`Condition not implemented for ${stringifyType(conditionType)}`);
                }
                const { condition: processCondition, destructure } = conditionMethods;
    
                const rawCondition = this.visitExpression($case.condition);
                
                let destructureDef = '';
                if ($case.deconstruct) {
                    if (!destructure) {
                        throw new Error(`If destructuring not properly implemented for ${stringifyType(conditionType)}`);
                    }
                    destructureDef = `let ${this.visitIdentifier($case.deconstruct)}=${destructure(rawCondition)};`;
                }
                
                const condition = processCondition(rawCondition);
                return `${keyword}(${condition}){${destructureDef}${this.visitBlock($case.body, false)}}`;
            }) + $else;
        }
    
        @boundMethod
        private visitExpression(ast: Expression): string {
            switch (ast.kind) {
                default: expectNever(ast);
                case ASTNodeKind.IntLiteral:
                    return `${ast.value}n`;
                case ASTNodeKind.FloatLiteral:
                case ASTNodeKind.BoolLiteral:
                    return String(ast.value);
                case ASTNodeKind.StringLiteral:
                    return JSON.stringify(ast.value);
                case ASTNodeKind.Variable:
                    return this.visitIdentifier(ast.identifier);
                case ASTNodeKind.SequenceLiteral:
                    return this.visitSequenceLiteral(ast);
                case ASTNodeKind.MapLiteral:
                    return this.visitMapLiteral(ast);
                case ASTNodeKind.Dereference:
                    return this.visitDereference(ast);
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
    
            const typeImpl = this.impl.types[type.name](this.getBuiltinVariableName);
            if (!typeImpl?.class) {
                throw new Error(`Sequence-like types must be implemented with classes, but ${stringifyType(type)} was not.`);
            }
    
            return `new ${
                this.defineBuiltin(type.name, () => typeImpl.class!.toString())
            }([${
                joinBy(',', ast.elements, this.visitExpression)
            }])`;
        }
    
        @boundMethod
        private visitMapLiteral(ast: MapLiteral) {
            const type = this.typechecker.fetchType(ast);
            if (type.kind !== TypeKind.Simple) {
                throw new Error(`Codegen found illegal map literal type: ${stringifyType(type)}`);
            }
    
            const typeImpl = this.impl.types[type.name](this.getBuiltinVariableName);
            if (!typeImpl?.class) {
                throw new Error(`Map-like types must be implemented with classes, but ${stringifyType(type)} was not.`);
            }
    
            return `new ${this.defineBuiltin(type.name, () => typeImpl.class!.toString())}([${joinBy(
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
    
        private get builtin_deref_function_bind() {
            return this.defineBuiltin('deref_function_bind', () => '(obj,member)=>obj[member].bind(obj)');
        }
    
        private visitDereference(ast: Dereference) {
            const parent = ast.parent!;
            if (parent.kind !== ASTNodeKind.Invoke) {
                const memberType = this.typechecker.fetchTypeFromIdentifier(ast.member);
                if (memberType.kind === TypeKind.Function) {
                    return `${this.builtin_deref_function_bind}(${
                        this.visitExpression(ast.obj)
                    },${
                        this.getPublicIdentifierString(ast.member)
                    })`;
                }
            }
            return this.dereference(ast.obj, ast.member);
        }
    
        private dereference(obj: Expression, member: Identifier) {
            return `${this.visitExpression(obj)}[${this.getPublicIdentifierString(member)}]`;
        }
    
        @boundMethod
        private visitTypeIdentifier(ast: TypeIdentifier) {
            return this.getSafeName(ast.name);
        }
    
        @boundMethod
        private getBuiltinVariableName(name: string) {
            return this.defineBuiltin(name, () => {
                const val = this.impl.values[name];
                if (val) {
                    return val(this.getBuiltinVariableName).emit;
                }
                const type = this.impl.types[name]?.(this.getBuiltinVariableName);
                if (type?.class) {
                    return type.class.toString();
                }
                throw new Error(`Invalid builtin identifier name: ${name}`);
            });
        }
    
        @boundMethod
        private visitIdentifier(ast: Identifier) {
            if (this.typechecker.symbolTable.getVariableDefinition(ast)?.kind === ASTNodeKind.OutOfTree) {
                const valueImpl = this.impl.values[ast.name](this.getBuiltinVariableName);
                if (valueImpl) {
                    return this.defineBuiltin(ast.name, () => valueImpl.emit);
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

    return JavascriptTarget;
}

const JavascriptTarget = createJavascriptTarget();

export default JavascriptTarget;


function groupByKind<T extends AnyNode>(arr: readonly T[]) {
    return groupBy(arr, x => x.kind) as { [Kind in T['kind']]?: (T & { kind: Kind })[] };
}

function seq(joiner: string, ...arr: readonly string[]) {
    return arr.join(joiner);
}

function joinBy<T>(joiner: string, arr: Iterable<T>, callback: (arg: T, idx: number) => string) {
    return [...arr].map(callback).join(joiner);
}
