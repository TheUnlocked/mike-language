import { AnyNode, ASTNodeKind, Comment, ExternalVariableDefinition, Position, Program, TypeDefinition } from '../ast/Ast';
import { getNodeAt } from '../ast/AstUtils';
import Target from '../codegen/Target';
import { createMiKeDiagnosticsManager } from '../diagnostics/DiagnosticCodes';
import { DiagnosticsManager, DiagnosticsReporter } from '../diagnostics/Diagnostics';
import { parseMiKe } from '../grammar/Parser';
import { Binder } from '../semantics/Binder';
import Scope from '../semantics/Scope';
import { Typechecker } from '../semantics/Typechecker';
import Validator from '../semantics/Validator';
import { stdlibTypes } from '../stdlib/types';
import { stdlibValues } from '../stdlib/values';
import { TypeAttributeKind } from '../types/Attribute';
import { KnownType, TypeKind } from '../types/KnownType';
import { TypeInfo } from '../types/TypeInfo';

export default class MiKe {
    private validator!: Validator;
    private diagnosticsManager!: DiagnosticsManager;
    private diagnostics!: DiagnosticsReporter;
    private initialized = false;
    private builtinVariables = {} as { readonly [name: string]: KnownType };
    private builtinTypes = stdlibTypes;
    private files = new Map<string, Program>();

    private _binder!: Binder;
    get binder() { return this._binder }
    private set binder(value) { this._binder = value; }

    private _typechecker!: Typechecker;
    get typechecker() { return this._typechecker }
    private set typechecker(value) { this._typechecker = value; }
    
    private _codegen!: Target;
    get codegen() { return this._codegen }
    private set codegen(value) { this._codegen = value; }

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
            this.typechecker.setDiagnostics(this.diagnostics);
        }
    }

    init() {
        if (!this.diagnosticsManager) {
            this.setDiagnosticsManager(createMiKeDiagnosticsManager());
        }

        this.initBinder();
    }

    private initBinder() {
        const topLevelScope = new Scope(
            () => undefined,
            Object.entries(this.builtinVariables)
                .concat(Object.entries(stdlibValues))
                .map(([name, type]) => [name, { kind: ASTNodeKind.OutOfTree, type } as ExternalVariableDefinition])
        );
        this.binder = new Binder(topLevelScope);
        this.initTypechecker();
    }

    private initTypechecker() {
        this.typechecker = new Typechecker(this.builtinTypes, this.binder);
        this.typechecker.setDiagnostics(this.diagnostics);
        this.validator = new Validator(this.binder, this.typechecker, {
            isLegalParameterType: t => Boolean(
                t.kind === TypeKind.Simple &&
                this.typechecker.fetchTypeInfoFromSimpleType(t)?.attributes
                    .some(x => x.kind === TypeAttributeKind.IsLegalParameter)
            ),
        });
        this.validator.setDiagnostics(this.diagnostics);
    }

    loadScript(filename: string, script: string) {
        const ast = parseMiKe(script, this.diagnostics);
        this.binder.bind(ast);

        this.typechecker.notifyChange();
        this.typechecker.loadTypes(
            ast.definitions.filter((x): x is TypeDefinition => x.kind === ASTNodeKind.TypeDefinition)
        );
        
        this.files.set(filename, ast);
    }

    getRoot(filename: string) {
        return this.files.get(filename);
    }

    getNodeAt(filename: string, position: Position): AnyNode | undefined {
        const ast = this.files.get(filename);
        if (ast) {
            return getNodeAt(ast, position);
        }
    }

    getComments(filename: string): readonly Comment[] | undefined {
        return this.files.get(filename)?.comments;
    }

    validate(filename: string) {
        const ast = this.files.get(filename);
        if (!ast) {
            return false;
        }
        return this.validator.validate(ast);
    }
}