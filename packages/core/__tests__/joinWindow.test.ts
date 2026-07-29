import { describe, expect, test } from "bun:test";
import { DataSet, createJoinStep, createWindowStep, Engine } from "../src";

describe("DataSet join", () => {
  const left = DataSet.fromRows([
    { id: 1, name: "alice", dept: "eng" },
    { id: 2, name: "bob", dept: "sales" },
    { id: 3, name: "carl", dept: "eng" },
  ]);
  const right = DataSet.fromRows([
    { dept: "eng", manager: "mike" },
    { dept: "hr", manager: "sara" },
  ]);

  test("inner join matches keys", () => {
    const joined = left.join(right, { type: "inner", leftKeys: ["dept"] });
    expect(joined.rows.length).toBe(2);
    expect(joined.rows[0]).toHaveProperty("manager", "mike");
  });

  test("left join fills nulls and disambiguates", () => {
    const joined = left.join(right, { type: "left", leftKeys: ["dept"], rightPrefix: "r_" });
    const bob = joined.rows.find((r) => r.name === "bob")!;
    expect(bob).toHaveProperty("manager", undefined);
    expect(joined.schema.some((c) => c.name === "manager")).toBe(true);
  });

  test("left join adds prefixed columns when names collide", () => {
    const leftWithManager = DataSet.fromRows([
      { id: 1, dept: "eng", manager: "local" },
      { id: 2, dept: "sales", manager: "local2" },
    ]);
    const joined = leftWithManager.join(right, { type: "left", leftKeys: ["dept"], rightPrefix: "r_" });
    const eng = joined.rows.find((r) => r.dept === "eng")!;
    expect(eng).toHaveProperty("manager", "local");
    expect(eng).toHaveProperty("r_manager", "mike");
  });

  test("left join keeps schema columns with undefined when no match", () => {
    const onlySales = DataSet.fromRows([{ id: 5, dept: "support" }]);
    const joined = onlySales.join(right, { type: "left", leftKeys: ["dept"] });
    expect(joined.rows[0]).toHaveProperty("manager", undefined);
    expect(joined.schema.some((c) => c.name === "manager")).toBe(true);
  });
});

describe("Window functions", () => {
  const base = DataSet.fromRows([
    { dept: "eng", salary: 10 },
    { dept: "eng", salary: 20 },
    { dept: "sales", salary: 15 },
  ]);

  test("row_number and running sums per partition", () => {
    const withWindow = base.window({
      partitionBy: ["dept"],
      orderBy: [{ column: "salary", direction: "asc" }],
      outputs: {
        rowNumber: "row_number",
        runningSum: { column: "salary" },
        runningAvg: { column: "salary" },
      },
    });
    const eng = withWindow.rows.filter((r) => r.dept === "eng");
    expect(eng.map((r) => r.row_number)).toEqual([1, 2]);
    expect(eng.map((r) => r.running_sum_salary)).toEqual([10, 30]);
    expect(eng.map((r) => r.running_avg_salary)).toEqual([10, 15]);
  });

  test("rank and dense_rank with ordering", () => {
    const withRank = base.window({
      partitionBy: ["dept"],
      orderBy: [{ column: "salary", direction: "desc" }],
      outputs: { rank: "rank", denseRank: "dense" },
    });
    const eng = withRank.rows.filter((r) => r.dept === "eng");
    expect(eng.map((r) => r.rank)).toEqual([1, 2]);
    expect(eng.map((r) => r.dense)).toEqual([1, 2]);
  });

  test("dense_rank handles ties", () => {
    const tied = DataSet.fromRows([
      { dept: "eng", salary: 10 },
      { dept: "eng", salary: 10 },
      { dept: "eng", salary: 5 },
    ]);
    const ranked = tied.window({
      partitionBy: ["dept"],
      orderBy: [{ column: "salary", direction: "desc" }],
      outputs: { rank: "rank", denseRank: "dense" },
    });
    const ranks = ranked.rows.map((r) => r.rank);
    const dense = ranked.rows.map((r) => r.dense);
    expect(ranks).toEqual([1, 1, 3]);
    expect(dense).toEqual([1, 1, 2]);
  });

  test("window without order throws", () => {
    expect(() =>
      base.window({
        partitionBy: ["dept"],
        orderBy: [],
        outputs: { rowNumber: "rn" },
      })
    ).toThrow(/orderBy/);
  });
});

describe("Join and window steps", () => {
  test("engine runs join and window steps", async () => {
    const left = DataSet.fromRows([
      { id: 1, dept: "eng", salary: 10 },
      { id: 2, dept: "sales", salary: 20 },
    ]);
    const right = DataSet.fromRows([
      { dept: "eng", manager: "m1" },
      { dept: "sales", manager: "m2" },
    ]);

    const loadLeft = { name: "left", execute: () => left };
    const loadRight = { name: "right", execute: () => right };
    const joinStep = createJoinStep("joined", { type: "inner", leftKeys: ["dept"], leftStep: "left", rightStep: "right" });
    const windowStep = createWindowStep("win", {
      sourceStep: "joined",
      spec: {
        partitionBy: ["dept"],
        orderBy: [{ column: "salary", direction: "desc" }],
        outputs: { rowNumber: "row_no" },
      },
    });

    const engine = new Engine();
    const results = await engine.run([loadLeft, loadRight, joinStep, windowStep]);
    const winDs = results.get("win") as any;
    expect(winDs.rows[0]).toHaveProperty("manager");
    expect(winDs.rows[0]).toHaveProperty("row_no", 1);
  });
});
