import { ParserRuleContext } from 'antlr4ts';
import { listenerDefNode, paramDefNode, programNode, stateDefNode, statementNode, _typedExprNode } from '../ast/Ast.gen';

type ASTNode
    = _typedExprNode<any>
    | statementNode
    | stateDefNode
    | paramDefNode
    | listenerDefNode
    | programNode
    ;

export interface IMetadataManager<T> {
    readonly root?: IMetadataNode<T>;

    push(metadata: T): void;
    pop(): void;
    withContext<R>(metadata: T, callback: () => R): R;

    makeReporter(): IMetadataReporter<T>;
    getMetadata(ast: ASTNode): T | undefined;
} 

export interface IMetadataReporter<T> {
    report(ast: ASTNode): void;
    clone(): IMetadataReporter<T>;
    getLastNode(): IMetadataNode<T> | undefined;
}

export type AnyMetadataReporter = IMetadataReporter<any>;

export interface IMetadataNode<T> {
    readonly metadata: T;

    readonly parent?: IMetadataNode<T>;
    readonly nextSibling?: IMetadataNode<T>;
    readonly children: IMetadataNode<T>[];
    
    addChild(node: IMetadataNode<T>): void;
}

export class MetadataManager implements IMetadataManager<ParserRuleContext> {
    root?: MetadataNode;

    private current?: MetadataNode;

    private mode: 'reporting' | 'gathering' = 'gathering';

    private astNodeAssociations = new Map<ASTNode, MetadataNode>();
    
    push(ctx: ParserRuleContext) {
        if (this.mode === 'reporting') {
            throw new Error('Cannot mutate metadata in reporting mode');
        }

        if (!this.root) {
            this.root = new MetadataNode(undefined, ctx);
            this.current = this.root;
        }
        else if (!this.current) {
            throw new Error('Cannot push state after the final context has been popped');
        }
        else {
            const node = new MetadataNode(this.current, ctx);
            this.current.addChild(node);
            this.current = node;
        }
    }

    pop() {
        if (this.mode === 'reporting') {
            throw new Error('Cannot mutate metadata in reporting mode');
        }
        if (!this.root) {
            throw new Error('Cannot pop before any context has been pushed');
        }
        if (!this.current) {
            throw new Error('Already popped out of the final context');
        }

        this.current = this.current?.parent;
    }

    withContext<R>(metadata: ParserRuleContext, callback: () => R): R {
        this.push(metadata);
        const result = callback(); 
        this.pop();
        return result;
    }

    makeReporter() {
        if (!this.root) {
            throw new Error('Cannot make a reporter before any parse tree nodes have been gathered');
        }
        if (this.current) {
            throw new Error('Cannot make a reporter before all parse tree nodes have been gathered');
        }
        this.mode = 'reporting';
        return new MetadataReporter(this);
    }

    putMetadata(ast: ASTNode, node: MetadataNode) {
        this.astNodeAssociations.set(ast, node);
    }

    getMetadata(ast: ASTNode) {
        return this.astNodeAssociations.get(ast)?.metadata;
    }
}

export class MetadataReporter implements IMetadataReporter<ParserRuleContext> {
    private currentNode?: MetadataNode;

    constructor(private manager: MetadataManager) {

    }

    report(ast: ASTNode) {
        let node: MetadataNode;
        if (this.currentNode) {
            node = this.currentNode;
            if (node.nextSibling) {
                node = node.nextSibling;
                while (node.children.length > 0) {
                    node = node.children[0];
                }
            }
            else {
                if (!node.parent) {
                    throw new Error('This reporter has finished reporting');
                }
                node = node.parent;
            }
        }
        else {
            node = this.manager.root!;
            while (node.children.length > 0) {
                node = node.children[0];
            }
        }

        this.manager.putMetadata(ast, node);
        this.currentNode = node;
    }

    clone() {
        const reporter = new MetadataReporter(this.manager);
        reporter.currentNode = this.currentNode;
        return reporter;
    }

    getLastNode() {
        return this.currentNode;
    }
}

export class MetadataNode implements IMetadataNode<ParserRuleContext> {
    children = [] as MetadataNode[];
    nextSibling?: MetadataNode;

    constructor(public parent: MetadataNode | undefined, public metadata: ParserRuleContext) {

    }

    addChild(node: MetadataNode) {
        if (this.children.length > 0) {
            this.children.at(-1)!.nextSibling = node;
        }
        this.children.push(node);
    }
}

export class DummyMetadataManager implements IMetadataManager<any> {
    root = undefined;

    push(metadata: any) {
        
    }
    pop() {
        
    }
    withContext<R>(metadata: any, callback: () => R): R {
        return callback();
    }
    makeReporter(): IMetadataReporter<any> {
        return new DummyMetadataReporter();
    }
    getMetadata(ast: ASTNode): any {
        
    }
}

export class DummyMetadataReporter implements IMetadataReporter<any> {
    report(ast: ASTNode) {
        
    }
    clone(): IMetadataReporter<any> {
        return new DummyMetadataReporter();
    }
    getLastNode(): IMetadataNode<any> | undefined {
        return undefined;
    }
}