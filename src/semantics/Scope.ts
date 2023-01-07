import { VariableDefinition } from '../ast/Ast';

export class Scope {
    private bindings: Map<string, VariableDefinition>;
    private _duplicateBindings = [] as VariableDefinition[];
    
    constructor(private readonly getParent: () => Scope | undefined, bindings?: Iterable<readonly [string, VariableDefinition]>) {
        this.bindings = new Map(bindings);
    }

    get(name: string): VariableDefinition | undefined {
        return this.bindings.get(name) ?? this.getParent()?.get(name);
    }

    set(name: string, def: VariableDefinition) {
        const original = this.bindings.get(name);
        if (original) {
            this._duplicateBindings.push(def);
        }
        else {   
            return this.bindings.set(name, def);
        }
    }

    get duplicateBindings() {
        return this._duplicateBindings;
    }

    get ownNames() {
        return [...this.bindings.keys()];
    }

    get names() {
        return [...this.getAllNamesIter()];
    }

    private *getAllNamesIter(): Iterable<string> {
        yield* this.bindings.keys();
        const parent = this.getParent();
        if (parent) {
            yield* parent.getAllNamesIter();
        }
    }
}