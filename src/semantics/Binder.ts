import stringifyNode, { AnyNode, ASTNodeKind, Block, Expression, Invoke, ListenerDefinition, Program, Statement, TopLevelDefinition, BinaryOp, UnaryOp, Dereference, StringLiteral, BoolLiteral, IntLiteral, FloatLiteral, Variable, SequenceLiteral, MapLiteral, ExpressionStatement, LetStatement, AssignVar, AssignField, IfElseChain, DebugStatement, ParamDefinition, StateDefinition, TypeDefinition, isExpression, isStatement, StatementOrBlock, ParameterFragment, IfCaseFragment, PairFragment } from '../ast/Ast';
import Scope from './Scope';

export class Binder {
    // WeakMap so that the GC can pick up dead nodes.
    private parentMap = new WeakMap<AnyNode, AnyNode>();
    private positionMap = new WeakMap<AnyNode, number>();
    private symbolTable = new WeakMap<Block | Program, Scope>();

    constructor(private topLevelScope: Scope) {

    }

    getParent(node: Expression): Exclude<Expression, MapLiteral> | PairFragment | Statement;
    getParent(node: Statement): Block;
    getParent(node: Block): Block | ListenerDefinition;
    getParent(node: TopLevelDefinition): Program;
    getParent(node: Program): undefined;
    getParent(node: PairFragment): MapLiteral;
    getParent(node: IfCaseFragment): IfElseChain;
    getParent(node: ParameterFragment): ListenerDefinition;
    // Combo overloads (can be removed if https://github.com/microsoft/TypeScript/issues/14107 gets resolved)
    getParent(node: Expression | Statement | PairFragment): Expression | Statement | PairFragment | Block;
    // Fallback
    getParent(node: AnyNode): AnyNode;
    getParent(node: AnyNode) {
        return this.parentMap.get(node);
    }

    getPositionInParent(child: Expression, parent: UnaryOp | Dereference | ExpressionStatement | LetStatement | AssignVar | StateDefinition): 0;
    getPositionInParent(child: Expression, parent: BinaryOp | AssignField | PairFragment): 0 | 1;
    /**
     * @returns `-1` if the child is the function, otherwise the argument's index
     */
    getPositionInParent(child: Expression, parent: Invoke): number;
    getPositionInParent(child: Expression, parent: SequenceLiteral | DebugStatement): number;
    getPositionInParent(child: PairFragment, parent: MapLiteral): number;
    getPositionInParent(child: Block, parent: IfElseChain): 0;
    getPositionInParent(child: IfCaseFragment, parent: IfElseChain): number;
    getPositionInParent(child: Expression | Block, parent: IfCaseFragment): 0;
    getPositionInParent(child: StatementOrBlock, parent: Block): number;
    getPositionInParent(child: Block, parent: ListenerDefinition): 0;
    getPositionInParent(child: ParameterFragment, parent: ListenerDefinition): number;
    getPositionInParent(child: TopLevelDefinition, parent: Program): number;
    // Everything else is impossible
    getPositionInParent(child: AnyNode, parent: AnyNode): never;
    getPositionInParent(child: AnyNode, parent: AnyNode) {
        if (this.parentMap.get(child) !== parent) {
            throw new Error(`${stringifyNode(child)} is not a child of ${stringifyNode(parent)}`);
        }
        return this.positionMap.get(child);
    }

    getScope(node: Program | Block | Variable) {
        if (node.kind === ASTNodeKind.Variable) {
            let parent: Expression | StatementOrBlock | PairFragment = this.getParent(node);
            while (isExpression(parent) || isStatement(parent) || parent.kind === ASTNodeKind.PairFragment) {
                parent = this.getParent(parent);
            }
            node = parent;
        }
        return this.symbolTable.get(node) ?? this.topLevelScope;
    }

    private getOrCreateScope(node: Block | Program) {
        let scope = this.getScope(node);
        if (!scope) {
            scope = new Scope(() => {
                if (node.kind === ASTNodeKind.Block) {
                    const parent = this.getParent(node);
                    if (parent.kind === ASTNodeKind.Block) {
                        return this.getScope(parent);
                    }
                    return this.getScope(this.getParent(parent));
                }
                return this.topLevelScope;
            });
            this.symbolTable.set(node, scope);
        }
        return scope;
    }

