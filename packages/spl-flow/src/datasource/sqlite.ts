import { Database, type SQLQueryBindings } from "bun:sqlite";
import type { DataSource, QueryResult, SqliteConfig } from "./types";
import { normalizeSqliteParams } from "./sqlite-bindings";
import { openSqliteCursor } from "depa-data-sqlite-adapter";

export class SqliteDataSource implements DataSource {
  readonly type = "sqlite" as const;
  readonly name: string;
  private db: Database | null;
  private readonly path:string;

  constructor(config: SqliteConfig) {
    this.name = config.name;
    this.db = new Database(config.path);
    this.path=config.path;
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    if(!this.db)throw new Error("Data source is closed");
    const stmt = this.db.query<Record<string, unknown>, SQLQueryBindings[]>(sql);
    const bindings = normalizeSqliteParams(params);
    const rows = bindings ? stmt.all(...bindings) : stmt.all();
    const columns = rows.length > 0 ? Object.keys(rows[0]) : stmt.columnNames;
    const rowArrays = rows.map((row) => columns.map((col) => (row as Record<string, unknown>)[col]));
    return { columns, rows: rowArrays };
  }

  async execute(sql: string, params?: unknown[]): Promise<{ changes: number }> {
    if(!this.db)throw new Error("Data source is closed");
    const stmt = this.db.query<unknown, SQLQueryBindings[]>(sql);
    const bindings = normalizeSqliteParams(params);
    const result = bindings ? stmt.run(...bindings) : stmt.run();
    const changes = typeof result.changes === "number" ? result.changes : 0;
    return { changes };
  }

  cursor(sql?:string,params?:unknown[]){
    if(!this.db)throw new Error("Data source is closed");
    if(!sql)throw new Error("SQLite cursor requires SQL");
    return openSqliteCursor({dbPath:this.path,sql,params}).cursor;
  }
  close(): void {
    this.db?.close();this.db=null;
  }
}
