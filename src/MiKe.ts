import { AnyNode, ASTNodeKind, Comment, Position, Program, TypeDefinition } from './ast/Ast';
import { getNodeAt } from './ast/AstUtils';
import { TargetFactory } from './codegen/Target';
import { createMiKeDiagnosticsManager } from './diagnostics/DiagnosticCodes';
import { DiagnosticsManager, DiagnosticsReporter } from './diagnostics/Diagnostics';
import { parseMiKe } from './grammar/Parser';
import { LibraryImplementation, LibraryInterface } from './library/Library';
import stdlib from './library/stdlib';
import { Binder } from './semantics/Binder';
import Scope from './semantics/Scope';
import { Typechecker } from './semantics/Typechecker';
import Validator, { EventRegistration } from './semantics/Validator';
import { TypeAttributeKind } from './types/Attribute';
import { TypeKind } from './types/KnownType';

export default class MiKe {
    private validator!: Validator;
    private diagnosticsManager!: DiagnosticsManager;
    private diagnostics!: DiagnosticsReporter;
    private initialized = false;
    private libraries: LibraryInterface[] = [stdlib];
    private libraryImplementations!: Partial<LibraryImplementation>[];
    private events: EventRegistration[] = [];
    private files = new Map<string, Program>();

    private _binder!: Binder;
    get binder() { return this._binder }
    private set binder(value) { this._binder = value; }

    private _typechecker!: Typechecker;
    get typechecker() { return this._typechecker }
    private set typechecker(value) { this._typechecker = value; }
    
    private _target!: TargetFactory;
    get target() { return this._target }
    private set target(value) { this._target = value; }

    addLibrary(library: LibraryInterface) {
        this.libraries.push(library);
        if (this.binder) {
            this.initBinder();
        }
    }

    addLibraryImplementation(impl: LibraryImplementation) {
        if (!this.target) {
            throw new Error('A target must be set before library implementations can be added to it.');
        }
        this.libraryImplementations.push(impl);
    }

    setTarget(target: TargetFactory) {
        this.target = target;
        this.libraryImplementations = [...target.defaultImplementations ?? []];
    }

    setDiagnosticsManager(diagnostics: DiagnosticsManager): void {
        this.diagnosticsManager = diagnostics;
        this.diagnostics = diagnostics.getReporter('mike');
        if (this.initialized) {
            this.typechecker.setDiagnostics(this.diagnostics);
        }
    }

    setEvents(events: EventRegistration[]) {
        this.events = events;
        if (this.initialized) {
            this.initValidator();
        }
    }

    init() {
        if (!this.diagnosticsManager) {
            this.setDiagnosticsManager(createMiKeDiagnosticsManager());
        }

        this.initBinder();
        this.initialized = true;
    }

    private initBinder() {
        const topLevelScope = new Scope(
            () => undefined,
            this.libraries
                .flatMap(lib => lib.values)
                .map(({ name, type }) => [name, { kind: ASTNodeKind.OutOfTree, name, type }])
        );
        this.binder = new Binder(topLevelScope);
        this.initTypechecker();
    }

    private initTypechecker() {
        this.typechecker = new Typechecker(this.libraries.flatMap(lib => lib.types), this.binder);
        this.typechecker.setDiagnostics(this.diagnostics);
        this.initValidator();
    }

    private initValidator() {
        this.validator = new Validator(this.typechecker, {
            events: this.events,
            isLegalParameterType: t => t.kind === TypeKind.Toxic || Boolean(
                t.kind === TypeKind.Simple &&
                this.typechecker.fetchTypeInfoFromSimpleType(t)?.attributes
                    .some(x => x.kind === TypeAttributeKind.IsLegalParameter)
            ),
        });
        this.validator.setDiagnostics(this.diagnostics);
    }

    loadScript(filename: string, script: string) {
        if (!this.initialized) {
            throw new Error('You must call Mike.init before loading a script.')
        }
        const ast = parseMiKe(script, this.diagnostics);
        this.binder.bind(ast);

        this.typechecker.notifyChange();
        this.typechecker.loadTypes(
            ast.definitions.filter((x): x is TypeDefinition => x.kind === ASTNodeKind.TypeDefinition)
        );
        
        this.files.set(filename, ast);
    }

    getRootNames() {
        return [...this.files.keys()];
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

    private passedValidation() {
        return this.diagnosticsManager.getDiagnostics().length === 0;
    }

    validate(filename: string) {
        const ast = this.files.get(filename);
        if (!ast) {
            return false;
        }
        this.validator.validate(ast);
        return this.passedValidation();
    }

    private collectLibraries(): LibraryImplementation {
        const typeNeedsImpl = new Set(this.libraries.flatMap(lib => lib.types).map(x => x.name));
        const valueNeedsImpl = new Set(this.libraries.flatMap(lib => lib.values).map(x => x.name));

        const megaImpl = {
            types: Object.fromEntries(
                this.libraryImplementations.flatMap(impl => impl.types ? Object.entries(impl.types) : [])
            ),
            values: Object.fromEntries(
                this.libraryImplementations.flatMap(impl => impl.values ? Object.entries(impl.values) : [])
            ),
        } as LibraryImplementation;

        for (const type of Object.keys(megaImpl.types)) {
            typeNeedsImpl.delete(type);
        }
        for (const value of Object.keys(megaImpl.values)) {
            valueNeedsImpl.delete(value);
        }

        if (typeNeedsImpl.size > 0 || valueNeedsImpl.size > 0) {
            throw new Error(`Library not fully implemented. ${[
                ...typeNeedsImpl.size > 0 ? [`Missing types: ${[...typeNeedsImpl].join(', ')}.`] : [],
                ...valueNeedsImpl.size > 0 ? [`Missing values: ${[...valueNeedsImpl].join(', ')}.`] : [],
            ].join(' ')}`);
        }

        return megaImpl;
    }

    tryValidateAndEmit(filename: string): ArrayBuffer | undefined {
        if (!this.target) {
            throw new Error('No target set. Set a target with MiKe.setTarget before attempting to compile.');
        }
        const ast = this.files.get(filename);
        if (!ast) {
            return;
        }
        this.validator.validate(ast);
        if (!this.passedValidation()) {
            return;
        }
        const impl = this.collectLibraries();
        return this.target.create(this.typechecker, impl).generate(this.files.get(filename)!);
    }
}