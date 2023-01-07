import { Range } from '../ast';
import { AnyNode } from '../ast/Ast';
import { Token } from '../parser/lexer';
import { AnyType, stringifyType } from '../types/KnownType';
import { mix } from '../utils/mixin';
import { Constructor, InterpolatedStringArgumentList } from '../utils/types';
import { defaultDiagnosticDetails, DiagnosticCodes } from './DiagnosticCodes';
import { DiagnosticsReporter } from './Diagnostics';

const DUMMY_REPORTER: DiagnosticsReporter = {
    focus: () => {},
    report: () => {},
    // clear: () => {},
};

export class DiagnosticsMixin {
    protected diagnostics = DUMMY_REPORTER;

    setDiagnostics(diagnostics: DiagnosticsReporter) {
        this.diagnostics = diagnostics;
    }

    protected focus(node: AnyNode | Range | { range: Range } | undefined) {
        if (node && 'range' in node) {
            this.diagnostics.focus(node.range);
        }
        else {
            this.diagnostics.focus(node);
        }
    }

    protected error<D extends DiagnosticCodes>(code: D, ...args: InterpolatedStringArgumentList<string | number | Token | AnyType, DiagnosticDescription<D>>): void {
        this.diagnostics.report(code, ...args.map(x => {
            if (typeof x === 'object') {
                if ('_type' in x) {
                    return stringifyType(x);
                }
                if ('_token' in x) {
                    return x.content;
                }
                return '[[COMPILER_BUG]]';
            }
            else {
                return x.toString();
            }
        }));
    }
}

export function WithDiagnostics<C extends Constructor>(Base: C): { new(...a: any[]): DiagnosticsMixin } & C {
    abstract class WithDiagnostics extends Base {
        protected diagnostics = DUMMY_REPORTER;
    }
    mix(WithDiagnostics, DiagnosticsMixin);
    return WithDiagnostics as any;
}

type DiagnosticDescription<D extends DiagnosticCodes>
    = typeof defaultDiagnosticDetails[D] extends { specializedMessages: readonly { readonly message: string }[] }
        ? typeof defaultDiagnosticDetails[D]['description'] | typeof defaultDiagnosticDetails[D]['specializedMessages'][number]['message']
        : typeof defaultDiagnosticDetails[D]['description']
        ;
