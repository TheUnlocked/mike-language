import { ASTNodeKind, ExternalVariableDefinition } from '../ast/Ast';
import { KnownType } from '../types/KnownType';
import { TypeInfo } from '../types/TypeInfo';

export interface LibraryInterface {
    readonly types: readonly TypeInfo[];
    readonly values: readonly { name: string, type: KnownType }[];
}

export interface LibraryImplementation<Interface extends LibraryInterface = any, EmitValue = any, EmitTypeScaffold = any> {
    readonly types: { readonly [TypeName in Interface['types'][number]['name']]: {
        readonly scaffolding?: () => EmitTypeScaffold;
        readonly makeSequence?: (content: EmitValue) => EmitValue;
        readonly makeMap?: (content: EmitValue) => EmitValue;
        readonly conditionMethods?: {
            readonly condition: (content: EmitValue) => EmitValue;
            readonly destructure?: (content: EmitValue) => EmitValue;
        };
    } };
    readonly values: { readonly [valueName in Interface['values'][number]['name']]: {
        readonly emit: EmitValue;
    } };
}
