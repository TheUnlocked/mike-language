import { AnyNode, Range, getNodeSourceRange } from "../ast";
import { BasicDiagnosticsReporter, DiagnosticsMixin, DiagnosticsReporter } from "../diagnostics";

export class TrackingReportInfo {
    constructor(public reportArgs: [number, ...string[]], private target: AnyNode | Range | { range: Range }) {

    }

    get range() {
        if ('kind' in this.target) {
            return getNodeSourceRange(this.target);
        }
        else if ('range' in this.target) {
            return this.target.range;
        }
        return this.target;
    }
}

class TrackingReporter implements DiagnosticsReporter {

    private _reports = [] as TrackingReportInfo[];
    private target!: AnyNode | Range | { range: Range };

    constructor(private _baseReporter: DiagnosticsReporter) {

    }

    get baseReporter() {
        return this._baseReporter;
    }

    setBaseReporter(baseReporter: DiagnosticsReporter) {
        this._baseReporter = baseReporter;
    }

    clearReports() {
        this._reports = [];
    }

    get reports(): readonly TrackingReportInfo[] {
        return this._reports;
    }

    report(id: number, ...args: string[]) {
        const range = this._baseReporter.report(id, ...args);
        this._reports.push(new TrackingReportInfo([id, ...args], this.target));
        return range;
    }

    focus(node: AnyNode | Range | { range: Range }) {
        this.baseReporter.focus('range' in node ? node.range : node);
        this.target = node;
    }

}

export abstract class TrackedDiagnosticsMixin extends DiagnosticsMixin {

    private _diagnostics = new TrackingReporter(this.diagnostics);

    override setDiagnostics(diagnostics: DiagnosticsReporter): void {
        this._diagnostics.setBaseReporter(diagnostics);
        this.diagnostics = this._diagnostics;
    }

    protected override focus(node: Range | AnyNode | { range: Range }): void {
        this._diagnostics.focus(node);
    }

    protected get internalDiagnosticsReporter() {
        return this._diagnostics.baseReporter;
    }

    protected get diagnosticsReports() {
        return this._diagnostics.reports;
    }

    protected clearDiagnosticsReports() {
        this._diagnostics.clearReports();
    }

}
