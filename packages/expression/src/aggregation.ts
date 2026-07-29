import { isSplNumber, isDecimal, numericBinary, numericCompare, type SplNumber } from "./scalar";
import { truthy } from "./utils";
import { createTupleIndex, getTuple, setTuple } from "./tuple-index";
export type AggregateKind = "sum" | "count" | "icount" | "avg" | "min" | "max" | "median";
/** Target numeric policy: null/missing/NaN are absent; other scalar values
 * use the existing SPL number conversion. Report functions own a stricter policy.
 */
export function numericValue(value: unknown): number | null {
    if (value == null || typeof value === "object" || typeof value === "function" || typeof value === "symbol")
        return null;
    const number = Number(value);
    return Number.isNaN(number) ? null : number;
}
export function numericValues(values: readonly unknown[]): number[] {
    return values.map(numericValue).filter((value): value is number => value !== null);
}
export function aggregateInput(value: unknown): SplNumber | null { return isSplNumber(value) ? typeof value === "number" && Number.isNaN(value) ? null : value : numericValue(value); }
export function aggregateValues(kind: AggregateKind, values: readonly unknown[]): SplNumber | null {
    if (kind === "count")
        return values.filter(truthy).length;
    if (kind === "icount") {
        const seen = createTupleIndex<boolean>();
        let count = 0;
        for (const value of values) {
            if (!truthy(value) || getTuple(seen, [value]))
                continue;
            setTuple(seen, [value], true);
            count++;
        }
        return count;
    }
    const numbers = values.map(aggregateInput).filter((value): value is SplNumber => value !== null);
    if (!numbers.length)
        return null;
    if (kind === "min")
        return numbers.reduce((a, b) => numericCompare(a, b) <= 0 ? a : b);
    if (kind === "max")
        return numbers.reduce((a, b) => numericCompare(a, b) >= 0 ? a : b);
    if (kind === "median") {
        numbers.sort(numericCompare);
        const middle = Math.floor(numbers.length / 2);
        return numbers.length % 2 ? numbers[middle] : numericBinary("divide", numericBinary("add", numbers[middle - 1], numbers[middle]), 2);
    }
    const sum = numbers.reduce((a, b) => numericBinary("add", a, b));
    return kind === "avg" ? numericBinary("divide", sum, numbers.length) : sum;
}
