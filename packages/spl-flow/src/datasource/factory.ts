import type { DataSource, DataSourceConfig } from "./types";
import { CsvDataSource } from "./csv";
import { JsonDataSource } from "./json";
import { SqliteDataSource } from "./sqlite";

export class DataSourceFactory {
  static create(config: DataSourceConfig): DataSource {
    switch (config.type) {
      case "sqlite":
        return new SqliteDataSource(config);
      case "csv":
        return new CsvDataSource(config);
      case "json":
        return new JsonDataSource(config);
      default:
        throw new Error(`Unsupported data source type: ${(config as DataSourceConfig).type}`);
    }
  }
}
