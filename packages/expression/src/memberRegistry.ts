import { foldSequences } from "./sequence";
import { sortRows, type SortProjection } from './sorting';
import { windowTable, type WindowSpec } from "./window";
import type { CompiledExpression, ExpressionNode } from "./ast";
import { Cursor } from "./cursor";
import { selectCursor, projectCursor, deriveCursor } from "./cursor-transform";
import { renameTable, alterTable, indexTable, groupedRows, groupColumns, ungroupColumns, groupDimensions, type AlterColumn, type GroupColumnsSpec, type UngroupColumnsSpec } from "./table-transform";
import { pivotTable, unpivotTable, joinTables, type TableInput, type PivotSpec, type UnpivotSpec, type TableJoinSpec } from "./table-transform";
import { createTupleIndex, getTuple, setTuple, tupleEntries, compareScalarValues } from "./tuple-index";
export type MemberPredicate = (target: unknown) => boolean;
import { truthy } from "./utils";
import { aggregateValues, type AggregateKind } from "./aggregation";
import { compileBoundExpression, tableRowScope, assertKnownColumns, assertExpressionBindings } from "./binding";
import { compileExpression, evaluateAst } from "./evaluator";
import { builtins } from "./functions";
export type MemberFunction = (target: unknown, ...args: unknown[]) => unknown;
export interface MemberExpressionRuntime {
    scope: Record<string, unknown>;
    compile(source: string): CompiledExpression;
    evaluate(node: ExpressionNode, scope: Record<string, unknown>): unknown;
}
type MemberCall = Extract<ExpressionNode, {
    type: "member_call";
}>;
export type MemberExpressionFunction = (runtime: MemberExpressionRuntime, input: {
    target: unknown;
    call: MemberCall;
}) => unknown;
interface MemberEntry {
    predicate: MemberPredicate;
    fn: MemberFunction;
    expression?: MemberExpressionFunction;
}
export class MemberFunctionRegistry {
    private readonly entries = new Map<string, MemberEntry[]>();
    add(name: string, predicate: MemberPredicate, fn: MemberFunction, expression?: MemberExpressionFunction): this {
        const key = name.toLowerCase();
        const list = this.entries.get(key) ?? [];
        list.push({ predicate, fn, expression });
        this.entries.set(key, list);
        return this;
    }
    resolve(name: string, target: unknown): MemberFunction | null {
        const list = this.entries.get(name.toLowerCase());
        if (!list)
            return null;
        for (const entry of list) {
            if (entry.predicate(target))
                return entry.fn;
        }
        return null;
    }
    resolveExpression(name: string, target: unknown): MemberExpressionFunction | null {
        return this.entries.get(name.toLowerCase())?.find(entry => entry.predicate(target))?.expression ?? null;
    }
}
export const defaultMemberRegistry = new MemberFunctionRegistry();
const isArray = (v: unknown): v is unknown[] => Array.isArray(v);
const isDataSetLike = (v: unknown): v is {
    rows?: unknown[];
} => v != null && typeof v === "object" && "rows" in (v as Record<string, unknown>);
const hasTypeTag = (v: unknown): v is {
    __type: number;
} => v != null && typeof v === "object" && "__type" in (v as Record<string, unknown>);
const isDbHandle = (v: unknown): v is {
    value: unknown;
    __type: number;
} => hasTypeTag(v) && (v as {
    __type: number;
}).__type === 1;
const isFileHandle = (v: unknown): v is {
    value: unknown;
    __type: number;
} => hasTypeTag(v) && (v as {
    __type: number;
}).__type === 2;
const isCursorHandle = (v: unknown): v is {
    value: unknown;
    __type: number;
} => hasTypeTag(v) && (v as {
    __type: number;
}).__type === 5;
const unwrap = (v: unknown): unknown => hasTypeTag(v) ? (v as {
    __type: number;
    value?: unknown;
}).value : v;
const isRecordLike = (v: unknown): v is Record<string, unknown> => v != null && typeof v === "object" && !Array.isArray(v) && !hasTypeTag(v) && !isDataSetLike(v);
function isDataSet(value: unknown): value is {
    rows: Record<string, unknown>[];
    schema?: {
        name: string;
        type?: string;
    }[];
} {
    return isDataSetLike(value) && Array.isArray((value as {
        rows?: unknown[];
    }).rows);
}
function resolveDataSetKeys(dataSet: {
    keys?: string[];
    schema?: {
        name: string;
    }[];
}): string[] {
    if (Array.isArray(dataSet.keys) && dataSet.keys.length > 0) {
        return dataSet.keys;
    }
    if (Array.isArray(dataSet.schema)) {
        return dataSet.schema.map((col) => col.name);
    }
    return [];
}
function asRows(target: unknown): unknown[] {
    if (isArray(target))
        return target;
    if (isDataSetLike(target))
        return Array.isArray(target.rows) ? target.rows : [];
    return [];
}
function asDataSet(target: unknown): {
    rows: unknown[];
    schema?: {
        name: string;
        type?: string;
    }[];
} | null {
    if (isDataSetLike(target)) {
        const dataSet = target as {
            rows?: unknown[];
            columns?: string[];
            schema?: {
                name: string;
                type?: string;
            }[];
        };
        const rows = Array.isArray(dataSet.rows) ? dataSet.rows : [];
        const names = dataSet.columns ?? [...new Set(rows.flatMap(row => row && typeof row === "object" ? Object.keys(row) : []))];
        return { rows, schema: dataSet.schema ?? names.map(name => ({ name, type: "unknown" })) };
    }
    if (isArray(target)) {
        const rows = target as unknown[];
        const schema = rows.length > 0 && typeof rows[0] === "object" && rows[0] !== null
            ? [...new Set(rows.flatMap(row => row && typeof row === "object" ? Object.keys(row) : []))].map((name) => ({ name, type: "unknown" }))
            : [];
        return { rows, schema };
    }
    return null;
}
function ensureDataSet(target: unknown): {
    rows: unknown[];
    schema?: {
        name: string;
        type?: string;
    }[];
} {
    const dataSet = asDataSet(target);
    if (!dataSet) {
        throw new Error("Sequence member functions require array or table targets");
    }
    return dataSet;
}
function toAggregateSpec(spec: unknown, columns: string[]): {
    groupBy?: string[];
    aggregates: Record<string, (rows: Record<string, unknown>[]) => unknown>;
} {
    if (!spec || typeof spec !== "object") {
        throw new Error("group() expects aggregate spec object");
    }
    const raw = spec as Record<string, unknown>;
    const groupBy = Array.isArray(raw.groupBy) ? raw.groupBy.map((v) => String(v)) : undefined;
    const aggregates: Record<string, (rows: Record<string, unknown>[]) => unknown> = {};
    const aggSpec = raw.aggregates as Record<string, unknown> | undefined;
    if (!aggSpec || typeof aggSpec !== "object") {
        throw new Error("group() requires aggregates object");
    }
    for (const [name, entry] of Object.entries(aggSpec)) {
        if (!entry || typeof entry !== "object") {
            throw new Error("group() aggregate entry must be object");
        }
        const cfg = entry as Record<string, unknown>;
        const type = typeof cfg.type === "string" ? cfg.type.toLowerCase() : "";
        const field = typeof cfg.field === "string" ? cfg.field : undefined;
        if (field)
            assertKnownColumns([field], columns);
        if (["sum", "count", "icount", "avg", "min", "max", "median"].includes(type)) {
            if (type !== "count" && !field)
                throw new Error("group() " + type + " requires field");
            aggregates[name] = rows => aggregateValues(type as AggregateKind, field ? rows.map(row => row[field]) : rows);
            continue;
        }
        throw new Error("group() aggregate type not supported");
    }
    return { groupBy, aggregates };
}
function toComputedColumns(spec: unknown): Record<string, string> {
    if (!spec || typeof spec !== "object") {
        throw new Error("derive() expects object mapping column -> expression");
    }
    const map: Record<string, string> = {};
    for (const [name, expr] of Object.entries(spec as Record<string, unknown>)) {
        if (typeof expr !== "string") {
            throw new Error("derive() expects expression strings");
        }
        map[name] = expr;
    }
    return map;
}
function resolveArrayArg(target: unknown, arg?: unknown): unknown[] {
    if (isArray(target))
        return target;
    if (isDataSetLike(target))
        return Array.isArray(target.rows) ? target.rows : [];
    if (typeof target === "string")
        return target.split("");
    if (target == null)
        return [];
    if (isRecordLike(target))
        return Object.values(target);
    if (typeof target === "number") {
        const values: unknown[] = [];
        for (let i = 1; i <= target; i += 1) {
            values.push(i);
        }
        return values;
    }
    if (typeof target === "boolean")
        return [target];
    if (typeof target === "function")
        return [];
    if (typeof target === "symbol")
        return [];
    return [];
}
function toSkipCount(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.max(0, Math.trunc(value));
    }
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return Math.max(0, Math.trunc(parsed));
        }
    }
    return 0;
}
function pluck(arr: unknown[], field?: unknown): unknown[] {
    if (!field || typeof field !== "string")
        return arr;
    return arr.map((row) => (row && typeof row === "object" ? (row as Record<string, unknown>)[field] : undefined));
}
function memberValues(target: unknown, field?: unknown): unknown[] {
    if (typeof field === "string")
        assertKnownColumns([field], (ensureDataSet(target).schema ?? []).map(column => column.name));
    return pluck(resolveArrayArg(target), field);
}
// count
defaultMemberRegistry.add("count", (target) => isArray(target) || isDataSetLike(target) || typeof target === "string", (target, field?: unknown) => {
    if (isArray(target))
        return memberValues(target, field).filter(truthy).length;
    if (typeof target === "string")
        return target.length;
    if (isDataSetLike(target) && Array.isArray(target.rows))
        return memberValues(target, field).filter(truthy).length;
    return 0;
}, (runtime, input) => typeof input.target === "string" ? String(input.target).length : aggregateMember("count", runtime, input));
// string regex()
defaultMemberRegistry.add("regex", (target) => typeof unwrap(target) === "string", (target, pattern: unknown, replacementOrOptions?: unknown, options?: unknown) => {
    const { builtins } = require("./functions") as typeof import("./functions");
    return builtins.regex(String(unwrap(target)), pattern, replacementOrOptions, options);
});
// sum/avg/min/max
for (const name of ["sum", "avg", "min", "max", "median", "icount"] as const) {
    defaultMemberRegistry.add(name, target => isArray(target) || isDataSetLike(target), (target, field?: unknown) => aggregateValues(name, memberValues(target, field)), (runtime, input) => aggregateMember(name, runtime, input));
}
function resolveFieldName(field?: unknown): string | null {
    if (typeof field === "string")
        return field;
    return null;
}
function resolveFieldKey(record: Record<string, unknown>, field: unknown): string | null {
    if (typeof field === "number" && Number.isFinite(field)) {
        const keys = Object.keys(record);
        const rawIndex = Math.trunc(field);
        if (rawIndex === 0)
            return null;
        const idx = rawIndex > 0 ? rawIndex - 1 : keys.length + rawIndex;
        if (idx < 0 || idx >= keys.length)
            return null;
        return keys[idx];
    }
    if (typeof field === "string")
        return field;
    return null;
}
// first/last
defaultMemberRegistry.add("first", (target) => isArray(target) || isDataSetLike(target), (target) => {
    const arr = resolveArrayArg(target);
    return arr.length ? arr[0] : null;
});
defaultMemberRegistry.add("last", (target) => isArray(target) || isDataSetLike(target), (target) => {
    const arr = resolveArrayArg(target);
    return arr.length ? arr[arr.length - 1] : null;
});
defaultMemberRegistry.add("fetch", (target) => isArray(target) || isDataSetLike(target), (target, count?: unknown) => {
    const arr = resolveArrayArg(target);
    if (count === undefined)
        return arr;
    const take = toSkipCount(count);
    return arr.slice(0, take);
});
defaultMemberRegistry.add("skip", (target) => isArray(target) || isDataSetLike(target), (target, count?: unknown) => {
    const arr = resolveArrayArg(target);
    const skip = toSkipCount(count);
    return arr.slice(skip);
});
// db member functions
for (const name of ["query", "execute", "cursor"] as const) {
    defaultMemberRegistry.add(name, (target) => isDbHandle(target), (target, ...args: unknown[]) => {
        const raw = unwrap(target) as {
            [key: string]: unknown;
        } | null;
        const fn = raw && typeof raw[name] === "function" ? (raw[name] as (...params: unknown[]) => unknown) : null;
        if (!fn) {
            throw new Error(`${name}() is not available on db handle`);
        }
        return fn(...args);
    });
}
for (const name of ["commit", "rollback"] as const) {
    defaultMemberRegistry.add(name, (target) => isDbHandle(target), (target) => {
        const raw = unwrap(target) as {
            [key: string]: unknown;
        } | null;
        const fn = raw && typeof raw[name] === "function" ? (raw[name] as () => unknown) : null;
        if (!fn) {
            throw new Error(`${name}() is not available on db handle`);
        }
        return fn();
    });
}
// file member functions
for (const name of ["read", "write", "import", "export", "cursor"] as const) {
    defaultMemberRegistry.add(name, (target) => isFileHandle(target), (target, ...args: unknown[]) => {
        const raw = unwrap(target) as {
            [key: string]: unknown;
        } | null;
        const fn = raw && typeof raw[name] === "function" ? (raw[name] as (...params: unknown[]) => unknown) : null;
        if (!fn) {
            throw new Error(`${name}() is not available on file handle`);
        }
        return fn.apply(raw, args);
    });
}
// cursor member functions
for (const name of ["fetch", "skip", "close", "cancel", "collect"] as const) {
    defaultMemberRegistry.add(name, (target) => isCursorHandle(target), (target, ...args: unknown[]) => {
        const raw = unwrap(target) as {
            [key: string]: unknown;
        } | null;
        const fn = raw && typeof raw[name] === "function" ? (raw[name] as (...params: unknown[]) => unknown) : null;
        if (!fn) {
            throw new Error(`${name}() is not available on cursor handle`);
        }
        return fn.apply(raw, args);
    });
}
// record member functions
defaultMemberRegistry.add("field", (target) => isRecordLike(target), (target, field?: unknown, value?: unknown) => {
    const record = target as Record<string, unknown>;
    if (field === undefined) {
        throw new Error("field() requires field name or index");
    }
    const resolved = resolveFieldKey(record, field);
    if (!resolved)
        return null;
    if (value === undefined) {
        return record[resolved];
    }
    record[resolved] = value;
    return null;
});
defaultMemberRegistry.add("fname", (target) => isRecordLike(target), (target, index?: unknown) => {
    const record = target as Record<string, unknown>;
    const keys = Object.keys(record);
    if (index === undefined) {
        return keys;
    }
    if (typeof index !== "number" || !Number.isFinite(index)) {
        throw new Error("fname() expects a numeric index");
    }
    const idx = Math.trunc(index) - 1;
    if (idx < 0) {
        throw new Error("fname() index must be >= 1");
    }
    return idx >= keys.length ? null : keys[idx];
});
defaultMemberRegistry.add("fno", (target) => isRecordLike(target), (target, field?: unknown) => {
    const record = target as Record<string, unknown>;
    if (field === undefined)
        return Object.keys(record).length;
    const resolved = resolveFieldKey(record, field);
    if (!resolved)
        return null;
    const keys = Object.keys(record);
    const idx = keys.indexOf(resolved);
    return idx === -1 ? null : idx + 1;
});
defaultMemberRegistry.add("key", (target) => isRecordLike(target), (target, ...fields: unknown[]) => {
    const record = target as Record<string, unknown>;
    if (fields.length === 0) {
        const keys = Object.keys(record);
        return keys.length === 1 ? record[keys[0]] : keys.map((key) => record[key]);
    }
    if (fields.length === 1) {
        const resolved = resolveFieldName(fields[0]);
        return resolved ? record[resolved] : null;
    }
    return fields.map((field) => {
        const resolved = resolveFieldName(field);
        return resolved ? record[resolved] : null;
    });
});
defaultMemberRegistry.add("record", (target) => isRecordLike(target), (target, values?: unknown) => {
    const record = target as Record<string, unknown>;
    if (!Array.isArray(values)) {
        if (values !== undefined && values !== null) {
            throw new Error("record() expects an array of values");
        }
        return record;
    }
    const keys = Object.keys(record);
    for (let i = 0; i < keys.length && i < values.length; i += 1) {
        record[keys[i]] = values[i];
    }
    return record;
});
// table member functions (DataSet)
defaultMemberRegistry.add("keys", (target) => isDataSetLike(target), (target, ...fields: unknown[]) => {
    const dataSet = target as {
        rows?: unknown[];
        keys?: string[];
    };
    if (fields.length === 0) {
        return dataSet;
    }
    const names = fields.map((field) => {
        if (typeof field !== "string") {
            throw new Error("keys() expects string field names");
        }
        return field;
    });
    (dataSet as {
        keys?: string[];
    }).keys = names;
    return dataSet;
});
defaultMemberRegistry.add("row", (target) => isDataSetLike(target), (target, key?: unknown) => {
    const dataSet = target as {
        rows?: unknown[];
        keys?: string[];
        schema?: {
            name: string;
        }[];
    };
    const rows = Array.isArray(dataSet.rows) ? dataSet.rows : [];
    if (key === undefined)
        return null;
    const keys = Array.isArray(dataSet.keys) && dataSet.keys.length > 0
        ? dataSet.keys
        : Array.isArray(dataSet.schema)
            ? dataSet.schema.map((col) => col.name)
            : [];
    if (keys.length === 0) {
        return rows.find((row) => row && isRecordLike(row) && Object.values(row).includes(key)) ?? null;
    }
    return (rows.find((row) => row &&
        isRecordLike(row) &&
        keys.every((field: string) => (row as Record<string, unknown>)[field] === key)) ?? null);
});
// sequence/table member functions
defaultMemberRegistry.add("select", target => isArray(target) || isDataSetLike(target), (target, source) => selectMember(defaultExpressionRuntime(), { target, call: memberCall("select", [{ type: "literal", value: String(source) }]) }), selectMember);
defaultMemberRegistry.add("sort", target => isArray(target) || isDataSetLike(target), (target, ...args) => sortMember(defaultExpressionRuntime(), { target, call: memberCall('sort', args.map(value => {
    if (value !== null && !['string','number','bigint','boolean'].includes(typeof value)) throw new Error('sort direct arguments must be scalar declarations');
    return { type:'literal', value } as ExpressionNode;
})) }), sortMember);
defaultMemberRegistry.add("derive", target => isArray(target) || isDataSetLike(target), (target, spec) => {
    const columns = toComputedColumns(spec);
    return deriveMember(defaultExpressionRuntime(), { target, call: memberCall("derive", [{ type: "record", entries: Object.entries(columns).map(([key, value]) => ({ key, value: { type: "literal", value } })) }]) });
}, deriveMember);
defaultMemberRegistry.add("group", (target) => isArray(target) || isDataSetLike(target), (target, spec?: unknown) => {
    const dataSet = ensureDataSet(target);
    const names = (dataSet.schema ?? []).map(column => column.name);
    const { groupBy, aggregates } = toAggregateSpec(spec, names);
    const groupKeys = groupBy ?? [];
    assertKnownColumns(groupKeys, names);
    const groups = createTupleIndex<Record<string, unknown>[]>();
    for (const row of dataSet.rows) {
        const record = row as Record<string, unknown>;
        const key = groupKeys.map((k) => record[k]);
        const list = getTuple(groups, key) ?? [];
        list.push(record);
        setTuple(groups, key, list);
    }
    if (!groupKeys.length && !dataSet.rows.length)
        setTuple(groups, [], []);
    const resultRows: Record<string, unknown>[] = [];
    for (const [key, rows] of tupleEntries(groups)) {
        const groupRow: Record<string, unknown> = Object.fromEntries(groupKeys.map((name, index) => [name, key[index]]));
        for (const [alias, fn] of Object.entries(aggregates)) {
            groupRow[alias] = fn(rows);
        }
        resultRows.push(groupRow);
    }
    const schema = [
        ...groupKeys.map((name) => ({ name, type: dataSet.schema?.find((column) => column.name === name)?.type ?? "unknown" })),
        ...Object.keys(aggregates).map((name) => ({ name, type: "number" })),
    ];
    return { rows: resultRows, schema };
});
defaultMemberRegistry.add("join", (target) => isArray(target) || isDataSetLike(target), (target, other?: unknown, spec?: unknown) => {
    if (!spec || typeof spec !== "object")
        throw new Error("join() expects join spec object");
    return joinTables(tableValue(target), tableValue(other), { ...(spec as TableJoinSpec), type: (String((spec as TableJoinSpec).type ?? "inner").toLowerCase()) as TableJoinSpec["type"] });
});
function tableValue(target: unknown): TableInput {
    const table = ensureDataSet(target);
    return { schema: (table.schema ?? []).map(column => ({ name: column.name, type: column.type ?? "unknown" })), rows: table.rows as Record<string, unknown>[] };
}
for (const name of ["pivot", "unpivot"] as const) {
    defaultMemberRegistry.add(name, target => isArray(target) || isDataSetLike(target), (target, spec: unknown) => {
        if (!spec || typeof spec !== "object")
            throw new Error(name + "() requires a spec object");
        return name === "pivot" ? pivotTable(tableValue(target), spec as PivotSpec) : unpivotTable(tableValue(target), spec as UnpivotSpec);
    });
}
const tableMembers: Record<string, (table: TableInput, spec: unknown, extra?: unknown) => unknown> = {
    rename: (table, spec) => renameTable(table, spec as Record<string, string>), alter: (table, spec) => alterTable(table, spec as AlterColumn[]), index: (table, spec, extra) => indexTable(table, spec as string[], extra === true),
    groupRows: (table, raw) => {
        const spec = raw as {
            keys: string[];
            adjacent?: boolean;
            rowsAs?: string;
        };
        return groupedRows(table, spec.keys, spec.adjacent, spec.rowsAs);
    },
    groupc: (table, spec) => groupColumns(table, spec as GroupColumnsSpec), ungroupc: (table, spec) => ungroupColumns(table, spec as UngroupColumnsSpec),
    groupi: (table, raw) => {
        const spec = raw as {
            columns: string[];
            ordered?: boolean;
        };
        return groupDimensions(table, spec.columns, spec.ordered);
    },
};
for (const [name, transform] of Object.entries(tableMembers))
    defaultMemberRegistry.add(name, target => isArray(target) || isDataSetLike(target), (target, spec: unknown, extra?: unknown) => transform(tableValue(target), spec, extra));
