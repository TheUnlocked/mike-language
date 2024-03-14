import { AnyNode } from '../ast/Ast';
import { getNodeSourceRange, Range, stringifyRange } from '../ast/AstUtils';

export enum Severity {
    Info = 1,
    Warning = 2,
    Error = 3,
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
        public readonly namespace: string,
        public readonly id: number,
        public readonly severity: Severity,
        public readonly range: Range,
        private readonly description: string,
        private readonly args: string[],
    ) {}

    get qualifiedId() {
        return this.namespace + this.id;
    }

    getDescription() {
        return this.description.replace(/{([0-9]+)}/g, (match, key) => this.args[+key] ?? match);
    }

    toString() {
        const severityString = {
            [Severity.Info]: 'INFO',
            [Severity.Warning]: 'WARNING',
            [Severity.Error]: 'ERROR',
        }[this.severity];
        return `${severityString} ${this.range ? stringifyRange(this.range) : '?'} ${this.getDescription()} (${this.qualifiedId})`
    }
}

export interface DiagnosticsReporter {
    report(id: number, ...args: string[]): void;
    focus(node: AnyNode | Range): void;
    // clear(range?: Range): void;
}

export class BasicDiagnosticsReporter implements DiagnosticsReporter {
    private currentRange: Range = { start: { line: 0, col: 0 }, end: { line: 0, col: 0 } };

    constructor(private onReport: (id: number, args: string[], range: Range) => void) {

    }

    focus(nodeOrRange: Range | AnyNode): void {
        if (nodeOrRange && 'kind' in nodeOrRange) {
            this.currentRange = getNodeSourceRange(nodeOrRange);
        }
        else {
            this.currentRange = nodeOrRange;
        }
    }

    report(id: number, ...args: string[]): Range {
        this.onReport(id, args, this.currentRange);
        return this.currentRange;
    }
}

export class DiagnosticsManager {
    private diagnosticTypes = new Map<string, MutableDiagnosticInfo>();

    private diagnostics = [] as Diagnostic[];

    /**
     * A new diagnostics manager does not come with pre-defined diagnostics codes.
     * To get these, use `createMiKeDiagnosticsManager` instead.
     */
    constructor() {

    }

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

    private report(namespace: string, id: number, args: string[], range: Range): Diagnostic {
        const info = this.diagnosticTypes.get(this.getQualifiedId(namespace, id));

        let diagnostic: Diagnostic;
        if (!info) {
            diagnostic = new Diagnostic(
                namespace,
                id,
                Severity.Error,
                range,
                'Unknown Diagnostic',
                args,
            );
        }
        else {
            const specialMessage = info.specializedMessages?.find(x => x.when(...args));
            if (specialMessage) {
                diagnostic = new Diagnostic(
                    namespace,
                    id,
                    info.severity,
                    range,
                    specialMessage.message,
                    args,
                );
            }
            else {
                diagnostic = new Diagnostic(
                    namespace,
                    id,
                    info.severity,
                    range,
                    info.description,
                    args,
                );
            }
        }

        this.diagnostics.push(diagnostic);
        return diagnostic;
    }

    getReporter(namespace: string): DiagnosticsReporter {
        return new BasicDiagnosticsReporter((id, args, range) => this.report(namespace, id, args, range));
    }

    clear() {
        this.diagnostics = [];
    }

    private getQualifiedId(namespace: string, id: number) {
        return `${namespace}${id}`;
    }

    getDiagnostics() {
        return this.diagnostics as readonly Diagnostic[];
    }
}
