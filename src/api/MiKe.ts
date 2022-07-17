import { AnyNode, ASTNodeKind, Comment, ExternalVariableDefinition, Position, Program } from '../ast/Ast';
import { AstUtils } from '../ast/AstUtils';
import { createMiKeDiagnosticsManager } from '../diagnostics/DiagnosticCodes';
import { DiagnosticsManager, DiagnosticsReporter } from '../diagnostics/Diagnostics';
import { parseMiKe } from '../grammar/Parser';
import { Binder } from '../semantics/Binder';
import Scope from '../semantics/Scope';
import { Typechecker } from '../semantics/Typechecker';
import { stdlibTypes } from '../stdlib/types';
import { KnownType } from '../types/KnownType';
import { TypeInfo } from '../types/Type';

export default class MiKe {
    binder!: Binder;
    typechecker!: Typechecker;
    private initialized = false;
    private astUtils!: AstUtils;
    private builtinVariables = {} as { readonly [name: string]: KnownType };
    private builtinTypes = stdlibTypes;
    private files = new Map<string, Program>();
    private diagnosticsManager!: DiagnosticsManager;
    private diagnostics!: DiagnosticsReporter;

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

    setDiagnosticsManager(diagnostics: DiagnosticsManager): void {
        this.diagnosticsManager = diagnostics;
        this.diagnostics = diagnostics.getReporter('mike');
        if (this.initialized) {
            this.astUtils.setDiagnostics(this.diagnostics);
            this.typechecker.setDiagnostics(this.diagnostics);
        }
    }

    init() {
        if (!this.diagnosticsManager) {
            this.setDiagnosticsManager(createMiKeDiagnosticsManager());
        }

        this.astUtils = new AstUtils();
        this.astUtils.setDiagnostics(this.diagnostics);

        this.initBinder();
    }

    private initBinder() {
        const topLevelScope = new Scope(
            () => undefined,
            Object.entries(this.builtinVariables)
                .map(([name, type]) => [name, { kind: ASTNodeKind.OutOfTree, type } as ExternalVariableDefinition])
        );
        this.binder = new Binder(topLevelScope);
        this.initTypechecker();
    }

    private initTypechecker() {
        this.typechecker = new Typechecker(this.binder);
        this.typechecker.setDiagnostics(this.diagnostics);
        this.typechecker.addType(...this.builtinTypes);
    }

    loadScript(filename: string, script: string) {
        const ast = parseMiKe(script, this.diagnostics);
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