for (const name of ["select", "filter"] as const)
    defaultMemberRegistry.add(name, target => target instanceof Cursor, (target, source: unknown) => { if (typeof source !== "string")
        throw new Error(name + " cursor predicate must be an expression string"); return selectCursor(target as Cursor<Record<string, unknown>>, source); }, (runtime, { target, call }) => { checkMemberCall(call); if (call.args.length !== 1)
        throw new Error("Cursor select expects one predicate"); const cursor = target as Cursor<Record<string, unknown>>, predicate = rowExpression(runtime, call.args[0], cursor.columns ? [...cursor.columns] : undefined); return cursor.filter(row => truthy(predicate(row))); });
defaultMemberRegistry.add("derive", target => target instanceof Cursor, (target, spec: unknown) => deriveCursor(target as Cursor<Record<string, unknown>>, toComputedColumns(spec)), (runtime, { target, call }) => { const cursor = target as Cursor<Record<string, unknown>>, plan = derivation(runtime, call, cursor.columns ? [...cursor.columns] : undefined); return cursor.map(plan.evaluate, plan.names); });
defaultMemberRegistry.add("project", target => target instanceof Cursor, (target, columns: unknown) => { if (!Array.isArray(columns) || !columns.every(name => typeof name === "string"))
    throw new Error("Cursor projection requires column names"); return projectCursor(target as Cursor<Record<string, unknown>>, columns); });
