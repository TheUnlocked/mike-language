import { AnyNode, ASTNodeKind, Comment, LetStatement, Position, Program } from '../ast/Ast';
import { AstUtils } from '../ast/AstUtils';
import { Diagnostics } from '../diagnostics/Diagnostics';
import { WithDiagnostics } from '../diagnostics/Mixin';
import { Binder } from '../semantics/Binder';
import Scope from '../semantics/Scope';
import { Typechecker } from '../semantics/Typechecker';
import { stdlibTypes } from '../stdlib/types';
import { KnownType } from '../types/KnownType';
import { TypeInfo } from '../types/Type';

export default class MiKe extends WithDiagnostics(class {}) {
    binder!: Binder;
    typechecker!: Typechecker;
    private astUtils!: AstUtils;
    private builtinVariables = {} as { readonly [name: string]: KnownType };
    private builtinTypes = stdlibTypes;
    private files = new Map<string, Program>();

    setBuiltinVariables(builtins: { readonly [name: string]: KnownType }) {
        this.builtinVariables = builtins;
        if (this.binder) {
            this.initBinder();
        }
    }

    setBuiltinTypes(builtins: readonly TypeInfo[]) {
        this.builtinTypes = builtins;
        if (this.typechecker) {
            this.initTypechecker();
        }
    }

    override setDiagnostics(diagnostics: Diagnostics): void {
        super.setDiagnostics(diagnostics);
        this.astUtils.setDiagnostics(diagnostics);
        this.typechecker.setDiagnostics(diagnostics);
    }

    init() {
        this.astUtils = new AstUtils();
        this.astUtils.setDiagnostics(this.diagnosticsManager);

        this.initBinder();
    }

    private initBinder() {
        const topLevelScope = new Scope(
            () => undefined,
            Object.entries(this.builtinVariables)
                .map(([name, type]) => [name, { kind: ASTNodeKind.LetStatement, name, type } as LetStatement])
        );
        this.binder = new Binder(topLevelScope);
        this.initTypechecker();
    }

    private initTypechecker() {
        this.typechecker = new Typechecker(this.binder);
        this.typechecker.setDiagnostics(this.diagnosticsManager);
        this.typechecker.addType(...this.builtinTypes);
    }

    loadScript(filename: string, script: string) {
        const ast = this.astUtils.parse(script);
        this.binder.bind(ast);
        this.files.set(filename, ast);
    }

    getNodeAt(filename: string, position: Position): AnyNode | undefined {
        const ast = this.files.get(filename);
        if (ast) {
            return this.astUtils.getNodeAt(ast, position);
        }
    }

    getComments(filename: string): readonly Comment[] | undefined {
        return this.files.get(filename)?.comments;
    }
}