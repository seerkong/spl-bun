import { aggregateValues, aggregateInput, type AggregateKind } from './aggregation';
import { assertKnownColumns, compileBoundExpression, tableRowScope } from './binding';
import { numericBinary, type SplNumber } from './scalar';
import { compareScalarValues, createTupleIndex, getTuple, setTuple, tupleEntries } from './tuple-index';
import type { TableInput, TableValue } from './table-transform';
export type SortDirection = 'asc' | 'desc';
export interface OrderBySpec {
    column: string;
    direction?: SortDirection;
}
export interface WindowMeasure {
    column: string;
    as?: string;
    expression?: string;
}
export interface WindowOffset {
    column?: string;
    expression?: string;
    as: string;
    offset?: number;
    defaultValue?: unknown;
}
export interface WindowFrame {
    column?: string;
    expression?: string;
    as: string;
    kind: AggregateKind;
    start: number | null;
    end: number | null;
}
export interface WindowOutputs {
    rowNumber?: string;
    rank?: string;
    denseRank?: string;
    runningSum?: WindowMeasure;
    runningAvg?: WindowMeasure;
    lag?: WindowOffset[];
    lead?: WindowOffset[];
    frames?: WindowFrame[];
}
export interface WindowSpec {
    partitionBy?: string[];
    orderBy: OrderBySpec[];
    outputs: WindowOutputs;
}
type Row = Record<string, unknown>;
const aggregateKinds = ['sum', 'count', 'icount', 'avg', 'min', 'max', 'median'];
function name(value: unknown): asserts value is string { if (typeof value !== 'string' || !value.length)
    throw new Error('Window output aliases/columns must be nonempty strings'); }
function integer(value: unknown, label: string): asserts value is number { if (typeof value !== 'number' || !Number.isSafeInteger(value))
    throw new Error(`Window ${label} must be a safe integer`); }
/** Partition-local relative rows are the target declaration for Move offsets.
 * Frame start/end are inclusive row offsets; null means that partition's edge.
 */
