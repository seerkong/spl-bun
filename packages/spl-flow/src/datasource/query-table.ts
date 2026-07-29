import { Database, type SQLQueryBindings } from "bun:sqlite";
import type { TableData } from "../table-input";
import type { QueryResult } from "./types";
import { normalizeSqliteParams, coerceSqliteBindingValue } from "./sqlite-bindings";
/** Shared synchronous SQL projection for both synchronous Kon and async flow
 * adapters. No SQLite affinity is declared, so imported scalar types survive.
 */
export function queryTableSqlite(data: TableData, tableName: "csv_data" | "json_data", sql: string, params?: unknown[]): QueryResult {
    if (!data.columns.length)
        throw new Error("Cannot query a table with no declared columns");
    const database = new Database(":memory:");
    try {
        const columns = data.columns.map(name => `"${name.replace(/"/g, '""')}"`);
        database.run(`CREATE TABLE ${tableName} (${columns.join(",")})`);
        const insert = database.prepare(`INSERT INTO ${tableName} VALUES (${columns.map(() => "?").join(",")})`);
        database.transaction(() => {
            for (const row of data.rows)
                insert.run(...data.columns.map(name => {
                    const value = row[name];
                    return coerceSqliteBindingValue(value !== null && typeof value === "object" ? JSON.stringify(value) : value);
                }));
        })();
        const statement = database.query<Record<string, unknown>, SQLQueryBindings[]>(sql);
        const rows = statement.all(...(normalizeSqliteParams(params) ?? []));
        const names = statement.columnNames;
        return { columns: names, rows: rows.map(row => names.map(name => row[name])) };
    }
    finally {
        database.close();
    }
}
