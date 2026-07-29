import { DataSet } from "../src/dataset";
import {
  Engine,
  createComputeStep,
  createFilterStep,
  createJoinStep,
  createWindowStep,
  type JoinStepConfig,
} from "../src/execution";

describe("expression-driven dataset operations", () => {
  test("filterExpr filters rows using expression strings", () => {
    const ds = DataSet.fromRows([
      { id: 1, amount: 50, status: "open" },
      { id: 2, amount: 20, status: "closed" },
      { id: 3, amount: 75, status: "open" },
    ]);
    const filtered = ds.filterExpr("amount > 30 and status == \"open\"");
    expect(filtered.rows.map((r) => r.id)).toEqual([1, 3]);
  });

  test("withComputedColumns adds derived values", () => {
    const ds = DataSet.fromRows([{ id: 1, amount: 10 }, { id: 2, amount: 5 }]);
    const withTax = ds.withComputedColumns({ gross: "amount * 1.1" });
    expect(withTax.rows.map((r) => r.gross)).toEqual([11, 5.5]);
  });

  test("join supports expression keys for matching", () => {
    const left = DataSet.fromRows([
      { customerId: "a1", amount: 10 },
      { customerId: "b2", amount: 20 },
    ]);
    const right = DataSet.fromRows([
      { cust: "A1", region: "north" },
      { cust: "C3", region: "south" },
    ]);

    const joinConfig: JoinStepConfig = {
      name: "join",
      type: "left",
      leftKeys: ["customerId"],
      rightKeys: ["cust"],
      leftKeyExprs: ["upper(customerId)"],
      rightKeyExprs: ["upper(cust)"],
      leftStep: "left",
      rightStep: "right",
    };

    const joined = left.join(right, joinConfig);
    expect(joined.rows).toHaveLength(2);
    expect(joined.rows[0].region).toBe("north");
    expect(joined.rows[1].region).toBeUndefined();
  });

  test("window running sums can use expressions", () => {
    const ds = DataSet.fromRows([
      { id: 1, value: 10 },
      { id: 2, value: 20 },
      { id: 3, value: 30 },
    ]);
    const windowed = ds.window({
      orderBy: [{ column: "id" }],
      outputs: { runningSum: { column: "value", as: "adj_sum", expression: "value * 1.1" } },
    });
    expect(windowed.rows.map((r) => r.adj_sum)).toEqual([11, 33, 66]);
  });
});

describe("expression-driven engine steps", () => {
  test("compute and filter steps evaluate expressions with context scope", async () => {
    const engine = new Engine();
    const base = DataSet.fromRows([
      { id: 1, amount: 40 },
      { id: 2, amount: 5 },
      { id: 3, amount: 30 },
    ]);

    const steps = [
      {
        name: "source",
        execute: () => base,
      },
      createComputeStep("withGross", {
        sourceStep: "source",
        columns: { gross: "amount * 1.2" },
      }),
      createFilterStep("filtered", {
        sourceStep: "withGross",
        expression: "gross > threshold",
        scope: { threshold: 20 },
      }),
    ];

    const results = await engine.run(steps);
    const filtered = results.get("filtered") as DataSet;
    expect(filtered.rows.map((r) => r.id)).toEqual([1, 3]);
  });
});
