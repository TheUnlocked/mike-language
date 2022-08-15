export function some(v?: any) {
    if (arguments.length === 0) {
        return { hasValue: false, value: undefined };
    }
    return { hasValue: true, value: v };
}

export const none = { hasValue: false, value: undefined };