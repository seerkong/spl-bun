import { describe, expect, test } from "bun:test";
import { writeFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { JsonDataSource } from "../../src/datasource/json";

function withTempFile(content: string): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "spl-bun-json-"));
  const path = join(dir, "data.json");
  writeFileSync(path, content, "utf-8");
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

describe("JsonDataSource", () => {
  test("queries json data", async () => {
    const file = withTempFile('[{"id":1,"name":"alpha"},{"id":2,"name":"beta"}]');
    try {
      const ds = new JsonDataSource({ type: "json", name: "users", path: file.path });
      const result = await ds.query("select id, name from json_data order by id");
      expect(result.columns).toEqual(["id", "name"]);
      expect(result.rows).toEqual([
        [1, "alpha"],
        [2, "beta"],
      ]);
    } finally {
      file.cleanup();
    }
  });

  test("stringifies nested json objects", async () => {
    const file = withTempFile('[{"id":1,"profile":{"tier":"gold"}}]');
    try {
      const ds = new JsonDataSource({ type: "json", name: "users", path: file.path });
      const result = await ds.query("select id, profile from json_data");
      expect(result.columns).toEqual(["id", "profile"]);
      expect(result.rows).toEqual([
        [1, "{\"tier\":\"gold\"}"],
      ]);
    } finally {
      file.cleanup();
    }
  });
});
