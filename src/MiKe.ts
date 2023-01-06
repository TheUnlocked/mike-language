import { visit } from './ast';
import { ASTNodeKind, Comment, Program, TypeDefinition } from './ast/Ast';
import { TargetFactory } from './codegen/Target';
import { createMiKeDiagnosticsManager } from './diagnostics/DiagnosticCodes';
import { DiagnosticsManager, DiagnosticsReporter, Severity } from './diagnostics/Diagnostics';
import { LibraryImplementation, LibraryInterface } from './library/Library';
import stdlib from './library/stdlib';
import { Parser } from './parser/parser';
import { SymbolTable } from './semantics/SymbolTable';
import { Scope } from './semantics/Scope';
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
    private parser!: Parser;

    private _symbolTable!: SymbolTable;
    get symbolTable() { return this._symbolTable }
    private set symbolTable(value) { this._symbolTable = value; }

    private _typechecker!: Typechecker;
    get typechecker() { return this._typechecker }
    private set typechecker(value) { this._typechecker = value; }
    
    private _target!: TargetFactory;
    get target() { return this._target }
    private set target(value) { this._target = value; }

    private _root!: Program;
    get root() { return this._root }
    private set root(value) { this._root = value; }

    failSeverity = Severity.Warning;

    addLibrary(library: LibraryInterface) {
        this.libraries.push(library);
        if (this.symbolTable) {
            this.initSymbolTable();
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

        this.initSymbolTable();
        this.initialized = true;
    }

    private initSymbolTable() {
        const topLevelScope = new Scope(
            () => undefined,
            this.libraries
                .flatMap(lib => lib.values)
                .map(({ name, type }) => [name, { kind: ASTNodeKind.OutOfTree, name, type }])
        );
        this.symbolTable = new SymbolTable(topLevelScope);
        this.initTypechecker();
    }

    private initTypechecker() {
        this.typechecker = new Typechecker(this.libraries.flatMap(lib => lib.types), this.symbolTable);
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

    loadScript(script: string) {
        if (!this.initialized) {
            throw new Error('You must call Mike.init before loading a script.')
        }

        this.parser = new Parser();
        this.parser.setDiagnostics(this.diagnostics);
        this.parser.loadSource(script);
        this.reload();
    }

    editScript(pos: number, length: number, insert: string) {
        this.parser.editSource(pos, length, insert);
        this.reload();
    }

    private reload() {
        this.root = this.parser.parse();

        this.typechecker.notifyChange();
        this.typechecker.loadTypes(
            this.root.definitions.filter((x): x is TypeDefinition => x.kind === ASTNodeKind.TypeDefinition)
        );
    }

    getComments(): readonly Comment[] | undefined {
        if (this.root) {
            const comments: Comment[] = [];
            visit(this.root, node => {
                if (node.kind === ASTNodeKind.Comment) {
                    comments.push(node);
                    return true;
                }
            });
            return comments;
        }
    }

    private passedValidation() {
        return this.diagnosticsManager
            .getDiagnostics()
            .every(x => x.severity < this.failSeverity);
    }

    validate() {
        if (!this.root) {
            return false;
        }
        this.validator.validate(this.root);
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

    tryValidateAndEmit(): ArrayBuffer | undefined {
        if (!this.target) {
            throw new Error('No target set. Set a target with MiKe.setTarget before attempting to compile.');
        }
        if (!this.root) {
            return;
        }
        this.validator.validate(this.root);
        if (!this.passedValidation()) {
            return;
        }
        const impl = this.collectLibraries();
        return this.target.create(this.typechecker, impl).generate(this.root);
    }
}