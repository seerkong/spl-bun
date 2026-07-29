import {
  ComposerRuntime,
  createComposerRuntime,
  createComputePipelineStep,
  createFilterPipelineStep,
  createJoinPipelineStep,
  createSqliteLoadStep,
  createWindowPipelineStep,
  runPipeline,
} from "../src";
import { DataSet } from "depa-data-core";
import { createSampleSqliteDb } from "depa-data-test-utils";

describe("composer runtime integration (runtime设计模式, no implicit DI)", () => {
  test("runs pipeline with sqlite load, join, compute, window, filter", async () => {
    const sample = createSampleSqliteDb();
    const runtime: ComposerRuntime = createComposerRuntime({ options: { defaultDbPath: sample.dbPath } });

    const loadItems = createSqliteLoadStep(runtime, "items", {
      sql: "SELECT id, name, price, active, CASE WHEN price > 10 THEN 'eng' ELSE 'sales' END AS dept FROM items",
    });
    const loadDepts = createSqliteLoadStep(runtime, "depts", {
      sql: "SELECT dept, manager FROM departments",
    });
    const joinStep = createJoinPipelineStep(runtime, "joined", {
      type: "left",
      leftKeys: ["dept"],
      leftStep: "items",
      rightStep: "depts",
    });
    const computeGross = createComputePipelineStep(runtime, "withGross", {
      sourceStep: "joined",
      columns: { gross: "price * 1.1" },
    });
    const windowStep = createWindowPipelineStep(runtime, "windowed", {
      sourceStep: "withGross",
      spec: {
        partitionBy: ["dept"],
        orderBy: [{ column: "gross", direction: "desc" }],
        outputs: { rowNumber: "row_no", runningSum: { column: "gross", expression: "gross", as: "running_gross" } },
      },
    });
    const filterStep = createFilterPipelineStep(runtime, "filtered", {
      sourceStep: "windowed",
      expression: "active = 1 and running_gross > 10",
    });

    const resultMap = await runPipeline(runtime, {
      steps: [loadItems, loadDepts, joinStep, computeGross, windowStep, filterStep],
    });

    const output = resultMap.get("filtered");
    expect(output instanceof DataSet).toBe(true);
    const rows = (output as DataSet).rows;
    // Only active items with gross > 10 remain; verify runtime-managed flow executed join/window/expressions.
    expect(rows.map((r) => r.name).sort()).toEqual(["gadget", "widget"]);
    expect(rows[0]).toHaveProperty("manager");
    expect(rows[0]).toHaveProperty("running_gross");

    sample.dispose();
  });
});
