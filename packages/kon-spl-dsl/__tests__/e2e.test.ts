/**
 * e2e 一致性测试（behavior delta kon-spl-dsl / spl-flow-sync / kon-grid-parity）。
 *
 * - kon-grid-parity：examples/basic.kon（spl_connect → spl_query → spl_eval
 *   选项糖 → Kon if 控制流 → spl_derive/spl_select 原生运算 → spl_groups →
 *   命名结果 big）经 EvalBlockSourceWithRuntimeSync 执行，与等价的 FlowCell
 *   网格脚本（connect/query/derive/select 对应格；Kon 侧原生 word 与网格侧
 *   透传表达式同引擎求值 → 等价）经 depa-data-spl-flow 的 evaluateFlowSync
 *   执行，最终 DataSet 结果一致。
 * - groups 断言（T2.2）：示例脚本新增的 spl_groups #byRegion 结果无网格等价
 *   形态（DataSet.aggregate 的聚合器是函数值，网格表达式不可表达），改为
 *   追加一行 `byRegion` 取值后与手工计算（同源数据逐组求和/计数）对照。
 * - csv 对照（P2 AttractorCheck 非阻塞观察 ③：context.ts 的 csv 解析为
 *   spl-flow parseCsvContent 的复制语义，需 e2e 锁定不漂移）：同一 csv 文件
 *   经 kon-spl-dsl 本地 csv 数据源读取 vs 经 spl-flow 网格 `T()` 读取，
 *   rows 一致。
 *
 * 归一比较规则（系统性差异说明，本测试锁定）：
 * - Kon 侧 spl_query 产出 DataSet 实例、derive/select 产出 {rows, schema}
 *   普通结构；网格侧全程为 {rows, schema} 普通结构 → 实例与普通结构不参与
 *   比较，统一归一为 { columns: schema 列名序列, rows } 后深比较。
 * - rows 深比较为精确相等（两侧同用 depa-data-expression 求值，含浮点尾差
 *   在内逐位一致，不做数值容差）。
 * - schema 只比较列名与列序，不比较 type：DataSet.deriveSchema 按首行
 *   typeof 推导（"number" 等），而网格 derive 追加列与 T() 固定 "unknown"
 *   —— 这是两侧 schema 唯一的系统性差异。
 *
 * 前置条件：本机存在 kunun 仓库（见 helpers/kunun.ts），缺失时跳过。
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import {
  evaluateFlowSync,
  type DBConnection,
  type FlowCell,
  type FlowExecutionContext,
} from "depa-data-spl-flow";
import { detectKunun, KUNUN_RUNTIME_ENTRY } from "./helpers/kunun";

const kununAvailable = detectKunun(KUNUN_RUNTIME_ENTRY, "e2e");

const EXAMPLE_PATH = join(import.meta.dir, "../examples/basic.kon");
const DB_FILE = "orders.db";
const CSV_FILE = "people.csv";

/** 归一：DataSet 实例 / {rows, schema} 普通结构 → { columns, rows }（见文件头规则） */
function normalizeDataSet(v: unknown): {
  columns: string[];
  rows: Record<string, unknown>[];
} {
  const ds = v as {
    rows?: Record<string, unknown>[];
    schema?: Array<{ name: string }>;
  };
  if (!ds || !Array.isArray(ds.rows)) {
    throw new Error(`期望 DataSet 形态（rows/schema），实际为 ${JSON.stringify(v)}`);
  }
  return {
    columns: (ds.schema ?? []).map((c) => c.name),
    rows: ds.rows,
  };
}