    bind(node: AnyNode) {
        if (this.parentMap.has(node)) {
            // This subtree is already bound
            return;
        }
        switch (node.kind) {
            case ASTNodeKind.Invoke:
                return this.bindInvoke(node);
            case ASTNodeKind.BinaryOp:
                return this.bindBinaryOp(node);
            case ASTNodeKind.UnaryOp:
                return this.bindUnaryOp(node);
            case ASTNodeKind.Dereference:
                return this.bindDereference(node);
            case ASTNodeKind.Variable:
            case ASTNodeKind.FloatLiteral:
            case ASTNodeKind.IntLiteral:
            case ASTNodeKind.BoolLiteral:
            case ASTNodeKind.StringLiteral:
                return this.bindAtomicExpression(node);
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
            case ASTNodeKind.ParamDefinition:
                return this.bindParamDefinition(node);
            case ASTNodeKind.StateDefinition:
                return this.bindStateDefinition(node);
            case ASTNodeKind.ListenerDefinition:
                return this.bindListenerDefinition(node);
            case ASTNodeKind.TypeDefinition:
                return this.bindTypeDefinition(node);
            case ASTNodeKind.Program:
                return this.bindProgram(node);
            case ASTNodeKind.ParameterFragment:
                return this.bindParameterFragment(node);
            case ASTNodeKind.IfCaseFragment:
                return this.bindIfCaseFragment(node);
            case ASTNodeKind.PairFragment:
                return this.bindPairFragment(node);
        }
    }
    
    private bindInvoke(node: Invoke) {
        this.bindChild(node, node.fn, -1);
        this.bindChildren(node, node.args);
    }

    private bindBinaryOp(node: BinaryOp) {
        this.bindChild(node, node.lhs, 0);
        this.bindChild(node, node.rhs, 1);
    }

    private bindUnaryOp(node: UnaryOp) {
        this.bindChild(node, node.expr, 0);
    }

    private bindDereference(node: Dereference) {
        this.bindChild(node, node.obj, 0);
    }

    private bindAtomicExpression(node: Variable | FloatLiteral | IntLiteral | BoolLiteral | StringLiteral) {
        
    }

    private bindSequenceLiteral(node: SequenceLiteral) {
        this.bindChildren(node, node.elements);
    }

    private bindMapLiteral(node: MapLiteral) {
        this.bindChildren(node, node.pairs);
    }

    private bindExpressionStatement(node: ExpressionStatement) {
        this.bindChild(node, node.expr, 0);
    }

    private bindDeclareVar(node: LetStatement) {
        if (node.value) {
            this.bindChild(node, node.value, 0);
        }
    }

    private bindAssignVar(node: AssignVar) {
        this.bindChild(node, node.value, 0);
    }

    private bindAssignField(node: AssignField) {
        this.bindChild(node, node.obj, 0);
        this.bindChild(node, node.value, 0);
    }

    private bindIfElseChain(node: IfElseChain) {
        this.bindChildren(node, node.cases);
        if (node.else) {
            this.bindChild(node, node.else, -1);
        }
    }

    private bindDebugStatement(node: DebugStatement) {
        this.bindChildren(node, node.arguments);
    }

    private bindBlock(node: Block) {
        let scope = this.getOrCreateScope(node);

        for (const child of node.statements) {
            if (child.kind === ASTNodeKind.LetStatement) {
                scope.set(child.name, child);
            }
        }
        this.bindChildren(node, node.statements);
    }

    private bindParamDefinition(node: ParamDefinition) {
        
    }

    private bindStateDefinition(node: StateDefinition) {
        if (node.default) {
            this.bindChild(node, node.default, 0);
        }
    }

    private bindListenerDefinition(node: ListenerDefinition) {
        this.bindChildren(node, node.parameters);
        const scope = this.getOrCreateScope(node.body);
        for (const param of node.parameters) {
            scope.set(param.name, param);
        }
        this.bindChild(node, node.body, 0);
    }

    private bindTypeDefinition(node: TypeDefinition) {
        
    }

    private bindProgram(node: Program) {
        const scope = this.getOrCreateScope(node);
        for (const child of node.definitions) {
            if (child.kind === ASTNodeKind.ParamDefinition || child.kind === ASTNodeKind.StateDefinition) {
                scope.set(child.name, child);
            }
        }
        this.bindChildren(node, node.definitions);
    }

    private bindParameterFragment(node: ParameterFragment) {

    }

    private bindIfCaseFragment(node: IfCaseFragment) {
        const scope = this.getOrCreateScope(node.body);
        if (node.deconstructName) {
            scope.set(node.deconstructName, node);
        }
        this.bindChild(node, node.condition, 0);
        this.bindChild(node, node.body, 0);
    }

    private bindPairFragment(node: PairFragment) {
        this.bindChild(node, node.key, 0);
        this.bindChild(node, node.value, 1);
    }

    private bindChild(self: AnyNode, child: AnyNode, pos: number) {
        this.parentMap.set(child, self);
        this.positionMap.set(child, pos);
        this.bind(child);
    }

    private bindChildren(self: AnyNode, children: readonly AnyNode[]) {
        for (let i = 0; i < children.length; i++) {
            this.bindChild(self, children[i], i);
        }
    }
}