/**
 * evaluateFlowSync — 与 evaluateFlow 的 grid-parity（behavior delta
 * kon-spl-dsl / spl-flow-sync / grid-parity case）。
 *
 * - 含 sqlite 查询（connections + 同步 sqliteQuery adapter）与 derive/select
 *   表达式的网格脚本：两路 cells 求值状态与最终 result 一致。
 * - 控制流（if/for/continue/result）小脚本：两路一致。
 * - 配置了真异步 adapter（返回 Promise）时 evaluateFlowSync 抛出明确错误
 *   提示改用 evaluateFlow。
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";

import {
  evaluateFlow,
  evaluateFlowSync,
  type DBConnection,
  type FlowCell,
  type FlowExecutionContext,
} from "../src";

let workDir: string;
let dbPath: string;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "spl-flow-sync-"));
  dbPath = join(workDir, "orders.db");
  const db = new Database(dbPath);
  db.run("CREATE TABLE orders (id INTEGER, amount REAL)");
  db.run("INSERT INTO orders VALUES (1, 100), (2, 200)");
  db.close();
});

afterAll(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

/** 同步 sqlite adapter（bun:sqlite 直连，返回值而非 Promise） */
function makeSyncSqliteCtx(): FlowExecutionContext {
  const connections = new Map<string, DBConnection>([
    ["db", { name: "db", type: "sqlite", path: dbPath }],
  ]);
  const run = (sql: string, params?: unknown[]) => {
    const database = new Database(dbPath);
    try {
      const stmt = database.query<Record<string, unknown>, never[]>(sql);
      const rows = params?.length ? stmt.all(...(params as never[])) : stmt.all();
      const columns = rows.length > 0 ? Object.keys(rows[0]) : stmt.columnNames;
      return { columns, rows };
    } finally {
      database.close();
    }
  };
  return {
    workspaceRoot: workDir,
    connections,
    adapters: {
      sqliteQuery: ({ sql, params }) => run(sql, params),
      sqliteExecute: ({ sql, params }) => run(sql, params),
    },
  };
}

describe("evaluateFlowSync grid parity", () => {
  test("sqlite 查询 + derive/select 网格：cells 状态与最终 result 两路一致", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: 'db.query("select id, amount from orders order by id")' },
      { row: 2, col: "A", expr: 'A1.derive({gross: "amount*2"})' },
      { row: 3, col: "A", expr: 'A2.select("gross > 250")' },
      { row: 4, col: "A", expr: "result A3" },
    ];

    const asyncRes = await evaluateFlow(cells, makeSyncSqliteCtx());
    const syncRes = evaluateFlowSync(cells, makeSyncSqliteCtx());

    expect(syncRes.cells).toEqual(asyncRes.cells);
    expect(syncRes.cells.every((c) => c.status === "ok")).toBe(true);
    expect(syncRes.result).toEqual(asyncRes.result);
    expect(syncRes.lastQuery).toEqual(asyncRes.lastQuery);
    expect(syncRes.scope.A2).toEqual(asyncRes.scope.A2);
    expect(syncRes.scope.A3).toEqual(asyncRes.scope.A3);

    const resultRows = (syncRes.result as { rows: Record<string, unknown>[] }).rows;
    expect(resultRows).toEqual([{ id: 2, amount: 200, gross: 400 }]);
  });

  test("纯表达式网格（=1+1 / =A1*20+2）：两路一致，末格 42", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "=1+1" },
      { row: 2, col: "A", expr: "=A1*20+2" },
    ];
    const asyncRes = await evaluateFlow(cells, {});
    const syncRes = evaluateFlowSync(cells, {});
    expect(syncRes.cells).toEqual(asyncRes.cells);
    expect(syncRes.scope.A2).toBe(42);
    expect(asyncRes.scope.A2).toBe(42);
  });

  test("控制流（if/for/continue/result）：两路一致", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "sum = 0" },
      { row: 2, col: "A", expr: "for 1,4" },
      { row: 3, col: "B", expr: "if A2 == 3" },
      { row: 4, col: "C", expr: "continue" },
      { row: 5, col: "B", expr: "sum += A2" },
      { row: 6, col: "A", expr: "result sum" },
    ];
    const asyncRes = await evaluateFlow(cells, {});
    const syncRes = evaluateFlowSync(cells, {});
    expect(syncRes.cells).toEqual(asyncRes.cells);
    expect(syncRes.result).toBe(7);
    expect(asyncRes.result).toBe(7);
  });

  test("真异步 adapter（返回 Promise）：evaluateFlowSync 抛错并提示改用 evaluateFlow", async () => {
    const makeCtx = (): FlowExecutionContext => ({
      connections: new Map<string, DBConnection>([["db", { name: "db", type: "sqlite" }]]),
      adapters: {
        sqliteQuery: async () => ({ columns: ["x"], rows: [{ x: 1 }] }),
      },
    });
    const cells: FlowCell[] = [{ row: 1, col: "A", expr: 'db.query("select 1 as x")' }];

    expect(() => evaluateFlowSync(cells, makeCtx())).toThrow(/evaluateFlow/);

    // 同一配置下 evaluateFlow 照常可用（既有异步契约不回归）
    const asyncRes = await evaluateFlow(cells, makeCtx());
    expect(asyncRes.cells[0].status).toBe("ok");
    expect((asyncRes.scope.A1 as { rows: unknown[] }).rows).toEqual([{ x: 1 }]);
  });
});