describe.skipIf(!kununAvailable)("kon-spl-dsl e2e 一致性", () => {
  let RuntimeInterpreter: any;
  let EnableSplDsl: any;
  let createSplContext: any;

  let workspaceRoot: string;
  let dbPath: string;

  beforeAll(async () => {
    ({ RuntimeInterpreter } = await import("kunun"));
    ({ EnableSplDsl, createSplContext } = await import("../src/index"));

    workspaceRoot = mkdtempSync(join(tmpdir(), "kon-spl-e2e-"));
    dbPath = join(workspaceRoot, DB_FILE);
    const db = new Database(dbPath);
    db.run("CREATE TABLE orders (id INTEGER, region TEXT, amount REAL)");
    db.run(
      "INSERT INTO orders VALUES (1, 'east', 100), (2, 'west', 200), (3, 'east', 300)",
    );
    db.close();

    writeFileSync(
      join(workspaceRoot, CSV_FILE),
      "id,name,score\n1,ann,90\n2,bob,75\n3,cy,88.5\n",
    );
  });

  afterAll(() => {
    if (workspaceRoot) rmSync(workspaceRoot, { recursive: true, force: true });
  });

  /** Kon 侧：fresh runtime + ctx，执行一段 Kon 源码取末值 */
  function runKon(source: string, scope: Record<string, unknown> = {}): unknown {
    const runtime = RuntimeInterpreter.CreateRuntime();
    const ctx = createSplContext({ workspaceRoot, scope });
    EnableSplDsl(runtime, ctx);
    return RuntimeInterpreter.EvalBlockSourceWithRuntimeSync(runtime, source);
  }

  /**
   * 网格侧 FlowExecutionContext：与 kon-spl-dsl 无共享代码的独立同步 sqlite
   * adapter（bun:sqlite 直连，返回 {rows, schema} 形态 —— 与生产 adapter
   * 返回 DataSet 的行为对齐，evaluateFlowSync 的同步可用路径见 findings T2.3）。
   */
  function makeGridCtx(): FlowExecutionContext {
    const connections = new Map<string, DBConnection>([
      ["db", { name: "db", type: "sqlite", path: dbPath }],
    ]);
    const run = (sql: string, params?: unknown[]) => {
      const database = new Database(dbPath);
      try {
        const stmt = database.query<Record<string, unknown>, never[]>(sql);
        const rows = params?.length ? stmt.all(...(params as never[])) : stmt.all();
        const names = rows.length > 0 ? Object.keys(rows[0]) : stmt.columnNames;
        return { rows, schema: names.map((name) => ({ name })) };
      } finally {
        database.close();
      }
    };
    return {
      workspaceRoot,
      connections,
      adapters: {
        sqliteQuery: ({ sql, params }) => run(sql, params),
        sqliteExecute: ({ sql, params }) => run(sql, params),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // kon-grid-parity：examples/basic.kon vs 等价网格脚本
  // ---------------------------------------------------------------------------

  test("kon-grid-parity：examples/basic.kon 与等价网格脚本最终 DataSet 一致", () => {
    // Kon 侧：读文件执行示例脚本（脚本末尾输出命名结果 big）
    const konResult = runKon(readFileSync(EXAMPLE_PATH, "utf-8"));

    // 网格侧：与 basic.kon 逐步对应的 FlowCell 脚本
    // A1 ↔ spl_connect + spl_query（网格经 connections 直接引用 db）
    // A2 ↔ spl_eval #years @y（同一选项改写：age@y）
    // A3–B5 ↔ (var rate (if ...))（网格 if 控制流）
    // A6 ↔ spl_derive #priced（Kon 侧原生 word "amount*rate"，网格侧等价
    //       透传表达式字符串拼接——两侧同引擎逐行求值，结果逐位一致）
    // A7/A8 ↔ spl_select #big + 末尾输出（select + result；Kon 侧的
    //       spl_groups #byRegion 无网格等价形态，由下一测试单独断言）
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: 'db.query("select id, region, amount from orders order by id")' },
      { row: 2, col: "A", expr: '=age@y("2020-06-15", "2026-03-01")' },
      { row: 3, col: "A", expr: "rate = 1.0" },
      { row: 4, col: "A", expr: "if A2 > 5" },
      { row: 5, col: "B", expr: "rate = 1.1" },
      { row: 6, col: "A", expr: "A1.derive({gross: concat('amount*', rate)})" },
      { row: 7, col: "A", expr: "A6.select('gross > 150')" },
      { row: 8, col: "A", expr: "result A7" },
    ];
    const gridRes = evaluateFlowSync(cells, makeGridCtx());
    expect(gridRes.cells.every((c) => c.status === "ok")).toBe(true);

    const kon = normalizeDataSet(konResult);
    const grid = normalizeDataSet(gridRes.result);

    // 归一后深比较：rows 精确相等（同引擎求值，含浮点尾差一致）；列名序一致
    expect(kon.rows).toEqual(grid.rows);
    expect(kon.columns).toEqual(grid.columns);

    // 反两侧同错的锚定断言：结果内容本身符合预期
    // （years=6 → rate=1.1 → gross=amount*1.1 → 过滤 gross>150 剩 id 2、3）
    expect(kon.columns).toEqual(["id", "region", "amount", "gross"]);
    expect(kon.rows.map((r) => r.id)).toEqual([2, 3]);
    expect(kon.rows[0].gross as number).toBeCloseTo(220);
    expect(kon.rows[1].gross as number).toBeCloseTo(330);
  });

  // ---------------------------------------------------------------------------
  // groups 断言（T2.2）：examples/basic.kon 的 spl_groups #byRegion 值正确
  // ---------------------------------------------------------------------------

  test("groups 断言：示例脚本的 spl_groups #byRegion 与手工计算对照", () => {
    // 追加一行取 byRegion 绑定为脚本值（#name 绑定对后续 Kon 表达式可见）
    const konResult = runKon(readFileSync(EXAMPLE_PATH, "utf-8") + "\nbyRegion");
    const byRegion = normalizeDataSet(konResult);

    // 手工计算对照（同源数据：id 1/east/100、2/west/200、3/east/300；
    // years=6 → rate=1.1 → gross=amount*1.1；分组在 priced 全表上、
    // 按行序 east 先于 west）：
    // - east: total = 100*1.1 + 300*1.1，cnt = 2
    // - west: total = 200*1.1，cnt = 1
    // 分组键经引擎 String() 归一（region 本为字符串，值不变）；
    // 求和顺序与 rows 输入序一致 → 浮点逐位可精确断言
    expect(byRegion.columns).toEqual(["region", "total", "cnt"]);
    expect(byRegion.rows).toEqual([
      { region: "east", total: 100 * 1.1 + 300 * 1.1, cnt: 2 },
      { region: "west", total: 200 * 1.1, cnt: 1 },
    ]);
  });

  // ---------------------------------------------------------------------------
  // csv 对照（P2 观察 ③）：本地 csv 数据源 vs spl-flow 网格 T()
  // ---------------------------------------------------------------------------

  test("csv 对照：kon-spl-dsl 本地 csv 数据源与网格 T() 读同一文件 rows 一致", () => {
    // Kon 侧：csv 数据源全量读取（无 sql）→ DataSet
    const konResult = runKon(`
      (spl_connect #people :{ type = "csv" path = "${CSV_FILE}" })
      (spl_query #rows :{ conn = people })
    `);

    // 网格侧：T() 同步读同一 csv（parseCsvContent 语义）
    const gridRes = evaluateFlowSync(
      [
        { row: 1, col: "A", expr: `T("${CSV_FILE}")` },
        { row: 2, col: "A", expr: "result A1" },
      ],
      { workspaceRoot },
    );
    expect(gridRes.cells.every((c) => c.status === "ok")).toBe(true);

    const kon = normalizeDataSet(konResult);
    const grid = normalizeDataSet(gridRes.result);

    // rows 精确一致（两侧同为 trim/空行过滤/数值归一语义：90、75、88.5 为 number）
    expect(kon.rows).toEqual(grid.rows);
    expect(kon.columns).toEqual(grid.columns);

    // 锚定断言：数值归一确实发生（字符串 "88.5" → number 88.5）
    expect(kon.rows).toEqual([
      { id: 1, name: "ann", score: 90 },
      { id: 2, name: "bob", score: 75 },
      { id: 3, name: "cy", score: 88.5 },
    ]);
  });
});
