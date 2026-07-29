import { createTupleIndex, getTuple, setTuple, compareScalarValues } from "./tuple-index";
export type SequenceOperation = "union" | "isect" | "diff" | "conj";
export function asSequence(value: unknown): unknown[] { return Array.isArray(value) ? value : value == null ? [] : [value]; }
/** Stable multiset operations, consuming one match at a time. The source's
 * small-isect membership shortcut is deliberately made consistent with its
 * merge/hash paths, which use minimum multiplicity.
 */
export function combineSequences(operation: SequenceOperation, left: unknown, right: unknown): unknown[] {
    const a = asSequence(left), b = asSequence(right);
    if (operation === "conj")
        return [...a, ...b];
    const counts = createTupleIndex<number>();
    const indexed = operation === "union" ? a : b;
    for (const value of indexed)
        setTuple(counts, [value], (getTuple(counts, [value]) ?? 0) + 1);
    const result = operation === "union" ? [...a] : [];
    for (const value of operation === "union" ? b : a) {
        const count = getTuple(counts, [value]) ?? 0;
        if (count)
            setTuple(counts, [value], count - 1);
        if (operation === "isect" ? count > 0 : count === 0)
            result.push(value);
    }
    return result;
}
export function foldSequences(operation: SequenceOperation, values: unknown[], merge = false): unknown[] {
    if (values.some(value => value != null && !Array.isArray(value)))
        throw new Error(`${operation}() expects a sequence of sequences`);
    if (!values.length)
        return [];
    if (merge)
        for (const value of values) {
            const rows = asSequence(value);
            for (let index = 1; index < rows.length; index++)
                if (compareScalarValues(rows[index - 1], rows[index]) > 0)
                    throw new Error(`${operation}@m requires ascending input sequences`);
        }
    return values.slice(1).reduce<unknown[]>((result, value) => merge ? mergeSequences(operation, result, asSequence(value)) : combineSequences(operation, result, value), [...asSequence(values[0])]);
}
function mergeSequences(operation: SequenceOperation, a: unknown[], b: unknown[]): unknown[] {
    const rows: unknown[] = [];
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
        const compare = compareScalarValues(a[i], b[j]);
        if (compare === 0) {
            if (operation !== "diff")
                rows.push(a[i]);
            i++;
            if (operation !== "conj")
                j++;
        }
        else if (compare < 0) {
            if (operation !== "isect")
                rows.push(a[i]);
            i++;
        }
        else {
            if (operation === "union" || operation === "conj")
                rows.push(b[j]);
            j++;
        }
    }
    if (operation !== "isect")
        for (; i < a.length; i++)
            rows.push(a[i]);
    if (operation === "union" || operation === "conj")
        for (; j < b.length; j++)
            rows.push(b[j]);
    return rows;
}
/** The source global union is distinct across multiple arguments; its single
 * sequence argument is returned as a sequence, preserving its duplicates.
 */
export function unionArguments(args: unknown[]): unknown[] {
    if (!args.length)
        throw new Error("union() requires an argument");
    if (args.length === 1)
        return [...asSequence(args[0])];
    const seen = createTupleIndex<boolean>(), result: unknown[] = [];
    for (const argument of args)
        for (const value of asSequence(argument))
            if (!getTuple(seen, [value])) {
                setTuple(seen, [value], true);
                result.push(value);
            }
    return result;
}
