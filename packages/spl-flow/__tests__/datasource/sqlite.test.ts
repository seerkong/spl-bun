import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { Database } from "bun:sqlite";
import { SqliteDataSource } from "../../src/datasource/sqlite";

function createSampleDb(): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "spl-bun-sqlite-"));
  const path = join(dir, "sample.db");
  const db = new Database(path, { create: true, readwrite: true });
  db.run("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)");
  db.run("INSERT INTO items (name) VALUES ('alpha'), ('beta'), ('gamma')");
  db.close();
  return {
    path,
    cleanup: () => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    },
  };
}

describe("SqliteDataSource", () => {
  test("queries sqlite database", async () => {
    const sample = createSampleDb();
    try {
      const ds = new SqliteDataSource({ type: "sqlite", name: "demo", path: sample.path });
      const result = await ds.query("select id, name from items order by id");
      expect(result.columns).toEqual(["id", "name"]);
      expect(result.rows.length).toBe(3);
    } finally {
      sample.cleanup();
    }
  });
});
