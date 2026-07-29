import { describe, expect, test } from "bun:test";
import { DataSet, Engine, StepDefinition } from "../src";

describe("Engine execution", () => {
  test("executes steps sequentially with dependencies", async () => {
    const load: StepDefinition = {
      name: "load",
      execute: () => DataSet.fromRows([
        { id: 1, flag: true },
        { id: 2, flag: false },
      ]),
    };

    const filter: StepDefinition = {
      name: "filter",
      execute: (ctx) => {
        const ds = ctx.getDataSet("load");
        return ds.filter((row) => row.flag === true);
      },
    };

    const engine = new Engine();
    const results = await engine.run([load, filter]);
    const filtered = results.get("filter") as DataSet;
    expect(filtered.rows).toEqual([{ id: 1, flag: true }]);
  });

  test("fails when dependency missing", async () => {
    const badStep: StepDefinition = {
      name: "dependent",
      execute: (ctx) => ctx.getDataSet("missing"),
    };

    const engine = new Engine();
    await expect(engine.run([badStep])).rejects.toThrow(/dependent/);
  });
});
