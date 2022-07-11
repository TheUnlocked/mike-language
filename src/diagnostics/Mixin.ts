import { defaultDiagnosticDetails } from './DiagnosticCodes';
import { Diagnostics, DiagnosticsReporter } from './Diagnostics';

export function WithDiagnostics<C extends abstract new (...args: any[]) => {}>(Base: C) {
    abstract class WithDiagnostics extends Base {
        private _diagnostics = new Diagnostics();
        private _reporter = this._diagnostics.getReporter('mike');

        constructor(...args: any[]) {
            super(...args);
            Object.entries(defaultDiagnosticDetails).map(([idStr, { severity, description, specializedMessages }]) => {
                this._diagnostics.registerDiagnostic('mike', +idStr, severity, description);
                for (const details of specializedMessages ?? []) {
                    this._diagnostics.registerDiagnosticMessage('mike', +idStr, details.when, details.message);
                }
            });
        }

        get diagnostics(): DiagnosticsReporter {
            return this._reporter;
        }

        get diagnosticsManager(): Diagnostics {
            return this._diagnostics;
        }

        setDiagnostics(diagnostics: Diagnostics) {
            this._diagnostics = diagnostics;
            this._reporter = diagnostics.getReporter('mike');
        }
    };
    return WithDiagnostics;
}
