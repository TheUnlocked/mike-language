import { VariableDefinition } from '../ast/Ast';

export default class Scope {
    private bindings: Map<string, VariableDefinition>;
    
    constructor(private getParent: () => Scope | undefined, bindings?: Iterable<[string, VariableDefinition]>) {
        this.bindings = new Map(bindings);
    }

    get(name: string): VariableDefinition | undefined {
        return this.bindings.get(name) ?? this.getParent()?.get(name);
    }

    set(name: string, def: VariableDefinition) {
        return this.bindings.set(name, def);
    }
}