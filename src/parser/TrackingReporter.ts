import { AnyNode, Range, getNodeSourceRange } from "../ast";
import { DiagnosticsMixin, DiagnosticsReporter } from "../diagnostics";

export class TrackingReportInfo {
    constructor(public reportArgs: [number, ...string[]], private getRange: () => Range) {

    }

    get range() {
        return this.getRange();
    }
}

export class TrackingReporter implements DiagnosticsReporter {

    private _reports = [] as TrackingReportInfo[];
    private currentRangeGetter!: () => Range;

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
        this._reports.push(new TrackingReportInfo([id, ...args], this.currentRangeGetter));
        return range;
    }

    focus(getRange: () => Range) {
        this.baseReporter.focus(getRange);
        this.currentRangeGetter = getRange;
    }

}

export abstract class TrackedDiagnosticsMixin extends DiagnosticsMixin {

    constructor() {
        super();
        this.diagnostics = new TrackingReporter(this.diagnostics);
    }

    override setDiagnostics(diagnostics: DiagnosticsReporter): void {
        (this.diagnostics as TrackingReporter).setBaseReporter(diagnostics);
    }

    protected override focus(node: (() => Range) | { range: Range } | AnyNode): void {
        super.focus(node);
    }

    protected get internalDiagnosticsReporter() {
        return (this.diagnostics as TrackingReporter).baseReporter;
    }

    protected get diagnosticsReports() {
        return (this.diagnostics as TrackingReporter).reports;
    }

    protected clearDiagnosticsReports() {
        (this.diagnostics as TrackingReporter).clearReports();
    }

}
