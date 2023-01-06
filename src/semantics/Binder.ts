import { AnyNode, ASTNodeKind, Block, Expression, Invoke, ListenerDefinition, Program, Statement, TopLevelDefinition, BinaryOp, UnaryOp, Dereference, StringLiteral, BoolLiteral, IntLiteral, FloatLiteral, Variable, SequenceLiteral, MapLiteral, ExpressionStatement, LetStatement, AssignVar, AssignField, IfElseChain, DebugStatement, ParameterDefinition, StateDefinition, TypeDefinition, isExpression, isStatement, StatementOrBlock, Parameter, IfCase, Pair, Comment, GenericType, TypeIdentifier, FunctionType, Type, Identifier, VariableDefinition, isVariableDefinition, stringifyNode } from '../ast/Ast';
import { expectNever } from '../utils/types';
import { Scope } from './Scope';

type AssignmentMap = Map<string, number>;

export class Binder {
    // WeakMap so that the GC can pick up dead nodes.
    private visited = new WeakSet<AnyNode>();
    private positionMap = new WeakMap<AnyNode, number>();
    private assignmentMap = new WeakMap<Block, AssignmentMap>();
    private symbolTable = new WeakMap<Block | Program | TypeDefinition, Scope>();

    constructor(private readonly topLevelScope: Scope) {

    }

    getPositionInParent(child: Expression, parent: UnaryOp | Dereference | ExpressionStatement | LetStatement | AssignVar | StateDefinition): 0;
    getPositionInParent(child: Identifier, parent: Variable | Dereference | LetStatement | AssignVar | AssignField | ParameterDefinition | Parameter | StateDefinition | IfCase): 0;
    getPositionInParent(child: Expression, parent: BinaryOp | AssignField | Pair): 0 | 1;
    /**
     * @returns `-1` if the child is the function, otherwise the argument's index
     */
    getPositionInParent(child: Expression, parent: Invoke): number;
    getPositionInParent(child: Expression, parent: SequenceLiteral | DebugStatement): number;
    getPositionInParent(child: Pair, parent: MapLiteral): number;
    getPositionInParent(child: Block, parent: IfElseChain): 0;
    getPositionInParent(child: IfCase, parent: IfElseChain): number;
    getPositionInParent(child: Expression | Block, parent: IfCase): 0;
    getPositionInParent(child: StatementOrBlock, parent: Block): number;
    getPositionInParent(child: Block, parent: ListenerDefinition): 0;
    getPositionInParent(child: Parameter, parent: ListenerDefinition | TypeDefinition): number;
    getPositionInParent(child: TopLevelDefinition, parent: Program): number;
    getPositionInParent(child: Comment, parent: Program): number;
    getPositionInParent(child: Type, parent: Parameter | LetStatement | ParameterDefinition | StateDefinition): 0;
    /**
     * @returns `-1` if the child is the generic type, otherwise the argument's index
     */
    getPositionInParent(child: Type, parent: GenericType): number;
    /**
     * @returns `-1` if the child is the return type, otherwise the parameter's index
     */
    getPositionInParent(child: Type, parent: FunctionType): number;
    // Everything else is impossible
    getPositionInParent(child: AnyNode, parent: AnyNode): never;
    getPositionInParent(child: AnyNode, parent: AnyNode) {
        if (child.parent !== parent) {
            throw new Error(`${stringifyNode(child)} is not a child of ${stringifyNode(parent)}`);
        }
        return this.positionMap.get(child);
    }

