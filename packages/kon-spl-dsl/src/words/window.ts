import type { DataSet, OrderBySpec, WindowOutputs, WindowOffset, WindowFrame } from "depa-data-core";
import { normalizeKnValue, type WordCall } from "../knot-reader";
import type { SplContext } from "../context";
import { buildNativeScope, readConfMap, rejectNativeOptions, resolveDataSet, type KununRuntime } from "./shared";
import { readSortBy } from "./sort";
function name(value: unknown, label: string): string {
    const normalized = normalizeKnValue(value);
    if (typeof normalized !== "string" || !normalized.length)
        throw new Error(`spl_window: ${label} must be a non-empty string`);
    return normalized;
}
function readOrder(conf: Record<string, unknown>): OrderBySpec[] {
    if (conf.by !== undefined)
        return readSortBy(conf.by, "spl_window").map((key) => ({ column: key.col, direction: key.desc ? "desc" : "asc" }));
    if (typeof conf.orderBy === "string")
        return [{ column: conf.orderBy, direction: "asc" }];
    if (!Array.isArray(conf.orderBy) || !conf.orderBy.length)
        throw new Error("spl_window: expected by or non-empty orderBy");
    return conf.orderBy.map((entry) => {
        const value = normalizeKnValue(entry);
        if (typeof value === "string")
            return { column: value, direction: "asc" };
        if (!value || typeof value !== "object" || Array.isArray(value))
            throw new Error("spl_window: invalid orderBy entry");
        const item = value as Record<string, unknown>;
        const direction = normalizeKnValue(item.direction) ?? "asc";
        if (direction !== "asc" && direction !== "desc")
            throw new Error("spl_window: direction must be asc or desc");
        return { column: name(item.column, "orderBy.column"), direction };
    });
}
function readOutputs(conf: Record<string, unknown>): WindowOutputs {
    const raw = readConfMap(conf, "outputs", "spl_window");
    if (!Object.keys(raw).length)
        throw new Error("spl_window: outputs cannot be empty");
    const outputs: WindowOutputs = {};
    for (const [key, value] of Object.entries(raw)) {
        if (key === "rowNumber" || key === "rank" || key === "denseRank")
            outputs[key] = name(value, key);
        else if (key === "runningSum" || key === "runningAvg") {
            if (!value || typeof value !== "object" || Array.isArray(value))
                throw new Error(`spl_window: ${key} must be a map`);
            const item = value as Record<string, unknown>;
            for (const prop of Object.keys(item))
                if (!["column", "as", "expression"].includes(prop))
                    throw new Error(`spl_window: unsupported ${key}.${prop}`);
            outputs[key] = { column: name(item.column, `${key}.column`),
                ...(item.as !== undefined ? { as: name(item.as, `${key}.as`) } : {}),
                ...(item.expression !== undefined ? { expression: name(item.expression, `${key}.expression`) } : {}) };
        }
        else if (key === "lag" || key === "lead")
            outputs[key] = readOffsets(value, key);
        else if (key === "frames")
            outputs.frames = readFrames(value);
        else
            throw new Error(`spl_window: unsupported output ${key}`);
    }
    return outputs;
}
export function executeWindow(ctx: SplContext, runtime: KununRuntime, call: WordCall): DataSet {
    rejectNativeOptions(call, "spl_window");
    const input = resolveDataSet(ctx, runtime, call.conf.in, "spl_window");
    const rawPartitions = call.conf.partitionBy;
    const partitionBy = rawPartitions === undefined ? [] : (Array.isArray(rawPartitions) ? rawPartitions : [rawPartitions]).map((v) => name(v, "partitionBy"));
    const orderBy = readOrder(call.conf);
    const outputs = readOutputs(call.conf);
    const columns = new Set(input.schema.map((column) => column.name));
    const required = [...partitionBy, ...orderBy.map((order) => order.column),
        ...[outputs.runningSum, outputs.runningAvg].flatMap((measure) => measure && !measure.expression ? [measure.column] : [])];
    for (const column of required)
        if (!columns.has(column))
            throw new Error(`spl_window: unknown input column ${column}`);
    return input.window({ partitionBy, orderBy, outputs }, buildNativeScope(ctx, runtime, readConfMap(call.conf, "with", "spl_window")));
}
function measureList(value: unknown, label: string): Record<string, unknown>[] {
    if (!Array.isArray(value))
        throw new Error("spl_window: " + label + " must be a list");
    return value.map(entry => { const item = normalizeKnValue(entry); if (!item || typeof item !== "object" || Array.isArray(item))
        throw new Error("spl_window: invalid " + label + " measure"); return Object.fromEntries(Object.entries(item).map(([key, v]) => [key, normalizeKnValue(v)])); });
}
function measure(item: Record<string, unknown>, label: string) {
    return { as: name(item.as, label + ".as"), ...(item.column !== undefined ? { column: name(item.column, label + ".column") } : {}), ...(item.expression !== undefined ? { expression: name(item.expression, label + ".expression") } : {}) };
}
function readOffsets(value: unknown, label: string): WindowOffset[] {
    return measureList(value, label).map(item => {
        for (const key of Object.keys(item))
            if (!["as", "column", "expression", "offset", "defaultValue"].includes(key))
                throw new Error("spl_window: unsupported " + label + "." + key);
        if (item.offset !== undefined && (typeof item.offset !== "number" || !Number.isSafeInteger(item.offset) || item.offset < 0))
            throw new Error("spl_window: offset must be a nonnegative integer");
        return { ...measure(item, label), ...(item.offset !== undefined ? { offset: item.offset as number } : {}), ...(item.defaultValue !== undefined ? { defaultValue: item.defaultValue } : {}) };
    });
}
function readFrames(value: unknown): WindowFrame[] {
    return measureList(value, "frames").map(item => {
        for (const key of Object.keys(item))
            if (!["as", "column", "expression", "kind", "start", "end"].includes(key))
                throw new Error("spl_window: unsupported frames." + key);
        for (const key of ["start", "end"])
            if (item[key] !== null && (typeof item[key] !== "number" || !Number.isSafeInteger(item[key])))
                throw new Error("spl_window: frame " + key + " must be an integer or null");
        return { ...measure(item, "frames"), kind: name(item.kind, "frames.kind") as WindowFrame["kind"], start: item.start as number | null, end: item.end as number | null };
    });
}
