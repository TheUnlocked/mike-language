export function hasFlag<T extends number>(bits: T, flag: T) {
    return bits & flag;
}
