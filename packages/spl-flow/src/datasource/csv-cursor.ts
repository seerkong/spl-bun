import { createReadStream } from "node:fs";
import { parse } from "csv-parse";
import { Cursor, type CursorOptions } from "depa-data-expression";
import { csvValue } from "../table-input";
export interface CsvCursorOptions extends CursorOptions {
    delimiter?: string;
    hasHeader?: boolean;
    inferTypes?: boolean;
    observe?: (event: "open" | "read" | "close", bytesRead: number) => void;
}
export async function openCsvCursor(path: string, options: CsvCursorOptions = {}) {
    const input = createReadStream(path, { encoding: "utf8", highWaterMark: 32768 });
    const parser = parse({ bom: true, delimiter: options.delimiter ?? ",", trim: true, skip_empty_lines: true, max_record_size: 1024 * 1024 });
    const onError = (error: Error) => parser.destroy(error);
    input.on("error", onError);
    input.pipe(parser);
    const iterator = parser[Symbol.asyncIterator]() as unknown as AsyncIterator<string[]>;
    let closed = false;
    async function close(): Promise<void> {
        if (closed)
            return;
        closed = true;
        input.unpipe(parser);
        input.destroy();
        parser.destroy();
        try {
            await iterator.return?.();
        }
        finally {
            input.removeListener("error", onError);
            options.observe?.("close", input.bytesRead);
        }
    }
    const aborted = () => { input.destroy(); parser.destroy(new Error("CSV cursor cancelled")); };
    options.signal?.addEventListener("abort", aborted, { once: true });
    if (options.signal?.aborted)
        aborted();
    try {
        options.observe?.("open", input.bytesRead);
        const first = await iterator.next();
        const record = first.done ? [] : first.value as string[];
        const header = options.hasHeader !== false;
        const columns = record.map((value, index) => header ? value.trim() || `col${index + 1}` : `col${index + 1}`);
        if (columns.length > 512 || new Set(columns).size !== columns.length)
            throw new Error("CSV cursor invalid or excessive column headers");
        let initial = header || first.done ? undefined : record;
        const cursor = new Cursor<Record<string, unknown>>({ async next() {
                const next = initial ? { done: false, value: initial } : await iterator.next();
                initial = undefined;
                if (next.done)
                    return { done: true, value: undefined };
                const values = next.value as string[];
                if (values.length > columns.length)
                    throw new Error("CSV cursor row has more fields than header");
                options.observe?.("read", input.bytesRead);
                return { done: false, value: Object.fromEntries(columns.map((name, index) => [name, values[index] === undefined ? null : options.inferTypes === false ? values[index] : csvValue(values[index])])) };
            }, async return() { options.signal?.removeEventListener("abort", aborted); await close(); return { done: true, value: undefined }; } }, { ...options, columns });
        return { columns, cursor };
    }
    catch (error) {
        options.signal?.removeEventListener("abort", aborted);
        await close();
        throw error;
    }
}