    getScope(node: Program | Block | Variable | Identifier) {
        if (node.kind === ASTNodeKind.Variable || node.kind === ASTNodeKind.Identifier) {
            let parent: Expression | Pair | Statement | IfCase | ParameterDefinition | StateDefinition | LetStatement | AssignVar | AssignField | Parameter | Block
                = node.parent!;
            
            if (parent.kind === ASTNodeKind.Parameter) {
                const listenerOrTypeDef = parent.parent!;
                if (listenerOrTypeDef.kind === ASTNodeKind.ListenerDefinition) {
                    return this.symbolTable.get(listenerOrTypeDef.body)!;
                }
                return this.symbolTable.get(listenerOrTypeDef)!;
            }
            if (parent.kind === ASTNodeKind.ParameterDefinition || parent.kind === ASTNodeKind.StateDefinition) {
                return this.symbolTable.get(parent.parent!)!;
            }
            if (parent.kind === ASTNodeKind.IfCase) {
                parent = parent.body;
            }
            while (isExpression(parent) || isStatement(parent) || parent.kind === ASTNodeKind.Pair || parent.kind === ASTNodeKind.IfCase) {
                parent = parent.parent!;
            }
            if (parent.kind === ASTNodeKind.StateDefinition) {
                return this.symbolTable.get(parent.parent!)!;
            }
            node = parent;
        }
        return this.symbolTable.get(node)!;
    }

    getVariableDefinition(ident: Identifier) {
        return this.getScope(ident).get(ident.name);
    }

    private getOrCreateScope(node: Block | Program | TypeDefinition) {
        let scope = this.symbolTable.get(node);
        if (!scope) {
            scope = new Scope(() => {
                if (node.kind === ASTNodeKind.Block) {
                    const parent = node.parent!;
                    if (parent.kind === ASTNodeKind.Block) {
                        return this.getScope(parent);
                    }
                    if (parent.kind === ASTNodeKind.IfCase) {
                        return this.getScope(parent.parent!.parent!);
                    }
                    return this.getScope(parent.parent!);
                }
                return this.topLevelScope;
            });
            this.symbolTable.set(node, scope);
        }
        return scope;
    }

    getFirstAssignmentPositionInBlock(name: string, block: Block) {
        return this.assignmentMap.get(block)?.get(name);
    }

    private getOrCreateAssignmentMap(node: Block) {
        const existing = this.assignmentMap.get(node);
        if (existing) {
            return existing;
        }
        const assignmentMap = new Map() as AssignmentMap;
        this.assignmentMap.set(node, assignmentMap);
        return assignmentMap;
    }

    getExpressionPositionInBlock(expr: Expression, targetBlock: Block) {
        let child = this.getParentStatement(expr);
        if (child.kind !== ASTNodeKind.StateDefinition) {
            return this.getStatementPositionInBlock(child, targetBlock);
        }
    }

    getStatementPositionInBlock(ast: Statement, targetBlock: Block) {
        let child = ast as StatementOrBlock;
        while (true) {
            const parent = child.parent!;
            switch (parent.kind) {
                default: expectNever(parent);
                case ASTNodeKind.Block:
                    if (parent === targetBlock) {
                        return this.getPositionInParent(child, parent);
                    }
                    child = parent;
                    break;
                case ASTNodeKind.IfElseChain:
                    child = parent;
                    break;
                case ASTNodeKind.IfCase:
                    child = parent.parent!;
                    break;
                case ASTNodeKind.ListenerDefinition:
                    return;
            }
        }
    }

    getParentStatement(expr: Expression): Statement | StateDefinition {
        let parent: Expression | Statement | IfCase | StateDefinition | Pair = expr.parent!;
        while (isExpression(parent) || parent.kind === ASTNodeKind.Pair || parent.kind === ASTNodeKind.IfCase) {
            parent = parent.parent!;
        }
        return parent;
    }

