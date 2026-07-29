import { parseJsonPreservingNumbers, stringifySplJson, isDecimal } from "depa-data-expression";
import { existsSync, realpathSync, mkdirSync, readFileSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute, basename, extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { parseCsvTable, tableFromRecords, type TableData } from "./table-input";
import { openCsvCursor, type CsvCursorOptions } from "./datasource/csv-cursor";
import type { Cursor } from "depa-data-expression";
function assertInside(path: string, root: string): void {
    const base = realpathSync(root);
    let parent = path;
    while (!existsSync(parent)) {
        const next = dirname(parent);
        if (next === parent)
            break;
        parent = next;
    }
    const actual = realpathSync(parent), suffix = relative(base, actual);
    if (suffix === ".." || suffix.startsWith("../") || isAbsolute(suffix))
        throw new Error("Path escapes workspace root");
}
export function writeAtomicFile(path: string, root: string, bytes: string | Uint8Array): number {
    assertInside(path, root);
    mkdirSync(dirname(path), { recursive: true });
    const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
    let fd: number | undefined;
    try {
        fd = openSync(temporary, "wx", 0o600);
        writeFileSync(fd, bytes);
        fsyncSync(fd);
        closeSync(fd);
        fd = undefined;
        renameSync(temporary, path);
        return typeof bytes === "string" ? Buffer.byteLength(bytes) : bytes.byteLength;
    }
    finally {
        if (fd !== undefined)
            closeSync(fd);
        if (existsSync(temporary))
            unlinkSync(temporary);
    }
}
function tableValue(input: unknown): TableData {
    if (Array.isArray(input))
        return tableFromRecords(input);
    if (!input || typeof input !== "object")
        throw new Error("File export requires table rows");
    const value = input as {
        rows?: unknown[];
        columns?: string[];
        schema?: {
            name: string;
        }[];
    };
    if (!Array.isArray(value.rows))
        throw new Error("File export requires table rows");
    const columns = value.columns ?? value.schema?.map(column => column.name) ?? tableFromRecords(value.rows).columns;
    if (new Set(columns).size !== columns.length || columns.some(name => typeof name !== "string"))
        throw new Error("Invalid file table columns");
    return { columns: [...columns], rows: value.rows.map(row => {
            if (Array.isArray(row))
                return Object.fromEntries(columns.map((name, index) => [name, row[index] ?? null]));
            if (!row || typeof row !== "object")
                throw new Error("File table rows must be records");
            return Object.fromEntries(columns.map(name => [name, (row as Record<string, unknown>)[name] ?? null]));
        }) };
}
type FileOptions = {
    format?: "csv" | "tsv" | "json";
    inferTypes?: boolean;
    delimiter?: string;
};
function optionsFor(path: string, input: unknown): Required<Pick<FileOptions, "format">> & FileOptions {
    if (input !== undefined && (!input || typeof input !== "object" || Array.isArray(input)))
        throw new Error("File options must be an object");
    const options = (input ?? {}) as FileOptions;
    if (Object.keys(options).some(key => !["format", "inferTypes", "delimiter"].includes(key)))
        throw new Error("Unsupported file option");
    const format = options.format ?? extname(path).slice(1).toLowerCase();
    if (!["csv", "tsv", "json"].includes(format))
        throw new Error("File import/export supports CSV/TSV/JSON");
    return { ...options, format: format as "csv" | "tsv" | "json" };
}
export function workspaceFile(path: string, root: string, runtime?: {
    allowAsync: boolean;
    signal?: AbortSignal;
    own: (cursor: Cursor<Record<string, unknown>>) => Cursor<Record<string, unknown>>;
}) {
    const target = resolve(path);
    function read(): string { assertInside(target, root); return new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(target)); }
    return {
        path: target, read,
        write(value: unknown): number { if (typeof value !== "string" && !(value instanceof Uint8Array))
            throw new Error("File write requires text or bytes"); return writeAtomicFile(target, root, value); },
        import(raw?: unknown) {
            const options = optionsFor(target, raw), content = read();
            const value = options.format === "json" ? parseJsonPreservingNumbers(content) : parseCsvTable(content, { delimiter: options.delimiter ?? (options.format === "tsv" ? "\t" : ","), inferTypes: options.inferTypes });
            const data = options.format === "json" ? (value && typeof value === "object" && !Array.isArray(value) && "columns" in value && "rows" in value && Array.isArray(value.columns) && Array.isArray(value.rows) ? tableValue(value) : tableFromRecords(value)) : value as TableData;
            return { schema: data.columns.map(name => ({ name, type: "unknown" })), rows: data.rows };
        },
        export(input: unknown, raw?: unknown) {
            const options = optionsFor(target, raw), data = tableValue(input);
            let content: string;
            if (options.format === "json")
                content = stringifySplJson({ columns: data.columns, rows: data.rows })!;
            else {
                const delimiter = options.delimiter ?? (options.format === "tsv" ? "\t" : ",");
                if (delimiter.length !== 1)
                    throw new Error("CSV export delimiter must be one character");
                function encode(value: unknown): string {
                    let text = "";
                    if (value instanceof Date) text = value.toISOString();
                    else if (isDecimal(value)) text = String(value);
                    else if (value !== null && typeof value === "object") text = JSON.stringify(value);
                    else if (value != null) text = String(value);
                    if (text.includes(delimiter) || /["\r\n]|^\s|\s$/.test(text)) return `"${text.replace(/"/g, '""')}"`;
                    return text;
                }
                content = [data.columns.map(encode).join(delimiter), ...data.rows.map(row => data.columns.map(name => encode(row[name])).join(delimiter))].join("\r\n") + "\r\n";
            }
            writeAtomicFile(target, root, content);
            return { path: target, rows: data.rows.length, columns: [...data.columns] };
        },
        async cursor(options?: CsvCursorOptions) {
            if (!runtime?.allowAsync)
                throw new Error("File cursor requires async evaluateFlow or the host cursor API");
            assertInside(target, root);
            if (![".csv", ".tsv"].includes(extname(target).toLowerCase()))
                throw new Error("File cursor supports CSV/TSV; JSON import is an explicit materialization");
            const source = await openCsvCursor(target, { ...options, signal: options?.signal ?? runtime.signal, delimiter: options?.delimiter ?? (extname(target).toLowerCase() === ".tsv" ? "\t" : ",") });
            return runtime.own(source.cursor);
        },
    };
}
