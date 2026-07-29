import { describe, expect, test } from "bun:test";
import { evaluateFlow } from "../../src";
import { writeFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

function withTempFile(content: string, ext: string): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), `spl-bun-${ext}-`));
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

describe("Flow dataSourceConfigs", () => {
  test("exposes data sources in scope", async () => {
    const csvFile = withTempFile("id,name\n1,alpha\n2,beta", "csv");
    const jsonFile = withTempFile('[{"id":1,"name":"alpha"}]', "json");
    try {
      const result = await evaluateFlow(
        [{ row: 1, col: "A", expr: 'sales.query("select id, name from csv_data")' }],
        {
          dataSourceConfigs: [
            { type: "csv", name: "sales", path: csvFile.path },
            { type: "json", name: "users", path: jsonFile.path },
          ],
        },
      );
      expect(result.cells[0].status).toBe("ok");
      const payload = await result.cells[0].result;
      expect(payload).toEqual({
        columns: ["id", "name"],
        rows: [
          { id: 1, name: "alpha" },
          { id: 2, name: "beta" },
        ],
      });
    } finally {
      csvFile.cleanup();
      jsonFile.cleanup();
    }
  });
});