    bind(node: AnyNode): void {
        if (this.visited.has(node)) {
            // This subtree is already bound
            return;
        }
        this.visited.add(node);
        switch (node.kind) {
            default: expectNever(node);
            case ASTNodeKind.Invoke:
                return this.bindInvoke(node);
            case ASTNodeKind.BinaryOp:
                return this.bindBinaryOp(node);
            case ASTNodeKind.UnaryOp:
                return this.bindUnaryOp(node);
            case ASTNodeKind.Dereference:
                return this.bindDereference(node);
            case ASTNodeKind.Variable:
                return this.bindVariable(node);
            case ASTNodeKind.FloatLiteral:
            case ASTNodeKind.IntLiteral:
            case ASTNodeKind.BoolLiteral:
            case ASTNodeKind.StringLiteral:
                return this.bindAtomicLiteral(node);
            case ASTNodeKind.SequenceLiteral:
                return this.bindSequenceLiteral(node);
            case ASTNodeKind.MapLiteral:
                return this.bindMapLiteral(node);
            case ASTNodeKind.ExpressionStatement:
                return this.bindExpressionStatement(node);
            case ASTNodeKind.LetStatement:
                return this.bindDeclareVar(node);
            case ASTNodeKind.AssignVar:
                return this.bindAssignVar(node);
            case ASTNodeKind.AssignField:
                return this.bindAssignField(node);
            case ASTNodeKind.IfElseChain:
                return this.bindIfElseChain(node);
            case ASTNodeKind.DebugStatement:
                return this.bindDebugStatement(node);
            case ASTNodeKind.Block:
                return this.bindBlock(node);
            case ASTNodeKind.ParameterDefinition:
                return this.bindParameterDefinition(node);
            case ASTNodeKind.StateDefinition:
                return this.bindStateDefinition(node);
            case ASTNodeKind.ListenerDefinition:
                return this.bindListenerDefinition(node);
            case ASTNodeKind.TypeDefinition:
                return this.bindTypeDefinition(node);
            case ASTNodeKind.Program:
                return this.bindProgram(node);
            case ASTNodeKind.Parameter:
                return this.bindParameter(node);
            case ASTNodeKind.IfCase:
                return this.bindIfCase(node);
            case ASTNodeKind.Pair:
                return this.bindPair(node);
            case ASTNodeKind.GenericType:
                return this.bindGenericType(node);
            case ASTNodeKind.TypeIdentifier:
                return this.bindTypeIdentifier(node);
            case ASTNodeKind.FunctionType:
                return this.bindFunctionType(node);
            case ASTNodeKind.Comment:
                return this.bindComment(node);
            case ASTNodeKind.Identifier:
                return this.bindIdentifier(node);
        }
    }
    
    private bindInvoke(node: Invoke) {
        this.bindChild(node.fn, -1);
        this.bindChildren(node.args);
    }

    private bindBinaryOp(node: BinaryOp) {
        this.bindChild(node.lhs, 0);
        this.bindChild(node.rhs, 1);
    }

    private bindUnaryOp(node: UnaryOp) {
        this.bindChild(node.expr, 0);
    }

    private bindDereference(node: Dereference) {
        this.bindChild(node.obj, 0);
        this.bindChild(node.member, 0);
    }

    private bindVariable(node: Variable) {
        this.bindChild(node.identifier, 0);
    }

    private bindAtomicLiteral(node: FloatLiteral | IntLiteral | BoolLiteral | StringLiteral) {
        
    }

    private bindSequenceLiteral(node: SequenceLiteral) {
        this.bindChildren(node.elements);
        if (node.type) {
            this.bindChild(node.type, 0);
        }
    }

    private bindMapLiteral(node: MapLiteral) {
        this.bindChildren(node.pairs);
        if (node.type) {
            this.bindChild(node.type, 0);
        }
    }

    private bindExpressionStatement(node: ExpressionStatement) {
        this.bindChild(node.expr, 0);
    }

    private bindDeclareVar(node: LetStatement) {
        this.bindChild(node.name, 0);
        if (node.value) {
            this.bindChild(node.value, 0);
        }
    }

    private bindAssignVar(node: AssignVar) {
        this.bindChild(node.variable, 0);
        this.bindChild(node.value, 0);
    }

    private bindAssignField(node: AssignField) {
        this.bindChild(node.member, 0);
        this.bindChild(node.obj, 0);
        this.bindChild(node.value, 0);
    }

    private bindIfElseChain(node: IfElseChain) {
        this.bindChildren(node.cases);
        if (node.else) {
            this.bindChild(node.else, -1);
        }
    }

    private bindDebugStatement(node: DebugStatement) {
        this.bindChildren(node.arguments);
    }

