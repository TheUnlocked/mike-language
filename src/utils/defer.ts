export function withDefer<T>(callback: (defer: (deferredCallback: () => void) => void) => T): T {
    const deferredCallbacks = [] as (() => void)[];
    const result = callback(f => deferredCallbacks.push(f));
    deferredCallbacks.forEach(f => f());
    return result;
}