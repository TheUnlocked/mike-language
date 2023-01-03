export class EditChain<T> {
    next?: EditChain<T>;
    
    private constructor(public edit?: T) {
        
    }

    static createEditChain<T>() {
        return new EditChain<T>();
    }

    push(edit: T): EditChain<T> {
        const newChain = new EditChain(edit);
        this.next = newChain;
        return newChain;
    }

    apply(applyEdit: (edit: T) => void): EditChain<T> {
        if (!this.next) {
            return this;
        }

        return this.next.apply(applyEdit);
    }
}