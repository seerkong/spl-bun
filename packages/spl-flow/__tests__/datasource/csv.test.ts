import { describe, expect, test } from "bun:test";
import { writeFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { CsvDataSource } from "../../src/datasource/csv";

function withTempFile(content: string, ext: string): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "spl-bun-csv-"));
  const path = join(dir, `data.${ext}`);
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

describe("CsvDataSource", () => {
  test("queries csv data with header", async () => {
    const file = withTempFile("id,name\n1,alpha\n2,beta", "csv");
    try {
      const ds = new CsvDataSource({ type: "csv", name: "sales", path: file.path });
      const result = await ds.query("select id, name from csv_data order by id");
      expect(result.columns).toEqual(["id", "name"]);
      expect(result.rows).toEqual([
        [1, "alpha"],
        [2, "beta"],
      ]);
    } finally {
      file.cleanup();
    }
  });
});
