export interface QueryResult {
  columns: string[];
  rows: unknown[][];
}

export interface DataSource {
  type: "sqlite" | "csv" | "json";
  name: string;
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  execute?(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  close?(): void | Promise<void>;
  cursor?(sql?: string, params?: unknown[]): Cursor<Record<string,unknown>> | Promise<Cursor<Record<string,unknown>>>;
}

export interface SqliteConfig {
  type: "sqlite";
  name: string;
  path: string;
}

export interface CsvConfig {
  type: "csv";
  name: string;
  path: string;
  delimiter?: string;
  hasHeader?: boolean;
  encoding?: BufferEncoding;
}

export interface JsonConfig {
  type: "json";
  name: string;
  path: string;
  encoding?: BufferEncoding;
  arrayPath?: string;
}

export type DataSourceConfig = SqliteConfig | CsvConfig | JsonConfig;
import type { Cursor } from "depa-data-expression";
