import { expect, test } from "bun:test";
import { runSplKon, toQueryResult } from "../src";

test("uploaded tables are named DataSets per run, with empty schema and caller values intact", () => {
  const tables = { input: { columns: ["name", "qty"], rows: [{ name: "A", qty: 2 }] } };
  const scope = { fee: 3 };
  const result = runSplKon('(spl_derive :{ in = input cols = {total = "qty * fee"} })', { tables, scope });
  expect(toQueryResult(result.value)?.rows).toEqual([{ name: "A", qty: 2, total: 6 }]);
  expect(tables.input.rows).toEqual([{ name: "A", qty: 2 }]);
  expect(scope).toEqual({ fee: 3 });
  expect(toQueryResult(runSplKon("input", { tables: { input: { columns: ["name"], rows: [] } } }).value)).toEqual({ columns: ["name"], rows: [] });
  expect(() => runSplKon('(spl_select :{in = input})')).toThrow("input");
});
