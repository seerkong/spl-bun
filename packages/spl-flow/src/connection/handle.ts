import { makeDbHandle } from "depa-data-expression";
import type { DataSource } from "../datasource/types";
function normalizeQueryResult(result: {
    columns: string[];
    rows: unknown[][] | Record<string, unknown>[];
}) {
    const rows = result.rows.map((row) => {
        if (!Array.isArray(row)) {
            return row as Record<string, unknown>;
        }
        const record: Record<string, unknown> = {};
        result.columns.forEach((column, idx) => {
            record[column] = row[idx];
        });
        return record;
    });
    return { columns: result.columns, rows: rows as Record<string, unknown>[] };
}
export function createDataSourceHandle(dataSource: DataSource, cursorRuntime?: {
    allowAsync: boolean;
    own: (cursor: import("depa-data-expression").Cursor<Record<string, unknown>>) => unknown;
}) {
    return makeDbHandle({
        name: dataSource.name,
        type: dataSource.type,
        cursor: (sql?: string, ...params: unknown[]) => {
            if (!cursorRuntime?.allowAsync)
                throw new Error("Cursor requires async evaluateFlow or the host cursor API");
            if (!dataSource.cursor)
                throw new Error("This data source does not provide a streaming cursor");
            const cursor = dataSource.cursor(sql, params.length ? params : undefined);
            return cursor instanceof Promise ? cursor.then(value => cursorRuntime.own(value)) : cursorRuntime.own(cursor);
        },
        query: async (sql: string, ...params: unknown[]) => {
            const result = await dataSource.query(sql, params.length ? params : undefined);
            return normalizeQueryResult(result);
        },
        execute: dataSource.execute
            ? async (sql: string, ...params: unknown[]) => dataSource.execute!(sql, params.length ? params : undefined)
            : undefined,
        commit: async () => {
            if (dataSource.type === "sqlite") {
                await dataSource.execute?.("COMMIT", undefined);
            }
        },
        rollback: async () => {
            if (dataSource.type === "sqlite") {
                await dataSource.execute?.("ROLLBACK", undefined);
            }
        },
    });
}
