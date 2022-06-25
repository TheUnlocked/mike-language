import { ExactType } from '../types/TypeReference';

export default class Scope {
    private bindings: Map<string, ExactType>;
    
    constructor(private parent?: Scope, bindings?: Iterable<[string, ExactType]>) {
        this.bindings = new Map(bindings);
    }

    get(name: string): ExactType | undefined {
        return this.bindings.get(name) ?? this.parent?.get(name);
    }

    has(name: string): boolean {
        return this.bindings.has(name) || (this.parent?.has(name) ?? false);
    }

    set(name: string, type: ExactType) {
        return this.bindings.set(name, type);
    }
}