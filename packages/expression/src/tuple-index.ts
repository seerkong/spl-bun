import { isSplNumber, numericCompare, numericKey } from "./scalar";
interface TupleEntry<T> {
    key: readonly unknown[];
    value: T;
}
interface TupleNode<T> {
    children: Map<unknown, TupleNode<T>>;
    entry?: TupleEntry<T>;
}
export interface TupleIndex<T> {
    root: TupleNode<T>;
    dates: Map<number, object>;
    numbers: Map<string, object>;
    order: TupleEntry<T>[];
}
/** Composite equality without serialization: primitive types stay distinct,
 * dates compare by epoch, and other objects retain reference identity.
 */
export function createTupleIndex<T>(): TupleIndex<T> {
    return { root: { children: new Map() }, dates: new Map(), numbers: new Map(), order: [] };
}
function findNode<T>(index: TupleIndex<T>, key: readonly unknown[], create: boolean): TupleNode<T> | undefined {
    let node = index.root;
    for (let value of key) {
        if (isSplNumber(value)) {
            const text = numericKey(value);
            let token = index.numbers.get(text);
            if (!token) {
                if (!create)
                    return undefined;
                token = {};
                index.numbers.set(text, token);
            }
            value = token;
        }
        if (value instanceof Date) {
            const time = value.getTime();
            let token = index.dates.get(time);
            if (!token) {
                if (!create)
                    return undefined;
                token = {};
                index.dates.set(time, token);
            }
            value = token;
        }
        let next = node.children.get(value);
        if (!next) {
            if (!create)
                return undefined;
            next = { children: new Map() };
            node.children.set(value, next);
        }
        node = next;
    }
    return node;
}
export function getTuple<T>(index: TupleIndex<T>, key: readonly unknown[]): T | undefined {
    return findNode(index, key, false)?.entry?.value;
}
export function setTuple<T>(index: TupleIndex<T>, key: readonly unknown[], value: T): void {
    const node = findNode(index, key, true)!;
    if (node.entry)
        node.entry.value = value;
    else {
        node.entry = { key: [...key], value };
        index.order.push(node.entry);
    }
}
export function* tupleEntries<T>(index: TupleIndex<T>): IterableIterator<readonly [
    readonly unknown[],
    T
]> {
    for (const entry of index.order)
        yield [entry.key, entry.value];
}
/** Stable scalar ordering shared by member sort, native sort and window rank. */
function scalarTag(value: unknown): number {
    if (value === undefined)
        return 0;
    if (value === null)
        return 1;
    switch (typeof value) {
        case "boolean": return 2;
        case "number": return 3;
        case "bigint": return 4;
        case "string": return 5;
        default: return value instanceof Date ? 6 : 7;
    }
}
export function compareScalarValues(a: unknown, b: unknown): number {
    if (isSplNumber(a) && isSplNumber(b))
        return numericCompare(a, b);
    if (a === b || Object.is(a, b))
        return 0;
    const at = scalarTag(a), bt = scalarTag(b);
    if (at === 7 || bt === 7)
        throw new Error("Ordering requires scalar or Date values");
    if (at !== bt)
        return at - bt;
    if (typeof a === "string" && typeof b === "string")
        return a > b ? 1 : -1;
    if (typeof a === "bigint" && typeof b === "bigint")
        return a > b ? 1 : -1;
    const av = a instanceof Date ? a.getTime() : Number(a), bv = b instanceof Date ? b.getTime() : Number(b);
    if (Object.is(av, bv))
        return 0;
    if (Number.isNaN(av))
        return 1;
    if (Number.isNaN(bv))
        return -1;
    return av > bv ? 1 : -1;
}