export function windowTable(table: TableInput, spec: WindowSpec, scope: Row = {}): TableValue {
    if (!spec || typeof spec !== 'object')
        throw new Error('Window requires a spec object');
    closed(spec, ['orderBy', 'partitionBy', 'outputs'], 'spec');
    if (!spec.orderBy?.length)
        throw new Error('Window operations require orderBy');
    if (!spec.outputs || !Object.keys(spec.outputs).length)
        throw new Error('Window outputs cannot be empty');
    for (const key of Object.keys(spec.outputs))
        if (!['rowNumber', 'rank', 'denseRank', 'runningSum', 'runningAvg', 'lag', 'lead', 'frames'].includes(key))
            throw new Error('Unsupported window output ' + key);
    const columns = table.schema.map(column => column.name), outputs = spec.outputs, partitionBy = spec.partitionBy ?? [];
    if (new Set(columns).size !== columns.length)
        throw new Error('Window input has duplicate columns');
    assertKnownColumns([...partitionBy, ...spec.orderBy.map(order => order.column)], columns);
    for (const order of spec.orderBy)
        if (order.direction !== undefined && !['asc', 'desc'].includes(order.direction))
            throw new Error('Invalid window sort direction');
    function mapper(measure: {
        column?: string;
        expression?: string;
    }, allowRow = false): (row: Row) => unknown {
        if (measure.expression !== undefined) {
            name(measure.expression);
            const expression = compileBoundExpression(measure.expression, columns, scope);
            return row => expression.evaluate(tableRowScope(columns, row, scope));
        }
        if (measure.column !== undefined) {
            name(measure.column);
            assertKnownColumns([measure.column], columns);
            return row => row[measure.column!];
        }
        if (allowRow)
            return row => row;
        throw new Error('Window measure requires column or expression');
    }
    const additions: {
        name: string;
        type: string;
    }[] = [];
    function add(alias: string, type = 'number'): string { name(alias); if (additions.some(column => column.name === alias))
        throw new Error('Duplicate window output column aliases'); additions.push({ name: alias, type }); return alias; }
    const ordinal = new Map<string, string>();
    for (const key of ['rowNumber', 'rank', 'denseRank'] as const)
        if (outputs[key] !== undefined)
            ordinal.set(key, add(outputs[key] || ({ rowNumber: 'row_number', rank: 'rank', denseRank: 'dense_rank' }[key])));
    const running = (['runningSum', 'runningAvg'] as const).flatMap(kind => {
        const measure = outputs[kind];
        if (!measure)
            return [];
        closed(measure, ['column', 'expression', 'as'], kind);
        if (measure.as === undefined)
            name(measure.column);
        const evaluate = mapper(measure), alias = add(measure.as || (kind === 'runningSum' ? 'running_sum_' : 'running_avg_') + measure.column);
        return [{ kind, alias, evaluate }];
    });
    const offsets = (['lag', 'lead'] as const).flatMap(kind => {
        if (outputs[kind] !== undefined && !Array.isArray(outputs[kind]))
            throw new Error(`Window ${kind} must be a list`);
        return (outputs[kind] ?? []).map(measure => {
            closed(measure, ['column', 'expression', 'as', 'offset', 'defaultValue'], kind);
            const offset = measure.offset ?? 1;
            integer(offset, 'offset');
            if (offset < 0)
                throw new Error('Window lag/lead offset must be nonnegative');
            const evaluate = mapper(measure), type = measure.expression ? 'unknown' : table.schema.find(column => column.name === measure.column)?.type ?? 'unknown';
            return { alias: add(measure.as, type), evaluate, offset: kind === 'lag' ? -offset : offset, fallback: measure.defaultValue ?? null };
        });
    });
    if (outputs.frames !== undefined && !Array.isArray(outputs.frames))
        throw new Error('Window frames must be a list');
    const frames = (outputs.frames ?? []).map(measure => {
        closed(measure, ['column', 'expression', 'as', 'kind', 'start', 'end'], 'frame');
        if (!aggregateKinds.includes(measure.kind))
            throw new Error('Unsupported window aggregate ' + measure.kind);
        if (measure.start !== null)
            integer(measure.start, 'frame start');
        if (measure.end !== null)
            integer(measure.end, 'frame end');
        const evaluate = mapper(measure, measure.kind === 'count');
        return { ...measure, alias: add(measure.as), evaluate };
    });
    const schema = table.schema.map(column => ({ ...column }));
    for (const column of additions) {
        const index = schema.findIndex(existing => existing.name === column.name);
        if (index >= 0)
            schema[index] = column;
        else
            schema.push(column);
    }
    const partitions = createTupleIndex<Row[]>();
    for (const row of table.rows) {
        const key = partitionBy.map(column => row[column]), rows = getTuple(partitions, key) ?? [];
        rows.push(row);
        setTuple(partitions, key, rows);
    }
    function compare(a: Row, b: Row): number { for (const order of spec.orderBy) {
        const result = compareScalarValues(a[order.column], b[order.column]);
        if (result)
            return result * (order.direction === 'desc' ? -1 : 1);
    } return 0; }
    const rows: Row[] = [];
    for (const [, partition] of tupleEntries(partitions)) {
        const sorted = [...partition].sort(compare), states = running.map(() => ({ sum: null as SplNumber | null, count: 0 }));
        let rank = 1, denseRank = 1;
        // Evaluate each referenced input once per partition; output aliases never feed
        // subsequent measures accidentally, even when they replace an input name.
        function memoizeInput(evaluate: (row: Row) => unknown) { const values = new Map<number, unknown>(); return (index: number) => { if (!values.has(index))
            values.set(index, evaluate(sorted[index])); return values.get(index); }; }
        const offsetValues = offsets.map(measure => memoizeInput(measure.evaluate)), frameValues = frames.map(measure => memoizeInput(measure.evaluate));
        const completeFrames = new Map<number, unknown>();
        for (let index = 0; index < sorted.length; index++) {
            const input = sorted[index], row = { ...input };
            if (index && compare(input, sorted[index - 1])) {
                rank = index + 1;
                denseRank++;
            }
            for (const [kind, alias] of ordinal)
                row[alias] = kind === 'rowNumber' ? index + 1 : kind === 'rank' ? rank : denseRank;
            running.forEach((measure, position) => {
                const value = aggregateInput(measure.evaluate(input)), state = states[position];
                if (value !== null) {
                    state.sum = state.sum === null ? value : numericBinary('add', state.sum, value);
                    state.count++;
                }
                row[measure.alias] = measure.kind === 'runningSum' || state.sum === null ? state.sum : numericBinary('divide', state.sum, state.count);
            });
            offsets.forEach((measure, position) => { const at = index + measure.offset; row[measure.alias] = at < 0 || at >= sorted.length ? measure.fallback : offsetValues[position](at); });
            frames.forEach((measure, position) => {
                if (completeFrames.has(position)) {
                    row[measure.alias] = completeFrames.get(position);
                    return;
                }
                const start = measure.start === null ? 0 : Math.max(0, index + measure.start), end = measure.end === null ? sorted.length - 1 : Math.min(sorted.length - 1, index + measure.end);
                const values: unknown[] = [];
                for (let at = start; at <= end; at++)
                    values.push(frameValues[position](at));
                row[measure.alias] = aggregateValues(measure.kind, values);
                if (measure.start === null && measure.end === null)
                    completeFrames.set(position, row[measure.alias]);
            });
            rows.push(row);
        }
    }
    return { schema, rows };
}
function closed(value: unknown, allowed: string[], label: string): void {
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("Invalid window " + label);
    for (const key of Object.keys(value))
        if (!allowed.includes(key))
            throw new Error("Unsupported window " + label + " property " + key);
}
