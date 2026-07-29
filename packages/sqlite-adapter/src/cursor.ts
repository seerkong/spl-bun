import { Database, type SQLQueryBindings } from "bun:sqlite";
import { Cursor, type CursorOptions, type Row } from "depa-data-core";
export interface SqliteCursorOptions extends CursorOptions {
    observe?: (event: "open" | "read" | "close") => void;
}
/** Real sqlite statement iterator with an independently owned read-only handle.
 * No all(), pagination, or caller connection ownership is involved.
 */
export function openSqliteCursor(input: {
    dbPath: string;
    sql: string;
    params?: unknown[];
}, options: SqliteCursorOptions = {}) {
    const database = new Database(input.dbPath, { readonly: true });
    let closed = false;
    let release: () => void = () => { };
    function close(): void {
        if (closed)
            return;
        closed = true;
        try {
            release();
        }
        finally {
            database.close();
            options.observe?.("close");
        }
    }
    try {
        options.observe?.("open");
        const statement = database.query<Row, SQLQueryBindings[]>(input.sql);
        const iterator = statement.iterate(...(input.params ?? []) as SQLQueryBindings[]);
        release = () => { try {
            iterator.return?.();
        }
        finally {
            statement.finalize();
        } };
        const columns = [...statement.columnNames];
        const cursor = new Cursor<Row>({ next() { const result = iterator.next(); if (!result.done)
                options.observe?.("read"); return result; }, return() { close(); return { done: true, value: undefined }; } }, { ...options, columns });
        return { columns, cursor };
    }
    catch (error) {
        close();
        throw error;
    }
}
