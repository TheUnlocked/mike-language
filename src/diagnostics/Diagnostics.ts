import { AnyNode, Range } from '../ast/Ast';

export enum Severity {
    Info,
    Warning,
    Error,
}

export interface DiagnosticInfo {
    readonly description: string;
    readonly severity: Severity;
    readonly specializedMessages?: readonly { readonly when: (...args: string[]) => boolean, readonly message: string }[]
}

export interface MutableDiagnosticInfo {
    description: string;
    severity: Severity;
    specializedMessages?: { when: (...args: string[]) => boolean, message: string }[]
}

export class Diagnostic {
    constructor(
        public readonly id: string,
        public readonly severity: Severity,
        public readonly range: Range | undefined,
        private readonly description: string,
        private readonly args: string[],
    ) {}

    getDescription() {
        return this.description.replace(/{([0-9]+)}/, (match, key) => this.args[+key] ?? match);
    }

    toString() {
        return `${this.severity} ${this.id}: ${this.getDescription()}`
    }
}

export interface DiagnosticsReporter {
    report(id: number, ...args: string[]): void;
    focus(node: AnyNode | Range | undefined): void;
}

export class DiagnosticsManager {
    private currentRange?: Range;

    private diagnosticTypes = new Map<string, MutableDiagnosticInfo>();

    private diagnostics = [] as Diagnostic[];

    registerDiagnostic(namespace: string, id: number, severity: Severity, description: string) {
        if (!namespace.match(/^[a-z0-9]*$/)) {
            throw new Error(`Diagnostic namespaces can only include lowercase alphanumeric characters`);
        }
        if (id % 1 !== 0) {
            throw new Error(`Diagnostic IDs must be integers`);
        }

        const qualifiedId = this.getQualifiedId(namespace, id);
        if (this.diagnosticTypes.has(qualifiedId)) {
            throw new Error(`Diagnostic ${qualifiedId} has already been registered`);
        }
        this.diagnosticTypes.set(qualifiedId, { severity, description, specializedMessages: [] });
    }

    registerDiagnosticMessage(namespace: string, id: number, when: (...args: string[]) => boolean, message: string) {
        const qualifiedId = this.getQualifiedId(namespace, id);
        const diagnostic = this.diagnosticTypes.get(qualifiedId)
        if (!diagnostic) {
            throw new Error(`Cannot register a message for diagnostic ${qualifiedId} because it does not exist`);
        }
        diagnostic.specializedMessages ??= [];
        diagnostic.specializedMessages.push({ when, message });
    }

    private report(namespace: string, id: number, args: string[]) {
        const qualifiedId = this.getQualifiedId(namespace, id);
        const diagnostic = this.diagnosticTypes.get(qualifiedId);

        if (!diagnostic) {
            this.diagnostics.push(
                new Diagnostic(qualifiedId, Severity.Error, this.currentRange, 'Unknown Diagnostic', args)
            );
            return;
        }

        this.diagnostics.push(
            new Diagnostic(qualifiedId, diagnostic.severity, this.currentRange, diagnostic.description, args)
        );
    }

    getReporter(namespace: string): DiagnosticsReporter {
        return {
            report: (id, ...args) => {
                this.report(namespace, id, args);
            },
            focus: nodeOrRange => {
                if (nodeOrRange && 'kind' in nodeOrRange) {
                    this.currentRange = nodeOrRange.metadata.extent;
                }
                else {
                    this.currentRange = nodeOrRange;
                }
            },
        };
    }

    private getQualifiedId(namespace: string, id: number) {
        return `${namespace}${id}`;
    }

    getDiagnostics() {
        return this.diagnostics as readonly Diagnostic[];
    }
}
