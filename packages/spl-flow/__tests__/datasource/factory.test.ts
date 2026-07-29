import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { DataSourceFactory } from "../../src/datasource/factory";

function withTempDir(prefix: string): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  return {
    dir,
    cleanup: () => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    },
  };
}

describe("DataSourceFactory", () => {
  test("creates sqlite/csv/json sources", () => {
    const temp = withTempDir("spl-bun-ds-");
    try {
      const sqlitePath = join(temp.dir, "db.sqlite");
      const csvPath = join(temp.dir, "data.csv");
      const jsonPath = join(temp.dir, "data.json");
      writeFileSync(csvPath, "id,name\n1,alpha", "utf-8");
      writeFileSync(jsonPath, "[]", "utf-8");
      expect(DataSourceFactory.create({ type: "sqlite", name: "db", path: sqlitePath }).type).toBe("sqlite");
      expect(DataSourceFactory.create({ type: "csv", name: "csv", path: csvPath }).type).toBe("csv");
      expect(DataSourceFactory.create({ type: "json", name: "json", path: jsonPath }).type).toBe("json");
    } finally {
      temp.cleanup();
    }
  });
});