    private bindBlock(node: Block) {
        let scope = this.getOrCreateScope(node);
        const assignmentMap = this.getOrCreateAssignmentMap(node);

        for (let i = 0; i < node.statements.length; i++) {
            const child = node.statements[i]!;
            this.bindChild(child, i);
            switch (child.kind) {
                case ASTNodeKind.LetStatement:
                    this.setInScope(scope, child.name, child);
                    if (child.value) {
                        this.setAssignmentPosition(assignmentMap, child.name.name, i);
                    }
                    break;
                case ASTNodeKind.AssignVar:
                    this.setAssignmentPosition(assignmentMap, child.variable.name, i);
                    break;
                case ASTNodeKind.Block:
                    this.getOrCreateAssignmentMap(child).forEach((_, name) => {
                        this.setAssignmentPosition(assignmentMap, name, i);
                    });
                    break;
                case ASTNodeKind.IfElseChain:
                    if (child.else) {
                        const caseAssignmentMaps = child.cases.map(x => this.getOrCreateAssignmentMap(x.body));
                        [...this.getOrCreateAssignmentMap(child.else).keys()]
                            .filter(name => caseAssignmentMaps.every(map => map.has(name)))
                            .forEach(name => this.setAssignmentPosition(assignmentMap, name, i));
                    }
                    break;
            }
        }
    }

    private bindParameterDefinition(node: ParameterDefinition) {
        this.bindChild(node.name, 0);
        this.bindChild(node.type, 0);
    }

    private bindStateDefinition(node: StateDefinition) {
        if (node.default) {
            this.bindChild(node.default, 0);
        }
        if (node.type) {
            this.bindChild(node.type, 0);
        }
        this.bindChild(node.name, 0);
    }

    private bindListenerDefinition(node: ListenerDefinition) {
        this.bindChildren(node.parameters);
        const scope = this.getOrCreateScope(node.body);
        for (const param of node.parameters) {
            this.setInScope(scope, param.name, param);
        }
        this.bindChild(node.body, 0);
    }

    private bindTypeDefinition(node: TypeDefinition) {
        this.bindChild(node.name, 0);
        const scope = this.getOrCreateScope(node);
        for (const param of node.parameters) {
            this.setInScope(scope, param.name, param);
        }
        this.bindChildren(node.parameters);
    }

    private bindProgram(node: Program) {
        const scope = this.getOrCreateScope(node);
        for (const child of node.definitions) {
            if (isVariableDefinition(child)) {
                this.setInScope(scope, child.name, child);
            }
        }
        this.bindChildren(node.definitions);
    }

    private bindParameter(node: Parameter) {
        this.bindChild(node.name, 0);
        this.bindChild(node.type, 0);
    }

    private bindIfCase(node: IfCase) {
        if (node.deconstruct) {
            this.bindChild(node.deconstruct, 0);
            const scope = this.getOrCreateScope(node.body);
            this.setInScope(scope, node.deconstruct, node);
            const assignmentMap = this.getOrCreateAssignmentMap(node.body);
            this.setAssignmentPosition(assignmentMap, node.deconstruct.name, -1);
        }
        this.bindChild(node.condition, 0);
        this.bindChild(node.body, 0);
    }

    private bindPair(node: Pair) {
        this.bindChild(node.key, 0);
        this.bindChild(node.value, 1);
    }
    
    private bindFunctionType(node: FunctionType) {
        this.bindChild(node.returnType, -1);
        this.bindChildren(node.parameters);
    }

    private bindTypeIdentifier(node: TypeIdentifier) {
        
    }

    private bindGenericType(node: GenericType) {
        this.bindChild(node.name, -1);
        this.bindChildren(node.typeArguments);
    }

    private bindComment(node: Comment) {
        
    }

    private bindIdentifier(node: Identifier) {
        
    }

    private bindChild(child: AnyNode, pos: number) {
        this.positionMap.set(child, pos);
        this.bind(child);
    }

    private bindChildren(children: readonly AnyNode[]) {
        for (let i = 0; i < children.length; i++) {
            this.bindChild(children[i]!, i);
        }
    }

    private setInScope(scope: Scope, ident: Identifier | TypeIdentifier, varDef: VariableDefinition) {
        scope.set(ident.name, varDef);
    }

    private setAssignmentPosition(assignmentMap: AssignmentMap, name: string, position: number) {
        if (!assignmentMap.has(name)) {
            assignmentMap.set(name, position);
        }
    }
}