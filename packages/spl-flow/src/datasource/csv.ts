import { parseCsvTable, type TableData } from "../table-input";
import { readFileSync } from "node:fs";
import { queryTableSqlite } from "./query-table";
import type { CsvConfig, DataSource, QueryResult } from "./types";
export class CsvDataSource implements DataSource {
    readonly type = "csv" as const;
    readonly name: string;
    private data: TableData | null = null;
    constructor(private readonly config: CsvConfig) { this.name = config.name; }
    async query(sql: string, params?: unknown[]): Promise<QueryResult> {
        this.data ??= parseCsvTable(readFileSync(this.config.path, this.config.encoding || "utf-8"), { delimiter: this.config.delimiter, hasHeader: this.config.hasHeader });
        return queryTableSqlite(this.data, "csv_data", sql, params);
    }
    close(): void { this.data = null; }
}
