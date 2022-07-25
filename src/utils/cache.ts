type Cache<K extends object, V>
    = Map<K, V>
    | WeakMap<K, V>
    ;

export function withCache<K extends object, R, C extends Cache<K, R>>(
    key: K,
    cache: C,
    callback: () => R,
) {
    const existing = cache.get(key);
    if (existing) {
        return existing;
    }
    const result = callback();
    cache.set(key, result);
    return result;
}