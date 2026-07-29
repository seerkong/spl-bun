import { isSplNumber } from './scalar';
import { compareScalarValues, createTupleIndex, getTuple, setTuple, tupleEntries } from './tuple-index';

export interface SortProjection<T> {
    value(row: T): unknown;
    direction?: 1 | -1;
}
export interface SortOptions {
    descending?: boolean;
    nullsLast?: boolean;
    groupEqual?: boolean;
    locale?: unknown;
}
function scalarKind(value: unknown): string {
    if (value == null) return 'null';
    if (isSplNumber(value)) return 'number';
    if (value instanceof Date && !Number.isNaN(value.getTime())) return 'date';
    if (typeof value === 'string' || typeof value === 'boolean') return typeof value;
    throw new Error('sort keys must be numeric, text, boolean, Date or null');
}
function localeComparator(locale: unknown): Intl.Collator | undefined {
    if (locale == null || locale === '') return undefined;
    if (typeof locale !== 'string') throw new Error('sort locale must be text');
    const tag = locale.split('_').join('-');
    if (!Intl.Collator.supportedLocalesOf([tag]).length) throw new Error('Unsupported sort locale ' + locale);
    return new Intl.Collator(tag);
}
/** Project once in input order. Sorting/grouping is a new sequence and never
 * invokes expressions from the comparator or writes to the input authority. */
export function sortRows<T>(rows: readonly T[], projections: readonly SortProjection<T>[], options: SortOptions = {}): T[] {
    const collator = localeComparator(options.locale);
    for (const key of projections)
        if (key.direction !== undefined && key.direction !== 1 && key.direction !== -1)
            throw new Error('sort direction must be 1 or -1');
    let projected = rows.map((row, index) => ({ row, index, keys: projections.map(key => {
        const value = key.value(row);
        scalarKind(value);
        return value ?? null;
    }) }));
    if (options.groupEqual) {
        // Source sort_u successively groups each prefix. A direct full-tuple
        // grouping would move later parent groups ahead of earlier children.
        for (let length = 1; length <= projections.length; length++) {
            const groups = createTupleIndex<typeof projected>();
            for (const item of projected) {
                const key = item.keys.slice(0, length), group = getTuple(groups, key);
                if (group) group.push(item);
                else setTuple(groups, key, [item]);
            }
            projected = [...tupleEntries(groups)].flatMap(([, group]) => group);
        }
    } else {
        projected.sort((a, b) => {
            for (let i = 0; i < projections.length; i++) {
                const av = a.keys[i], bv = b.keys[i], direction = projections[i].direction ?? (options.descending ? -1 : 1);
                let result: number;
                if (av === null || bv === null) {
                    if (av === bv) continue;
                    result = av === null ? -1 : 1;
                    if (options.nullsLast) result = -result;
                    else result *= direction;
                } else {
                    if (scalarKind(av) !== scalarKind(bv)) throw new Error('sort cannot compare incompatible key types');
                    result = collator && typeof av === 'string' && typeof bv === 'string' ? collator.compare(av, bv) : compareScalarValues(av, bv);
                    result *= direction;
                }
                if (result) return result;
            }
            return a.index - b.index;
        });
    }
    return projected.map(item => item.row);
}
