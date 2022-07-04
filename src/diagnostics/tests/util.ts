import { defaultDiagnosticDetails } from '../DiagnosticCodes';
import { Diagnostics } from '../Diagnostics';

export function makeDiagnostics() {
    const diagnostics = new Diagnostics();
    Object.entries(defaultDiagnosticDetails).map(([idStr, { severity, description, specializedMessages }]) => {
        diagnostics.registerDiagnostic('mike', +idStr, severity, description);
        for (const details of specializedMessages ?? []) {
            diagnostics.registerDiagnosticMessage('mike', +idStr, details.when, details.message);
        }
    });
    return diagnostics;
}