import { Database } from "bun:sqlite";
import type { DataSet, Row, ColumnSchema, StepDefinition } from "depa-data-core";
import { DataSet as CoreDataSet } from "depa-data-core";

export interface QueryOptions {
  dbPath: string;
  sql: string;
  params?: unknown[];
}

export class SQLiteAdapter {
  readonly dbPath: string;
  private db: Database;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.db = new Database(dbPath, { create: true, readwrite: true });
  }

  execute(options: Omit<QueryOptions, "dbPath">): DataSet {
    const stmt = this.db.prepare(options.sql);
    const rows = (stmt as any).all(...((options.params ?? []) as any[])) as Row[];
    const columnNames = (stmt as any).columnNames ?? [];
    const schema = deriveSchema(rows, columnNames);
    return new CoreDataSet(schema, rows);
  }

  close(): void {
    this.db.close();
  }

  static query(options: QueryOptions): DataSet {
    const adapter = new SQLiteAdapter(options.dbPath);
    try {
      return adapter.execute({ sql: options.sql, params: options.params });
    } finally {
      adapter.close();
    }
  }
}

export function createSqliteStep(name: string, options: QueryOptions): StepDefinition {
  return {
    name,
    execute: () => SQLiteAdapter.query(options),
  };
}

function deriveSchema(rows: Row[], columnNames: string[]): ColumnSchema[] {
  if (rows.length === 0) {
    return columnNames.map((name) => ({ name, type: "unknown" }));
  }
  if (columnNames.length === 0) {
    columnNames = Object.keys(rows[0]);
  }
  return columnNames.map((name) => ({ name, type: typeof (rows[0] as Row)[name] }));
}