for (const name of ["sort", "group", "join", "pivot", "unpivot"] as const)
    defaultMemberRegistry.add(name, target => target instanceof Cursor, () => { throw new Error("Cursor " + name + " requires explicit bounded collect(maxRows) before materialization"); });
for (const name of ["union", "isect", "diff", "conj"] as const)
    defaultMemberRegistry.add(name, target => Array.isArray(target), (target, source: unknown) => {
        let values = target as unknown[];
        if (source !== undefined) {
            if (typeof source !== "string")
                throw new Error(name + " mapper must be an expression string");
            const compiled = compileExpression(source);
            values = values.map(value => compiled.evaluate(value && typeof value === "object" ? value as Record<string, unknown> : { _: value }));
        }
        return foldSequences(name, values);
    }, (runtime, input) => sequenceMember(name, runtime, input));
defaultMemberRegistry.add("calc", target => !(target instanceof Cursor), (target, source) => calcMember(defaultExpressionRuntime(), { target, call: memberCall("calc", [{ type: "literal", value: String(source) }]) }), calcMember);
function memberCall(method: string, args: ExpressionNode[]): MemberCall { return { type: 'member_call', object: { type: 'literal', value: null }, method, args }; }
function defaultExpressionRuntime(): MemberExpressionRuntime { return { scope: {}, compile: compileExpression, evaluate: (node, scope) => evaluateAst(node, scope, builtins) }; }
function checkMemberCall(call: MemberCall, allowedOptions: string[] = [], aliases = false): void {
    if (call.argGroups)
        throw new Error(`${call.method}: parameter groups are not supported for this overload`);
    if (call.option && !allowedOptions.includes(call.option))
        throw new Error(`${call.method}: unsupported options @${call.option}`);
    if (call.aliases && !aliases)
        throw new Error(`${call.method} does not accept column aliases`);
}
function rowBindings(row: unknown): Record<string, unknown> { return row !== null && typeof row === 'object' ? { _: row, ...row as Record<string, unknown> } : { _: row }; }
function sortMember(runtime: MemberExpressionRuntime, { target, call }: { target: unknown; call: MemberCall }): unknown {
    const option = call.option ?? '';
    if (!/^[zu0]*$/.test(option) || new Set(option).size !== option.length)
        throw new Error('sort: unsupported options @' + option + '; in-place @o and group-number @n are not supported');
    if (call.aliases) throw new Error('sort expects numeric order expressions, not column aliases');
    const data = ensureDataSet(target), names = data.schema?.map(column => column.name) ?? [];
    let args = call.args;
    let locale: unknown;
    if (call.argGroups) {
        if (call.argGroups.length !== 2 || call.argGroups[1].length !== 1 || call.orders?.slice(call.argGroups[0].length).some(Boolean))
            throw new Error('sort expects keys;one locale expression');
        args = call.argGroups[0];
        locale = runtime.evaluate(call.argGroups[1][0], runtime.scope);
    }
    let legacyDirection: 1 | -1 | undefined;
    if (!call.orders && args.length === 2 && args[0].type === 'literal' && typeof args[0].value === 'string') {
        const last = args[1];
        const value = last.type === 'literal' ? last.value : last.type === 'identifier' && !names.includes(last.name) ? runtime.scope[last.name] : undefined;
        if (value === 'asc' || value === 'desc') {
            legacyDirection = value === 'desc' ? -1 : 1;
            args = args.slice(0, 1);
        }
    }
    if (!args.length && names.length) throw new Error('sort on records requires a key expression');
    const projections: SortProjection<unknown>[] = args.map((node, index) => {
        const order = call.orders?.[index];
        let direction = legacyDirection;
        if (order) {
            const value = runtime.evaluate(order, runtime.scope);
            if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('sort order must be a finite number');
            direction = Math.trunc(value) >= 0 ? 1 : -1;
        } else if (call.orders) direction = 1;
        return { value: rowExpression(runtime, node, names), direction };
    });
    if (!projections.length) projections.push({ value: row => row });
    const rows = sortRows(data.rows, projections, { descending:option.includes('z'), nullsLast:option.includes('0'), groupEqual:option.includes('u'), locale });
    return Array.isArray(target) && !names.length ? rows : { schema:data.schema, rows };
}
function rowExpression(runtime: MemberExpressionRuntime, node: ExpressionNode, names: string[] | undefined, stringsAreSource = true): (row: unknown) => unknown {
    const ast = stringsAreSource && node.type === 'literal' && typeof node.value === 'string' ? runtime.compile(node.value).ast : node;
    if (names)
        assertExpressionBindings(ast, new Set([...names, '_', ...Object.keys(runtime.scope)]), 'member row expression');
    return row => { const columns = names ?? Object.keys(rowBindings(row)); if (!names)
        assertExpressionBindings(ast, new Set([...columns, ...Object.keys(runtime.scope)]), 'cursor row expression'); return runtime.evaluate(ast, tableRowScope(columns, rowBindings(row), runtime.scope)); };
}
function selectMember(runtime: MemberExpressionRuntime, { target, call }: {
    target: unknown;
    call: MemberCall;
}): unknown {
    checkMemberCall(call);
    if (call.args.length > 1)
        throw new Error('select expects one row predicate');
    const data = ensureDataSet(target), names = data.schema?.map(column => column.name) ?? [];
    const predicate = call.args[0] ? rowExpression(runtime, call.args[0], names) : (row: unknown) => row;
    return { schema: data.schema, rows: data.rows.filter(row => truthy(predicate(row))) };
}
function derivation(runtime: MemberExpressionRuntime, call: MemberCall, names: string[] | undefined) {
    checkMemberCall(call, [], true);
    let entries: {
        name: string;
        expression: ExpressionNode;
        sourceText?: boolean;
    }[];
    if (call.aliases) {
        entries = call.args.map((expression, index) => { const name = call.aliases![index]; if (!name)
            throw new Error('derive requires an alias for every row expression'); return { name, expression }; });
    }
    else if (call.args.length === 1 && call.args[0].type === 'record')
        entries = call.args[0].entries.map(entry => { const value = runtime.evaluate(entry.value, runtime.scope); if (typeof value !== "string")
            throw new Error("derive() map values must be expression strings; use expression:alias for row AST"); return { name: entry.key, expression: { type: "literal", value }, sourceText: true }; });
    else if (call.args.length === 1) {
        const columns = toComputedColumns(runtime.evaluate(call.args[0], runtime.scope));
        entries = Object.entries(columns).map(([name, value]) => ({ name, expression: { type: 'literal', value }, sourceText: true }));
    }
    else
        throw new Error('derive expects a column map or expressions with :alias');
    if (new Set(entries.map(entry => entry.name)).size !== entries.length)
        throw new Error('Duplicate derive column aliases');
    const evaluators = entries.map(({ name, expression, sourceText }) => {
        const evaluate = rowExpression(runtime, expression, names ? [...names] : undefined, sourceText ?? false);
        if (names && !names.includes(name))
            names.push(name);
        return { name, evaluate };
    });
    return { names, evaluate: (row: unknown) => { const base: Record<string, unknown> = row !== null && typeof row === 'object' ? { ...row as Record<string, unknown> } : { _: row }; for (const { name, evaluate } of evaluators)
            base[name] = evaluate(base); return base; } };
}
function deriveMember(runtime: MemberExpressionRuntime, { target, call }: {
    target: unknown;
    call: MemberCall;
}): unknown {
    const data = ensureDataSet(target), plan = derivation(runtime, call, data.schema?.map(column => column.name) ?? []);
    const schema = plan.names!.map(name => data.schema?.find(column => column.name === name) ?? { name, type: 'unknown' });
    return { schema, rows: data.rows.map(plan.evaluate) };
}
function aggregateMember(kind: AggregateKind, runtime: MemberExpressionRuntime, { target, call }: {
    target: unknown;
    call: MemberCall;
}): unknown {
    checkMemberCall(call);
    if (call.args.length > 1)
        throw new Error(`${call.method} expects one row expression`);
    const data = ensureDataSet(target), names = data.schema?.map(column => column.name) ?? [];
    const mapper = call.args[0] ? rowExpression(runtime, call.args[0], names) : (row: unknown) => row;
    return aggregateValues(kind, data.rows.map(mapper));
}
function calcMember(runtime: MemberExpressionRuntime, { target, call }: {
    target: unknown;
    call: MemberCall;
}): unknown {
    checkMemberCall(call);
    if (call.args.length !== 1)
        throw new Error('calc expects one row expression');
    if (isArray(target) || isDataSetLike(target)) {
        const data = ensureDataSet(target), mapper = rowExpression(runtime, call.args[0], data.schema?.map(column => column.name) ?? []);
        return data.rows.map(mapper);
    }
    const mapper = rowExpression(runtime, call.args[0], Object.keys(rowBindings(target)));
    return mapper(target);
}
function sequenceMember(kind: "union" | "isect" | "diff" | "conj", runtime: MemberExpressionRuntime, { target, call }: {
    target: unknown;
    call: MemberCall;
}): unknown {
    checkMemberCall(call, kind === "conj" ? ["m", "r"] : ["m"]);
    if (call.args.length > 1)
        throw new Error(kind + " expects at most one mapper");
    let values = target as unknown[];
    if (call.args[0]) {
        const names = [...new Set(values.flatMap(value => Object.keys(rowBindings(value))))];
        const mapper = rowExpression(runtime, call.args[0], names);
        values = values.map(mapper);
    }
    if (call.option === "r")
        return flattenSequences(values);
    return foldSequences(kind, values, call.option === "m");
}
function flattenSequences(values: unknown[]): unknown[] {
    const result: unknown[] = [];
    const active = new Set<unknown[]>();
    function visit(value: unknown, depth: number): void {
        if (!Array.isArray(value)) {
            if (value != null)
                result.push(value);
            return;
        }
        if (depth > 128 || active.has(value))
            throw new Error("conj@r requires acyclic arrays of depth <=128");
        active.add(value);
        for (const item of value) {
            visit(item, depth + 1);
            if (result.length > 1000000)
                throw new Error("conj@r result exceeds 1000000 items");
        }
        active.delete(value);
    }
    visit(values, 0);
    return result;
}

defaultMemberRegistry.add('window',target=>isArray(target)||isDataSetLike(target),(target,spec)=>windowTable(tableValue(target),spec as WindowSpec),(runtime,{target,call})=>{
 checkMemberCall(call);if(call.args.length!==1)throw new Error('window expects one spec');return windowTable(tableValue(target),runtime.evaluate(call.args[0],runtime.scope) as WindowSpec,runtime.scope);
});
