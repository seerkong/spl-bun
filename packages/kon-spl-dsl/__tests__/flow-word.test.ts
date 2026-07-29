/**
 * spl_flow word 端到端测试（behavior delta kon-spl-dsl / spl-flow-sync）。
 *
 * - enable-spl-dsl/register-words：五个 spl_* word 全部注册。
 * - spl_flow 用 depa-data-spl-flow 的 evaluateFlowSync 整体执行 Conf.cells
 *   描述的 FlowCell 网格脚本，返回其 result（优先级锁定：result 命令值 →
 *   lastQuery → 最后表达式值；与 evaluateFlowSync 返回结构一致）。
 * - cells 的 map 值来自 Kon（KnUnorderedMap，值中裸标识符是 KnWord，
 *   经 knot-reader 的归一逻辑取 .Value）。
 * - FlowExecutionContext 派生：workspaceRoot、ctx.dataSources 中 sqlite
 *   数据源 → connections + 同步 adapter、scope 透传。
 *
 * 前置条件：本机存在 kunun 仓库（见本包 tsconfig paths），缺失时跳过。
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { detectKunun, KUNUN_RUNTIME_ENTRY } from "./helpers/kunun";

const kununAvailable = detectKunun(KUNUN_RUNTIME_ENTRY, "flow-word");

describe.skipIf(!kununAvailable)("spl_flow word", () => {
  let RuntimeInterpreter: any;
  let EnableSplDsl: any;
  let createSplContext: any;

  let workspaceRoot: string;
  const DB_FILE = "orders.db";

  beforeAll(async () => {
    ({ RuntimeInterpreter } = await import("kunun"));
    ({ EnableSplDsl, createSplContext } = await import("../src/index"));

    workspaceRoot = mkdtempSync(join(tmpdir(), "kon-spl-flow-"));
    const db = new Database(join(workspaceRoot, DB_FILE));
    db.run("CREATE TABLE orders (id INTEGER, amount REAL)");
    db.run("INSERT INTO orders VALUES (1, 100), (2, 200)");
    db.close();
  });

  afterAll(() => {
    if (workspaceRoot) rmSync(workspaceRoot, { recursive: true, force: true });
  });

  function setup(scope: Record<string, unknown> = {}): {
    runtime: any;
    ctx: any;
    run: (source: string) => any;
  } {
    const runtime = RuntimeInterpreter.CreateRuntime();
    const ctx = createSplContext({ workspaceRoot, scope });
    EnableSplDsl(runtime, ctx);
    const run = (source: string) =>
      RuntimeInterpreter.EvalBlockSourceWithRuntimeSync(runtime, source);
    return { runtime, ctx, run };
  }

  test("register-words：五个 spl_* word 全部注册（含 spl_flow）", () => {
    const { runtime } = setup();
    for (const w of [
      "spl_connect",
      "spl_query",
      "spl_execute",
      "spl_eval",
      "spl_flow",
    ]) {
      expect(runtime.getPrefixKeywordExpander(w)).toBeTruthy();
    }
  });

  test("纯表达式网格：r = 42（无 result 命令/查询时取最后表达式值）", () => {
    const { run } = setup();
    const r = run(
      `(spl_flow #r :{ cells = [{row = 1 col = "A" expr = "=1+1"} {row = 2 col = "A" expr = "=A1*20+2"}] })`,
    );
    expect(r).toBe(42);
  });

  test("与 evaluateFlowSync 返回结构一致（同 cells 直接跑 evaluateFlowSync 对照）", async () => {
    const { evaluateFlowSync } = await import("depa-data-spl-flow");
    const direct = evaluateFlowSync(
      [
        { row: 1, col: "A", expr: "=1+1" },
        { row: 2, col: "A", expr: "=A1*20+2" },
      ],
      {},
    );
    const lastValue = direct.cells[direct.cells.length - 1].result;
    const { run } = setup();
    const r = run(
      `(spl_flow #r :{ cells = [{row = 1 col = "A" expr = "=1+1"} {row = 2 col = "A" expr = "=A1*20+2"}] })`,
    );
    expect(direct.result).toBeUndefined();
    expect(direct.lastQuery).toBeUndefined();
    expect(r).toBe(lastValue);
  });

  test("cells map 值归一：col 用裸标识符（KnWord）时取 .Value", () => {
    const { run } = setup();
    const r = run(
      `(spl_flow #r :{ cells = [{row = 1 col = A expr = "=6*7"}] })`,
    );
    expect(r).toBe(42);
  });

  test("#name 绑定：r 在当前 env 定义，后续 spl_eval 可引用", () => {
    const { run } = setup();
    const n = run(`
      (spl_flow #r :{ cells = [{row = 1 col = "A" expr = "=1+1"}] })
      (spl_eval :{ expr = "r + 40" })
    `);
    expect(n).toBe(42);
  });

  test("FlowExecutionContext 派生：ctx.dataSources 的 sqlite 数据源在网格中可查（含 result 命令优先）", () => {
    const { run } = setup();
    const r = run(`
      (spl_connect #db :{ type = "sqlite" path = "${DB_FILE}" })
      (spl_flow #r :{ cells = [
        {row = 1 col = "A" expr = "db.query('select id, amount from orders order by id')"}
        {row = 2 col = "A" expr = "A1.derive({gross: 'amount*2'})"}
        {row = 3 col = "A" expr = "result A2"}
      ] })
    `);
    expect(Array.isArray(r.rows)).toBe(true);
    expect(r.rows).toEqual([
      { id: 1, amount: 100, gross: 200 },
      { id: 2, amount: 200, gross: 400 },
    ]);
  });

  test("scope 透传：ctx.scope 变量在网格表达式中可见", () => {
    const { run } = setup({ base: 40 });
    const r = run(
      `(spl_flow #r :{ cells = [{row = 1 col = "A" expr = "=base + 2"}] })`,
    );
    expect(r).toBe(42);
  });

  test("错误路径：cells 缺失/格式错报错；单元格求值失败报错", () => {
    const { run } = setup();
    expect(() => run(`(spl_flow :{ })`)).toThrow(/cells/);
    expect(() =>
      run(`(spl_flow :{ cells = [{row = 1 col = "A" expr = "=nope("}] })`),
    ).toThrow(/A1/);
  });
});
