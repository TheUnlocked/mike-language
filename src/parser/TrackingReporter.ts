import { AnyNode, Range } from "../ast";
import { DiagnosticsReporter } from "../diagnostics";

export interface ReportInfo {
    readonly reportArgs: [number, ...string[]];
    readonly range: Range | undefined;
}

export class TrackingReporter implements DiagnosticsReporter {

    constructor(private _baseReporter: DiagnosticsReporter) {

    }

    get baseReporter() {
        return this._baseReporter;
    }

    private _reports = [] as ReportInfo[];

    setBaseReporter(baseReporter: DiagnosticsReporter) {
        this._baseReporter = baseReporter;
    }

    clearReports() {
        this._reports = [];
    }

    get reports(): readonly ReportInfo[] {
        return this._reports;
    }

    report(id: number, ...args: string[]): Range | undefined {
        const range = this._baseReporter.report(id, ...args);
        this._reports.push({ reportArgs: [id, ...args], range: range });
        return range;
    }

    focus(node: AnyNode | Range | undefined) {
        this.baseReporter.focus(node);
    }

}