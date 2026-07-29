import { aggregateValues, type AggregateKind } from "./aggregation";
import { assertKnownColumns, compileBoundExpression, tableRowScope } from "./binding";
import { createTupleIndex, getTuple, setTuple, tupleEntries, compareScalarValues } from "./tuple-index";
import { truthy } from "./utils";
export interface TableColumn {
    name: string;
    type: string;
}
export interface TableInput {
    schema: readonly TableColumn[];
    rows: readonly Record<string, unknown>[];
}
export interface TableValue {
    schema: TableColumn[];
    rows: Record<string, unknown>[];
}
export interface PivotSpec {
    keys?: string[];
    category: string;
    value: string;
    columns?: {
        value: unknown;
        as: string;
    }[];
    reducer?: AggregateKind | "first" | "last" | "error";
}
export interface UnpivotSpec {
    keys: string[];
    columns: string[];
    categoryAs?: string;
    valueAs?: string;
    includeNulls?: boolean;
}
export type TableJoinType = "inner" | "left" | "right" | "full" | "semi" | "anti";
export interface TableJoinSpec {
    type: TableJoinType;
    leftKeys: string[];
    rightKeys?: string[];
    rightPrefix?: string;
    leftKeyExprs?: string[];
    rightKeyExprs?: string[];
}
function names(table: TableInput): string[] { return table.schema.map(column => column.name); }
function unique(columns: readonly string[]): void {
    if (columns.some(name => typeof name !== "string" || !name.length) || new Set(columns).size !== columns.length)
        throw new Error("Table output column collision or invalid column name");
}
function selectSchema(table: TableInput, columns: readonly string[]): TableColumn[] {
    assertKnownColumns(columns, names(table));
    return columns.map(name => ({ ...table.schema.find(column => column.name === name)! }));
}
export function pivotTable(table: TableInput, spec: PivotSpec): TableValue {
    const keys = spec.keys ?? [];
    unique(keys);
    assertKnownColumns([...keys, spec.category, spec.value], names(table));
    const reducer = spec.reducer ?? "error";
    if (!["error", "first", "last", "sum", "count", "icount", "avg", "min", "max", "median"].includes(reducer))
        throw new Error(`Unsupported pivot reducer ${reducer}`);
    const categories = createTupleIndex<string>();
    const columns = spec.columns ? spec.columns.map(column => ({ ...column })) : [];
    if (!spec.columns)
        for (const row of table.rows) {
            const value = row[spec.category];
            if (getTuple(categories, [value]) !== undefined)
                continue;
            const alias = String(value);
            columns.push({ value, as: alias });
            setTuple(categories, [value], alias);
        }
    unique([...keys, ...columns.map(column => column.as)]);
    if (spec.columns)
        for (const column of columns) {
            if (getTuple(categories, [column.value]) !== undefined)
                throw new Error("Duplicate pivot category value");
            setTuple(categories, [column.value], column.as);
        }
    const groups = createTupleIndex<{
        row: Record<string, unknown>;
        cells: Map<string, unknown[]>;
    }>();
    for (const input of table.rows) {
        const key = keys.map(name => input[name]);
        let group = getTuple(groups, key);
        if (!group) {
            group = { row: Object.fromEntries([...keys.map(name => [name, input[name]]), ...columns.map(column => [column.as, null])]), cells: new Map() };
            setTuple(groups, key, group);
        }
        const alias = getTuple(categories, [input[spec.category]]);
        if (alias === undefined)
            throw new Error(`Pivot category has no declared output column: ${String(input[spec.category])}`);
        const values = group.cells.get(alias) ?? [];
        values.push(input[spec.value]);
        group.cells.set(alias, values);
    }
    const rows: Record<string, unknown>[] = [];
    for (const [, group] of tupleEntries(groups)) {
        for (const [alias, values] of group.cells) {
            if (reducer === "error" && values.length > 1)
                throw new Error(`Duplicate pivot cell ${alias}; choose an explicit reducer`);
            group.row[alias] = reducer === "error" || reducer === "first" ? values[0] : reducer === "last" ? values[values.length - 1] : aggregateValues(reducer, values);
        }
        rows.push(group.row);
    }
    return { schema: [...selectSchema(table, keys), ...columns.map(column => ({ name: column.as, type: reducer === "count" || reducer === "icount" ? "number" : table.schema.find(item => item.name === spec.value)!.type }))], rows };
}
export function unpivotTable(table: TableInput, spec: UnpivotSpec): TableValue {
    const category = spec.categoryAs ?? "category", value = spec.valueAs ?? "value";
    unique([...spec.keys, category, value]);
    unique(spec.columns);
    assertKnownColumns([...spec.keys, ...spec.columns], names(table));
    if (spec.columns.some(name => spec.keys.includes(name)))
        throw new Error("Unpivot keys and value columns must be disjoint");
    const rows = table.rows.flatMap(row => spec.columns.flatMap(column => {
        if (!spec.includeNulls && row[column] == null)
            return [];
        return [{ ...Object.fromEntries(spec.keys.map(name => [name, row[name]])), [category]: column, [value]: row[column] ?? null }];
    }));
    return { schema: [...selectSchema(table, spec.keys), { name: category, type: "string" }, { name: value, type: "unknown" }], rows };
}
export function joinTables(left: TableInput, right: TableInput, spec: TableJoinSpec): TableValue {
    if (!["inner", "left", "right", "full", "semi", "anti"].includes(spec.type))
        throw new Error(`Unsupported join type: ${spec.type}`);
    const rightKeys = spec.rightKeys ?? spec.leftKeys;
    if (!spec.leftKeys.length || spec.leftKeys.length !== rightKeys.length)
        throw new Error("Join key lengths must match and be nonempty");
    const compileKeys = (table: TableInput, keys: string[], expressions?: string[]) => {
        if (expressions?.length) {
            if (expressions.length !== keys.length)
                throw new Error("Join key expression lengths must match keys");
            const compiled = expressions.map(expression => compileBoundExpression(expression, names(table)));
            return (row: Record<string, unknown>) => compiled.map(expression => expression.evaluate(tableRowScope(names(table), row)));
        }
        assertKnownColumns(keys, names(table));
        return (row: Record<string, unknown>) => keys.map(key => row[key]);
    };
    const leftKey = compileKeys(left, spec.leftKeys, spec.leftKeyExprs), rightKey = compileKeys(right, rightKeys, spec.rightKeyExprs);
    const onlyLeft = spec.type === "semi" || spec.type === "anti", prefix = spec.rightPrefix ?? "right_";
    const leftNames = new Set(names(left));
    const rightNames = names(right).map(name => leftNames.has(name) ? prefix + name : name);
    const schema = onlyLeft ? left.schema.map(column => ({ ...column })) : [...left.schema.map(column => ({ ...column })), ...right.schema.map((column, index) => ({ ...column, name: rightNames[index] }))];
    unique(schema.map(column => column.name));
    const rows: Record<string, unknown>[] = [];
    const merge = (l?: Record<string, unknown>, r?: Record<string, unknown>) => Object.fromEntries([...left.schema.map(column => [column.name, l?.[column.name]]), ...right.schema.map((column, index) => [rightNames[index], r?.[column.name]])]);
    const driveRight = spec.type === "right";
    const indexed = driveRight ? left : right, indexKey = driveRight ? leftKey : rightKey;
    const index = createTupleIndex<number[]>();
    indexed.rows.forEach((row, position) => { const key = indexKey(row), matches = getTuple(index, key) ?? []; matches.push(position); setTuple(index, key, matches); });
    const matched = new Set<number>();
    const driving = driveRight ? right : left, drivingKey = driveRight ? rightKey : leftKey;
    for (const row of driving.rows) {
        const matches = getTuple(index, drivingKey(row)) ?? [];
        if (onlyLeft) {
            if ((spec.type === "semi") === (matches.length > 0))
                rows.push({ ...row });
            continue;
        }
        for (const position of matches) {
            matched.add(position);
            rows.push(driveRight ? merge(indexed.rows[position], row) : merge(row, indexed.rows[position]));
        }
        if (!matches.length && ["left", "right", "full"].includes(spec.type))
            rows.push(driveRight ? merge(undefined, row) : merge(row));
    }
    if (spec.type === "full")
        right.rows.forEach((row, position) => { if (!matched.has(position))
            rows.push(merge(undefined, row)); });
    return { schema, rows };
}
export function renameTable(table: TableInput, mapping: Record<string, string>): TableValue {
    assertKnownColumns(Object.keys(mapping), names(table));
    const schema = table.schema.map(column => ({ ...column, name: mapping[column.name] ?? column.name }));
    unique(schema.map(column => column.name));
    return { schema, rows: table.rows.map(row => Object.fromEntries(table.schema.map((column, index) => [schema[index].name, row[column.name]]))) };
}
export interface AlterColumn extends TableColumn {
    defaultValue?: unknown;
}
export function alterTable(table: TableInput, columns: AlterColumn[]): TableValue {
    unique(columns.map(column => column.name));
    const convert = (value: unknown, type: string, name: string): unknown => {
        if (value == null || type === "unknown")
            return value ?? null;
        if (type === "string")
            return String(value);
        if (type === "boolean")
            return truthy(value);
        if (type === "number") {
            const number = Number(value);
            if (Number.isFinite(number))
                return number;
        }
        else if (type === "date") {
            const date = new Date(value instanceof Date ? value.getTime() : value as string);
            if (!Number.isNaN(date.getTime()))
                return date;
        }
        else
            throw new Error(`Unsupported alter type ${type}`);
        throw new Error(`Cannot convert field ${name} to ${type}`);
    };
    for (const column of columns)
        if (!["unknown", "string", "boolean", "number", "date"].includes(column.type))
            throw new Error(`Unsupported alter type ${column.type}`);
    return { schema: columns.map(({ name, type }) => ({ name, type })), rows: table.rows.map(row => Object.fromEntries(columns.map(column => [column.name, convert(Object.prototype.hasOwnProperty.call(row, column.name) ? row[column.name] : column.defaultValue, column.type, column.name)]))) };
}
export interface TableIndex {
    readonly keys: readonly string[];
    lookup(values: readonly unknown[]): readonly Readonly<Record<string, unknown>>[];
}
export function indexTable(table: TableInput, keys: string[], uniqueKeys = false): TableIndex {
    if (!keys.length)
        throw new Error("Index requires keys");
    unique(keys);
    assertKnownColumns(keys, names(table));
    const index = createTupleIndex<Readonly<Record<string, unknown>>[]>();
    for (const row of table.rows) {
        const key = keys.map(name => row[name]), bucket = getTuple(index, key) ?? [];
        if (uniqueKeys && bucket.length)
            throw new Error("Duplicate index key");
        bucket.push(Object.freeze({ ...row }));
        setTuple(index, key, bucket);
    }
    return Object.freeze({ keys: Object.freeze([...keys]), lookup(values: readonly unknown[]) {
            if (values.length !== keys.length)
                throw new Error("Index key lengths must match");
            return Object.freeze([...(getTuple(index, values) ?? [])]);
        } });
}
export function groupedRows(table: TableInput, keys: string[], adjacent = false, rowsAs = "rows"): TableValue {
    unique([...keys, rowsAs]);
    assertKnownColumns(keys, names(table));
    const groups: {
        key: unknown[];
        rows: Record<string, unknown>[];
    }[] = [], index = createTupleIndex<Record<string, unknown>[]>();
    for (const row of table.rows) {
        const key = keys.map(name => row[name]);
        let bucket: Record<string, unknown>[] | undefined;
        if (adjacent) {
            const previous = groups[groups.length - 1];
            if (previous) {
                const match = createTupleIndex<boolean>();
                setTuple(match, previous.key, true);
                if (getTuple(match, key))
                    bucket = previous.rows;
            }
        }
        else
            bucket = getTuple(index, key);
        if (!bucket) {
            bucket = [];
            groups.push({ key, rows: bucket });
            if (!adjacent)
                setTuple(index, key, bucket);
        }
        bucket.push({ ...row });
    }
    return { schema: [...selectSchema(table, keys), { name: rowsAs, type: "array" }], rows: groups.map(group => ({ ...Object.fromEntries(keys.map((name, index) => [name, group.key[index]])), [rowsAs]: group.rows })) };
}
export interface GroupColumnsSpec {
    keys: string[];
    values: string[];
    as?: string[];
}
export function groupColumns(table: TableInput, spec: GroupColumnsSpec): TableValue {
    assertKnownColumns([...spec.keys, ...spec.values], names(table));
    if (!spec.values.length || spec.values.some(name => spec.keys.includes(name)))
        throw new Error("groupc requires disjoint value columns");
    const groups = groupedRows(table, spec.keys, false, "\0rows");
    const count = groups.rows.reduce((maximum, row) => Math.max(maximum, (row["\0rows"] as unknown[]).length), 0);
    const aliases = spec.as ?? Array.from({ length: count }, (_, index) => spec.values.map(name => `${name}_${index + 1}`)).flat();
    if (aliases.length !== count * spec.values.length)
        throw new Error("groupc output aliases must match maximum group size times value columns");
    unique([...spec.keys, ...aliases]);
    return { schema: [...selectSchema(table, spec.keys), ...aliases.map((name, index) => ({ name, type: table.schema.find(column => column.name === spec.values[index % spec.values.length])!.type }))], rows: groups.rows.map(group => {
            const records = group["\0rows"] as Record<string, unknown>[];
            return { ...Object.fromEntries(spec.keys.map(name => [name, group[name]])), ...Object.fromEntries(aliases.map((name, index) => [name, records[Math.floor(index / spec.values.length)]?.[spec.values[index % spec.values.length]] ?? null])) };
        }) };
}
export interface UngroupColumnsSpec {
    keys: string[];
    blocks: string[][];
    values: string[];
    includeNulls?: boolean;
}
export function ungroupColumns(table: TableInput, spec: UngroupColumnsSpec): TableValue {
    unique([...spec.keys, ...spec.values]);
    assertKnownColumns([...spec.keys, ...spec.blocks.flat()], names(table));
    if (spec.blocks.some(block => block.length !== spec.values.length))
        throw new Error("ungroupc block widths must match value columns");
    const rows = table.rows.flatMap(row => spec.blocks.flatMap(block => {
        const values = block.map(name => row[name] ?? null);
        if (spec.includeNulls === false && values.every(value => value === null))
            return [];
        return [{ ...Object.fromEntries(spec.keys.map(name => [name, row[name]])), ...Object.fromEntries(spec.values.map((name, index) => [name, values[index]])) }];
    }));
    return { schema: [...selectSchema(table, spec.keys), ...spec.values.map(name => ({ name, type: "unknown" }))], rows };
}
/** Source groupi's nested dimension arrays, with an explicit ordered switch. */
export function groupDimensions(table: TableInput, columns: string[], ordered = false): TableValue {
    if (!columns.length)
        throw new Error("groupi requires dimensions");
    unique(columns);
    assertKnownColumns(columns, names(table));
    const rows = [...table.rows];
    if (!ordered)
        rows.sort((a, b) => { for (const name of columns) {
            const result = compareScalarValues(a[name], b[name]);
            if (result)
                return result;
        } return 0; });
    const source = { schema: table.schema, rows };
    const top = groupedRows(source, [columns[0]], true, "\0rows");
    function dimension(records: Record<string, unknown>[], level: number, target: number): unknown[] {
        const groups = groupedRows({ schema: table.schema, rows: records }, [columns[level]], true, "\0rows").rows;
        return level === target ? groups.map(group => group[columns[level]]) : groups.map(group => dimension(group["\0rows"] as Record<string, unknown>[], level + 1, target));
    }
    return { schema: columns.map((name, index) => ({ name, type: index ? "array" : table.schema.find(column => column.name === name)!.type })), rows: top.rows.map(group => Object.fromEntries(columns.map((name, index) => [name, index ? dimension(group["\0rows"] as Record<string, unknown>[], 1, index) : group[name]]))) };
}
