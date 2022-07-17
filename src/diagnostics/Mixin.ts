import { AnyNode, Range } from '../ast/Ast';
import { AnyType, stringifyType } from '../types/KnownType';
import { InterpolatedStringArgumentList } from '../utils/types';
import { defaultDiagnosticDetails, DiagnosticCodes } from './DiagnosticCodes';
import { DiagnosticInfo, Diagnostics, DiagnosticsReporter } from './Diagnostics';

export function WithDiagnostics<C extends abstract new (...args: any[]) => {}>(Base: C) {
    abstract class WithDiagnostics extends Base {
        private _diagnostics = new Diagnostics();
        private _reporter = this._diagnostics.getReporter('mike');

        constructor(...args: any[]) {
            super(...args);
            
            Object.entries(defaultDiagnosticDetails as { [name: number]: DiagnosticInfo })
                .map(([idStr, { severity, description, specializedMessages }]) => {
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

        protected focus(node: AnyNode | Range | undefined) {
            return this.diagnostics.focus(node);
        }

        protected error<D extends DiagnosticCodes>(code: D, ...args: InterpolatedStringArgumentList<string | number | AnyType, DiagnosticDescription<D>>): void {
            this.diagnostics.report(code, ...args.map(x => {
                if (typeof x === 'object') {
                    return stringifyType(x);
                }
                else {
                    return x.toString();
                }
            }));
        }
    };
    return WithDiagnostics;
}

type DiagnosticDescription<D extends DiagnosticCodes>
    = typeof defaultDiagnosticDetails[D] extends { specializedMessages: readonly { readonly message: string }[] }
        ? typeof defaultDiagnosticDetails[D]['description'] | typeof defaultDiagnosticDetails[D]['specializedMessages'][number]['message']
        : typeof defaultDiagnosticDetails[D]['description']
        ;
