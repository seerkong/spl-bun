import { describe, expect, test } from "bun:test";
import { createSqliteStep, SQLiteAdapter } from "../src";
import { DataSet, Engine, createJoinStep, createWindowStep, type StepDefinition } from "depa-data-core";
import { createSampleSqliteDb } from "depa-data-test-utils";

describe("SQLite adapter", () => {
  test("executes parameterized query", () => {
    const fixture = createSampleSqliteDb();
    try {
      const ds = SQLiteAdapter.query({
        dbPath: fixture.dbPath,
        sql: "SELECT name, price FROM items WHERE active = ?",
        params: [1],
      });
      expect(ds.rows.length).toBe(2);
      expect(ds.schema.map((c) => c.name)).toEqual(["name", "price"]);
    } finally {
      fixture.dispose();
    }
  });

  test("integration via engine step", async () => {
    const fixture = createSampleSqliteDb();
    try {
      const load = createSqliteStep("load", {
        dbPath: fixture.dbPath,
        sql: "SELECT id, price FROM items",
      });

      const expensive: StepDefinition = {
        name: "expensive",
        execute: (ctx) => {
          const ds = ctx.getDataSet("load");
          return ds.filter((row) => Number(row.price) >= 10);
        },
      };

      const engine = new Engine();
      const results = await engine.run([load, expensive]);
      const filtered = results.get("expensive") as DataSet;
      expect(filtered.rows.length).toBe(2);
    } finally {
      fixture.dispose();
    }
  });

  test("join and window with adapter-fed datasets", async () => {
    const fixture = createSampleSqliteDb();
    try {
      const loadItems = createSqliteStep("items", {
        dbPath: fixture.dbPath,
        sql: "SELECT id, name, price, active, CASE WHEN active=1 THEN 'eng' ELSE 'sales' END AS dept FROM items",
      });
      const loadDepts = createSqliteStep("depts", {
        dbPath: fixture.dbPath,
        sql: "SELECT dept, manager FROM departments",
      });

      const joinStep = createJoinStep("joined", {
        type: "left",
        leftKeys: ["dept"],
        rightKeys: ["dept"],
        leftStep: "items",
        rightStep: "depts",
        rightPrefix: "r_",
      });

      const windowStep = createWindowStep("ranked", {
        sourceStep: "joined",
        spec: {
          partitionBy: ["dept"],
          orderBy: [{ column: "price", direction: "desc" }],
          outputs: { rowNumber: "row_no", runningSum: { column: "price" } },
        },
      });

      const engine = new Engine();
      const results = await engine.run([loadItems, loadDepts, joinStep, windowStep]);
      const ranked = results.get("ranked") as DataSet;
      expect(ranked.rows.some((r) => r.manager === "mike")).toBe(true);
      const engRows = ranked.rows.filter((r) => r.dept === "eng");
      expect(engRows[0]).toHaveProperty("row_no", 1);
      expect(engRows[0]).toHaveProperty("running_sum_price");
    } finally {
      fixture.dispose();
    }
  });
});
