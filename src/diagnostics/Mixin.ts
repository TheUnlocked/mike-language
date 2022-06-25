import { diagnosticsList } from './DiagnosticCodes';
import { Diagnostics, DiagnosticsReporter } from './Diagnostics';

export function WithDiagnostics<C extends new (...args: any[]) => {}>(namespace: string, Base: C) {
    return class extends Base {
        private _diagnostics = new Diagnostics();
        private _reporter = this._diagnostics.getReporter(namespace);

        constructor(...args: any[]) {
            super(...args);
            Object.entries(diagnosticsList).map(([idStr, { severity, description }]) => {
                this._diagnostics.registerDiagnostic('mike', +idStr, severity, description)
            })
        }

        get diagnostics(): DiagnosticsReporter {
            return this._reporter;
        }

        get diagnosticsManager(): Diagnostics {
            return this._diagnostics;
        }

        setDiagnostics(diagnostics: Diagnostics) {
            this._diagnostics = diagnostics;
            this._reporter = diagnostics.getReporter(namespace);
        }
    };
}
