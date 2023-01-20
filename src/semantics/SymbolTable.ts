import { getChildren } from '../ast';
import { AnyNode, ASTNodeKind, Block, Expression, ListenerDefinition, Program, Statement, Variable, LetStatement, AssignVar, AssignField, ParameterDefinition, StateDefinition, TypeDefinition, isExpression, isStatement, StatementOrBlock, Parameter, IfCase, Pair, TypeIdentifier, Identifier, VariableDefinition, isVariableDefinition } from '../ast/Ast';
import { expectNever } from '../utils/types';
import { Scope } from './Scope';

type AssignmentMap = Map<string, number>;

interface PositionInParentCacheEntry {
    parent: AnyNode;
    position: number;
}

export class SymbolTable {
    // WeakSet/WeakMap so that the GC can pick up dead nodes.
    /** Set of nodes which have been bound */
    private visited = new WeakSet<AnyNode>();
    /** Mapping between nodes and their position in their parent */
    private positionMap = new WeakMap<AnyNode, PositionInParentCacheEntry>();
    /** Mapping between blocks and the position that each "own local" is first definitely assigned */
    private assignmentMap = new WeakMap<Block, AssignmentMap>();
    /** Mapping between nodes containing scopes and the scopes they contain */
    private scopeMap = new WeakMap<Block | Program | TypeDefinition, Scope>();

    constructor(private readonly topLevelScope: Scope) {

    }

    getPositionInParent(node: AnyNode) {
        if (!node.parent) {
            return 0;
        }
        const entry = this.positionMap.get(node);
        const parent = node.parent;
        if (!entry || entry.parent !== parent) {
            const children = getChildren(parent);
            for (let i = 0; i < children.length; i++) {
                this.positionMap.set(children[i], { parent, position: i });
            }
            return this.positionMap.get(node)!.position;
        }
        return entry.position;
    }

    getScope(node: Program | Block | Variable | Identifier) {
        this.bind(node);

        if (node.kind === ASTNodeKind.Variable || node.kind === ASTNodeKind.Identifier) {
            let parent: Expression | Pair | Statement | IfCase | ParameterDefinition | StateDefinition | LetStatement | AssignVar | AssignField | Parameter | Block
                = node.parent!;
            
            if (parent.kind === ASTNodeKind.Parameter) {
                const listenerOrTypeDef = parent.parent!;
                if (listenerOrTypeDef.kind === ASTNodeKind.ListenerDefinition) {
                    return this.scopeMap.get(listenerOrTypeDef.body)!;
                }
                return this.scopeMap.get(listenerOrTypeDef)!;
            }
            if (parent.kind === ASTNodeKind.ParameterDefinition || parent.kind === ASTNodeKind.StateDefinition) {
                return this.scopeMap.get(parent.parent!)!;
            }
            if (parent.kind === ASTNodeKind.IfCase) {
                parent = parent.body;
            }
            while (isExpression(parent) || isStatement(parent) || parent.kind === ASTNodeKind.Pair || parent.kind === ASTNodeKind.IfCase) {
                parent = parent.parent!;
            }
            if (parent.kind === ASTNodeKind.StateDefinition) {
                return this.scopeMap.get(parent.parent!)!;
            }
            node = parent;
        }
        return this.scopeMap.get(node)!;
    }

    getVariableDefinition(ident: Identifier) {
        return this.getScope(ident).get(ident.name);
    }

    private getOrCreateScope(node: Block | Program | TypeDefinition) {
        let scope = this.scopeMap.get(node);
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
            this.scopeMap.set(node, scope);
        }
        return scope;
    }

    getFirstAssignmentPositionInBlock(name: string, block: Block) {
        this.bindBlock(block);
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

    getStatementPositionInBlock(ast: StatementOrBlock, targetBlock: Block) {
        let child = ast;
        while (true) {
            const parent = child.parent!;
            switch (parent.kind) {
                default: expectNever(parent);
                case ASTNodeKind.Block:
                    if (parent === targetBlock) {
                        return this.getPositionInParent(child);
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
            case ASTNodeKind.Block:
                return this.bindBlock(node);
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
        }
    }

    private bindBlock(node: Block) {
        let scope = this.getOrCreateScope(node);
        const assignmentMap = this.getOrCreateAssignmentMap(node);

        for (let i = 0; i < node.statements.length; i++) {
            const child = node.statements[i]!;
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
                    this.bind(child);
                    this.getOrCreateAssignmentMap(child).forEach((_, name) => {
                        this.setAssignmentPosition(assignmentMap, name, i);
                    });
                    break;
                case ASTNodeKind.IfElseChain:
                    this.bindChildren(child.cases);
                    if (child.else) {
                        this.bind(child.else);
                        const caseAssignmentMaps = child.cases.map(x => this.getOrCreateAssignmentMap(x.body));
                        [...this.getOrCreateAssignmentMap(child.else).keys()]
                            .filter(name => caseAssignmentMaps.every(map => map.has(name)))
                            .forEach(name => this.setAssignmentPosition(assignmentMap, name, i));
                    }
                    break;
            }
        }
    }

    private bindListenerDefinition(node: ListenerDefinition) {
        this.bindChildren(node.parameters);
        const scope = this.getOrCreateScope(node.body);
        for (const param of node.parameters) {
            this.setInScope(scope, param.name, param);
        }
        this.bindChild(node.body);
    }

    private bindTypeDefinition(node: TypeDefinition) {
        this.bindChild(node.name);
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
        this.bindChild(node.name);
        this.bindChild(node.type);
    }

    private bindIfCase(node: IfCase) {
        if (node.deconstruct) {
            this.bindChild(node.deconstruct);
            const scope = this.getOrCreateScope(node.body);
            this.setInScope(scope, node.deconstruct, node);
            const assignmentMap = this.getOrCreateAssignmentMap(node.body);
            this.setAssignmentPosition(assignmentMap, node.deconstruct.name, -1);
        }
        this.bindChild(node.condition);
        this.bindChild(node.body);
    }

    private bindChild(child: AnyNode) {
        this.bind(child);
    }

    private bindChildren(children: readonly AnyNode[]) {
        for (let i = 0; i < children.length; i++) {
            this.bindChild(children[i]!);
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