import { parseJsonPreservingNumbers, stringifySplJson } from "depa-data-expression";
import { readFileSync } from "node:fs";
import { tableFromRecords, type TableData } from "../table-input";
import { queryTableSqlite } from "./query-table";
import type { DataSource, JsonConfig, QueryResult } from "./types";
export class JsonDataSource implements DataSource {
    readonly type = "json" as const;
    readonly name: string;
    private readonly config: JsonConfig;
    private data: TableData | null = null;
    constructor(config: JsonConfig) {
        this.name = config.name;
        this.config = config;
    }
    async query(sql: string, params?: unknown[]): Promise<QueryResult> {
        const data = this.loadData();
        return queryTableSqlite(data, "json_data", sql, params);
    }
    close(): void {
        this.data = null;
    }
    private loadData(): TableData {
        if (this.data)
            return this.data;
        const content = readFileSync(this.config.path, this.config.encoding || "utf-8");
        const jsonData = parseJsonPreservingNumbers(content) as unknown;
        let records: unknown[];
        if (this.config.arrayPath) {
            records = this.extractByPath(jsonData, this.config.arrayPath);
        }
        else if (Array.isArray(jsonData)) {
            records = jsonData;
        }
        else {
            records = [jsonData];
        }
        this.data = tableFromRecords(records);
        return this.data;
    }
    private extractByPath(data: unknown, path: string): unknown[] {
        const clean = path.replace(/^\$\./, "");
        const parts = clean.split(".");
        let current: any = data;
        for (const part of parts) {
            if (current == null)
                return [];
            current = current[part];
        }
        if (Array.isArray(current))
            return current;
        return current == null ? [] : [current];
    }
}
