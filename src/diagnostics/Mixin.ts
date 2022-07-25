import { AnyNode, Range } from '../ast/Ast';
import { AnyType, stringifyType } from '../types/KnownType';
import { InterpolatedStringArgumentList } from '../utils/types';
import { defaultDiagnosticDetails, DiagnosticCodes } from './DiagnosticCodes';
import { DiagnosticsReporter } from './Diagnostics';

const DUMMY_REPORTER: DiagnosticsReporter = {
    focus: () => {},
    withFocus: (_, c) => c(),
    report: () => {},
};

export function WithDiagnostics<C extends abstract new (...args: any[]) => {}>(Base: C) {
    abstract class WithDiagnostics extends Base {
        protected diagnostics = DUMMY_REPORTER;

        constructor(...args: any[]) {
            super(...args);
        }

        setDiagnostics(diagnostics: DiagnosticsReporter) {
            this.diagnostics = diagnostics;
        }

        protected focus(node: AnyNode | Range | undefined) {
            return this.diagnostics.focus(node);
        }

        protected withFocus<R>(node: AnyNode | Range | undefined, callback: () => R): R {
            return this.diagnostics.withFocus(node, callback);
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
