import { describe, expect, test } from "bun:test";
import { AvgGather, DataSet, SumGather, runGather, unsupportedOperation } from "../src";

describe("DataSet operations", () => {
  const rows = [
    { id: 1, category: "a", value: 10 },
    { id: 2, category: "a", value: 15 },
    { id: 3, category: "b", value: 7 },
  ];

  test("project filters columns", () => {
    const ds = DataSet.fromRows(rows).project(["id", "value"]);
    expect(ds.rows[0]).toEqual({ id: 1, value: 10 });
    expect(ds.schema.map((c) => c.name)).toEqual(["id", "value"]);
  });

  test("filter narrows rows", () => {
    const ds = DataSet.fromRows(rows).filter((r) => Number(r.value) >= 10);
    expect(ds.rows.length).toBe(2);
    expect(ds.rows.map((r) => r.id)).toEqual([1, 2]);
  });

  test("aggregate groups and computes", () => {
    const ds = DataSet.fromRows(rows).aggregate({
      groupBy: ["category"],
      aggregates: {
        total: (group) => group.reduce((sum, r) => sum + Number(r.value ?? 0), 0),
        count: (group) => group.length,
      },
    });
    const sorted = ds.rows.sort((a, b) => String(a.category).localeCompare(String(b.category)));
    expect(sorted).toEqual([
      { category: "a", total: 25, count: 2 },
      { category: "b", total: 7, count: 1 },
    ]);
  });

  test("aggregateWithGather runs gather lifecycle", () => {
    const ds = DataSet.fromRows(rows);
    const aggregated = ds.aggregateWithGather({
      total: { type: "sum", field: "value" },
      avgVal: { type: "avg", field: "value" },
      count: { type: "count" },
    });
    expect(aggregated.rows[0]).toEqual({ total: 32, avgVal: 32 / 3, count: 3 });
  });

  test("runGather supports regather/finish style aggregation", () => {
    const ds = DataSet.fromRows(rows);
    const sumGather = new SumGather("value");
    const avgGather = new AvgGather("value");

    const firstPassSum = runGather(sumGather, ds.rows);
    const firstPassAvg = runGather(avgGather, ds.rows) as number;
    const secondPassSum = runGather(sumGather, [
      { value: firstPassSum },
      { value: firstPassSum },
    ]);

    expect(firstPassAvg).toBeCloseTo(32 / 3);
    expect(secondPassSum).toBe(64);
  });



  test("unsupported operations are rejected", () => {
    expect(() => unsupportedOperation("join")).toThrow(/Unsupported operator/);
  });
});
