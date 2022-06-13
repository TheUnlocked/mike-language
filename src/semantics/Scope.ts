import { exactType } from '../types/Types.gen';

export default class Scope {
    private bindings: Map<string, exactType>;
    
    constructor(private parent?: Scope, bindings?: Iterable<[string, exactType]>) {
        this.bindings = new Map(bindings);
    }

    get(name: string): exactType | undefined {
        return this.bindings.get(name) ?? this.parent?.get(name);
    }

    has(name: string): boolean {
        return this.bindings.has(name) || (this.parent?.has(name) ?? false);
    }

    set(name: string, type: exactType) {
        return this.bindings.set(name, type);
    }
}