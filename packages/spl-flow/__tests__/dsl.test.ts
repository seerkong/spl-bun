import { describe, expect, test } from "bun:test";
import { buildFlowScope, evaluateFlow, type FlowCell } from "../src";

describe("spl-flow evaluation", () => {
  test("evaluates expressions and stores results by cell ref", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "a + b" },
      { row: 2, col: "A", expr: "A1 + 3" },
    ];
    const result = await evaluateFlow(cells, { scope: { a: 2, b: 3 } });
    expect(result.cells[0].status).toBe("ok");
    expect(result.scope.A1).toBe(5);
    expect(result.scope.A2).toBe(8);
  });

  test("uses db handles for query member calls", async () => {
    const calls: any[] = [];
    const connections = new Map([["demo", { name: "demo", type: "sqlite" }]]);
    const scope = buildFlowScope({
      connections,
      defaultDbPath: "db.sqlite",
      adapters: { sqliteQuery: (opts) => calls.push(opts) },
    });
    const result = await evaluateFlow(
      [{ row: 1, col: "A", expr: `demo.query("select * from t where id = ?", 7)` }],
      {
        scope,
        connections,
        defaultDbPath: "db.sqlite",
        adapters: { sqliteQuery: (opts) => calls.push(opts) },
      },
    );
    expect(result.cells[0].status).toBe("ok");
    expect(calls.length).toBe(1);
    expect(calls[0].sql).toBe("select * from t where id = ?");
    expect(calls[0].params).toEqual([7]);
  });

  test("flags unknown connection in scope lookup", async () => {
    const result = await evaluateFlow([{ row: 1, col: "A", expr: "unknown.query(\"select 1\")" }], {
      scope: {},
      connections: new Map(),
      adapters: { sqliteQuery: () => null },
    });
    expect(result.cells[0].status).toBe("error");
    expect(result.cells[0].error).toContain("Connection 'unknown' not found");
  });

  test("uses dataSourceConfigs for query member calls", async () => {
    const cells: FlowCell[] = [{ row: 1, col: "A", expr: `sales.query("select id from csv_data")` }];
    const result = await evaluateFlow(cells, {
      dataSourceConfigs: [{ type: "csv", name: "sales", path: "./sample.csv" }],
    });
    expect(result.cells[0].status).toBe("error");
    expect(String(result.cells[0].error)).toContain("no such file or directory");
    expect(result.cells[0].error).toBeDefined();
  });

  test("execute-only expressions do not assign to scope", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "x = 1" },
      { row: 2, col: "A", expr: ">x + 1" },
      { row: 3, col: "A", expr: "x" },
    ];

    const result = await evaluateFlow(cells, {});
    expect(result.cells.every((cell) => cell.status === "ok")).toBe(true);
    expect(result.scope.A1).toBe(1);
    expect("A2" in result.scope).toBe(false);
    expect(result.scope.A3).toBe(1);
    const executeOnlyCell = result.cells.find((cell) => cell.row === 2 && cell.col === "A");
    expect(executeOnlyCell?.result).toBe(2);
  });

  test("execute-only expressions update lastQuery", async () => {
    const connections = new Map([["demo", { name: "demo", type: "sqlite" }]]);
    const queryResult = { columns: ["v"], rows: [{ v: 1 }] };
    const result = await evaluateFlow([{ row: 1, col: "A", expr: `>demo.query("select 1 as v")` }], {
      connections,
      defaultDbPath: "db.sqlite",
      adapters: { sqliteQuery: () => queryResult },
    });

    expect(result.cells[0].status).toBe("ok");
    expect("A1" in result.scope).toBe(false);
    expect(result.lastQuery).toEqual(queryResult);
  });
});

test('Flow uses shared exact formatting and reports protocol errors before null/string shortcuts', async () => {
  const amount = '-1e-400';
  const result = await evaluateFlow([
    { row: 1, col: 'A', expr: "format('%e',decimal(amount))" },
    { row: 2, col: 'A', expr: "string(decimal(amount),'0.000;(0.000)')" },
    { row: 3, col: 'A', expr: "string('x',123)" },
    { row: 4, col: 'A', expr: "format('%tq',null)" },
  ], { scope: { amount } });
  expect(result.scope.A1).toBe('-1.000000e-400');
  expect(result.scope.A2).toBe('(0.000)');
  expect(result.cells.slice(2).map(cell => cell.status)).toEqual(['error','error']);
  expect(result.cells[2].error).toContain('pattern');
  expect(result.cells[3].error).toContain('conversion');
  expect(result.scope.amount).toBe(amount);
});

test('Flow shares null character and floating precision, uppercase and validation semantics', async () => {
  const result=await evaluateFlow([
    {row:1,col:'A',expr:"format('%1$c/%<C/%<8.2e/%<E/%<-6.2G',value)"},
    {row:2,col:'A',expr:"format('%.1c',value)"},
    {row:3,col:'A',expr:"format('%#g',value)"},
  ],{scope:{value:null}});
  expect(result.cells.map(cell=>cell.status)).toEqual(['ok','error','error']);
  expect(result.scope.A1).toBe('null/NULL/      nu/NULL/NU    ');
  expect(result.cells[1].error).toContain('precision');
  expect(result.cells[2].error).toContain('flags');
  expect(result.scope.value).toBeNull();
});
