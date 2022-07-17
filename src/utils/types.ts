export function suggestType<T>() {
    return <U extends T>(arg: U): U => arg;
}

export type InterpolatedStringArgumentList<T, S extends string> 
    = string extends S
        ? T[]
        : _InterpolatedStringArgumentList<T, S, []>;

type _InterpolatedStringArgumentList<T, S extends string, R extends T[]>
    = S extends `${string}{${number}}${infer Rest extends string}`
        ? _InterpolatedStringArgumentList<T, Rest, [T, ...R]>
        : R

/**
 * Represents a list of T of length N
 * From https://github.com/microsoft/TypeScript/pull/40002
 */
export type TupleOf<T, N extends number>
    = N extends N
        ? number extends N
            ? T[] // any length
            : _TupleOf<T, N, []> // fixed length
        : never;

export type ReadonlyTupleOf<T, N extends number>
    = N extends N
        ? number extends N
            ? readonly T[] // any length
            : Readonly<_TupleOf<T, N, []>> // fixed length
        : never;

type _TupleOf<T, N extends number, R extends unknown[]> =
    // if R.length === N
    R['length'] extends N
        // then R
        ? R
        // else try again w/ [T, ...R]
        : _TupleOf<T, N, [T, ...R]>;
