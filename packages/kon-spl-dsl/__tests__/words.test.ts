/**
 * words 端到端测试：EnableSplDsl 注册 spl_connect / spl_query / spl_execute /
 * spl_eval 四个 prefix keyword word，并用 RuntimeInterpreter 跑真实 Kon 源码。
 * （spl_flow 端到端见 flow-word.test.ts。）
 *
 * 覆盖 behavior delta（kon-spl-dsl）的端到端 case：
 * - enable-spl-dsl/register-words：word 注册后可在 Kon 源码中调用。
 * - datasource-words/sqlite-roundtrip：spl_connect + spl_query 结果与直接
 *   查询一致；conn 支持变量引用（env 绑定的句柄）与字符串名两种。
 * - spl-eval-passthrough/scope-merge：ctx.scope ⊕ Kon env 可见变量 ⊕ Conf.with
 *  （后覆盖前）；DataSet 继续流转。
 *   注意（findings 记录的引擎事实）：通用 expression parser 不支持 SPL param
 *   风格 `:alias` 实参（derive(amount*rate:gross)），且 derive 的 record 形态
 *   内层表达式只以行记录为 scope（外层 rate 不可见）→ 锁定引擎真实支持的
 *   写法 `orders.derive({gross: concat('amount*', rate)})`（rate 在外层求值后拼进
 *   列表达式）；delta.xml 的 scope-merge case 已同步修订。
 * - spl-options/metadata-opt、attr-sugar、conflict-error：引擎 builtins 无
 *   interval，member registry 无 pos → 用真实存在且选项可观测的 age
 *  （age(start,end)=按月日修正的年龄，age@y=整年差）锁定端到端行为；
 *   delta.xml 对应 case 已同步修订。
 * - knot-reading/named-result-binding：#name 时结果 push + 在当前 env 定义
 *   同名变量（kunun RuntimeState.define 公开 API，实测可行）。
 * - 错误路径：未知 conn 名、sqlite 缺 sql、spl_eval 缺 expr。
 *
 * 前置条件：本机存在 kunun 仓库（见本包 tsconfig paths），缺失时跳过。
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { DataSet } from "depa-data-core";
import { detectKunun, KUNUN_RUNTIME_ENTRY } from "./helpers/kunun";

const kununAvailable = detectKunun(KUNUN_RUNTIME_ENTRY, "words");

describe.skipIf(!kununAvailable)("EnableSplDsl words", () => {
  let RuntimeInterpreter: any;
  let EnableSplDsl: any;
  let createSplContext: any;
  let openDataSource: any;

  let workspaceRoot: string;
  const DB_FILE = "orders.db";

  beforeAll(async () => {
    ({ RuntimeInterpreter } = await import("kunun"));
    ({ EnableSplDsl, createSplContext, openDataSource } = await import(
      "../src/index"
    ));

    workspaceRoot = mkdtempSync(join(tmpdir(), "kon-spl-words-"));
    const db = new Database(join(workspaceRoot, DB_FILE));
    db.run("CREATE TABLE orders (id INTEGER, amount REAL)");
    db.run("INSERT INTO orders VALUES (1, 100), (2, 200)");
    db.close();
  });

  afterAll(() => {
    if (workspaceRoot) rmSync(workspaceRoot, { recursive: true, force: true });
  });

  /** 每个测试独立的 runtime + ctx（数据源注册表互不串扰） */
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

  // -------------------------------------------------------------------------
  // enable-spl-dsl / register-words
  // -------------------------------------------------------------------------

  test("register-words：五个 word 注册成功", () => {
    const { runtime } = setup();
    for (const w of ["spl_connect", "spl_query", "spl_execute", "spl_eval", "spl_flow"]) {
      expect(runtime.getPrefixKeywordExpander(w)).toBeTruthy();
    }
  });

  // -------------------------------------------------------------------------
  // datasource-words / sqlite-roundtrip
  // -------------------------------------------------------------------------

  test("sqlite-roundtrip：spl_connect + spl_query 结果与直接查询一致", () => {
    const { run } = setup();
    const rows = run(`
      (spl_connect #db :{ type = "sqlite" path = "${DB_FILE}" })
      (spl_query #rows :{ conn = db sql = "select id, amount from orders order by id" })
    `);
    expect(rows).toBeInstanceOf(DataSet);
    const direct = new Database(join(workspaceRoot, DB_FILE))
      .query("select id, amount from orders order by id")
      .all();
    expect(rows.rows).toEqual(direct as any[]);
    expect(rows.schema.map((c: any) => c.name)).toEqual(["id", "amount"]);
  });

  test("conn 字符串名形态：conn = \"db\" 经 ctx.dataSources 注册表解析", () => {
    const { run } = setup();
    const rows = run(`
      (spl_connect #db :{ type = "sqlite" path = "${DB_FILE}" })
      (spl_query :{ conn = "db" sql = "select count(*) as n from orders" })
    `);
    expect(rows.rows).toEqual([{ n: 2 }]);
  });

  test("conn 变量引用形态：注册表无此名时回退 Kon env 绑定的句柄", () => {
    const { ctx, run } = setup();
    run(`(spl_connect #db :{ type = "sqlite" path = "${DB_FILE}" })`);
    // 删除注册表条目，仅剩 #db 的 env 绑定 → 走变量引用（句柄）路径
    ctx.dataSources.delete("db");
    const rows = run(
      `(spl_query :{ conn = db sql = "select count(*) as n from orders" })`,
    );
    expect(rows.rows).toEqual([{ n: 2 }]);
  });

  test("spl_connect 返回句柄且注册进 ctx.dataSources", () => {
    const { ctx, run } = setup();
    const handle = run(
      `(spl_connect #db :{ type = "sqlite" path = "${DB_FILE}" })`,
    );
    expect(typeof handle.query).toBe("function");
    expect(ctx.dataSources.get("db")).toBe(handle);
  });

  test("spl_connect 缺名字（无 #name 且 Conf 无 name）报错", () => {
    const { run } = setup();
    expect(() =>
      run(`(spl_connect :{ type = "sqlite" path = "${DB_FILE}" })`),
    ).toThrow(/name/);
  });

  // -------------------------------------------------------------------------
  // spl_execute（DML → changes）
  // -------------------------------------------------------------------------

  test("spl_execute：DML 返回 changes，且写入对后续查询可见", () => {
    const { run } = setup();
    run(`(spl_connect #db :{ type = "sqlite" path = "${DB_FILE}" })`);
    run(`(spl_execute :{ conn = db sql = "create temp table t (x)" })`);
    const result = run(
      `(spl_execute #r :{ conn = db sql = "insert into t values (1), (2), (3)" })`,
    );
    expect(result.changes).toBe(3);
    const rows = run(
      `(spl_query :{ conn = db sql = "select count(*) as n from t" })`,
    );
    expect(rows.rows).toEqual([{ n: 3 }]);
  });

  // -------------------------------------------------------------------------
  // spl-eval-passthrough / scope-merge
  // -------------------------------------------------------------------------

  test("scope-merge：Kon 变量 orders（DataSet）+ Conf.with 的 rate → 含新列的 DataSet", () => {
    const { run } = setup();
    const g = run(`
      (spl_connect #db :{ type = "sqlite" path = "${DB_FILE}" })
      (spl_query #orders :{ conn = db sql = "select id, amount from orders order by id" })
      (spl_eval #g :{ expr = "orders.derive({gross: concat('amount*', rate)})" with = {rate = 1.1} })
    `);
    // derive 返回 rows/schema 结构（DataSet 形态）
    expect(Array.isArray(g.rows)).toBe(true);
    expect(g.schema.map((c: any) => c.name)).toContain("gross");
    expect(g.rows[0].gross).toBeCloseTo(110);
    expect(g.rows[1].gross).toBeCloseTo(220);
  });

  test("scope-merge 优先级：ctx.scope < Kon env 变量 < Conf.with", () => {
    const { run } = setup({ tag: "ctx", base: 5 });
    // ctx.scope 兜底
    expect(run(`(spl_eval :{ expr = "tag" })`)).toBe("ctx");
    // Kon env 变量覆盖 ctx.scope
    expect(run(`(var tag "env") (spl_eval :{ expr = "tag" })`)).toBe("env");
    // Conf.with 覆盖 Kon env 与 ctx.scope；未覆盖的 base 仍可见
    expect(
      run(`(spl_eval :{ expr = "concat(tag, '-', base)" with = {tag = "with"} })`),
    ).toBe("with-5");
  });

  // -------------------------------------------------------------------------
  // spl-options 端到端（metadata-opt / attr-sugar / conflict-error）
  // -------------------------------------------------------------------------

  const AGE_SCOPE = { start: "2020-06-15", end: "2026-03-01" };

  test("metadata-opt：#opt = y → 实际执行 age@y(start, end)", () => {
    const { run } = setup(AGE_SCOPE);
    // 无选项：按月日修正 → 5；@y：整年差 → 6（选项注入可观测）
    expect(run(`(spl_eval :{ expr = "age(start, end)" })`)).toBe(5);
    expect(run(`(spl_eval #years :{ expr = "age(start, end)" } #opt = y)`)).toBe(6);
  });

  test("attr-sugar：@y 省值糖 → 实际执行 age@y(start, end)", () => {
    const { run } = setup(AGE_SCOPE);
    // Attr 与 :{} 同现会把 Conf 分裂到 Next（parser 陷阱）——此处同时验证链合并
    expect(run(`(spl_eval @y :{ expr = "age(start, end)" })`)).toBe(6);
  });

  test("conflict-error：表达式内已写 @y 又声明 #opt = m → 冲突报错", () => {
    const { run } = setup(AGE_SCOPE);
    expect(() =>
      run(`(spl_eval :{ expr = "age@y(start, end)" } #opt = m)`),
    ).toThrow(/冲突/);
  });

  test("幂等：表达式内已写 @y 且声明 #opt = y → 原样执行", () => {
    const { run } = setup(AGE_SCOPE);
    expect(run(`(spl_eval :{ expr = "age@y(start, end)" } #opt = y)`)).toBe(6);
  });

  // -------------------------------------------------------------------------
  // knot-reading / named-result-binding
  // -------------------------------------------------------------------------

  test("named-result-binding：#name 后结果在当前 env 定义，后续表达式可引用", () => {
    const { run } = setup();
    const n = run(`
      (spl_connect #db :{ type = "sqlite" path = "${DB_FILE}" })
      (spl_query #rows :{ conn = db sql = "select id, amount from orders" })
      (spl_eval :{ expr = "rows.count()" })
    `);
    expect(n).toBe(2);
  });

  test("named-result-binding：不带 #name 时仅返回值，可被 (var x (...)) 接住", () => {
    const { run, runtime } = setup();
    const n = run(`
      (spl_connect #db :{ type = "sqlite" path = "${DB_FILE}" })
      (var x (spl_query :{ conn = db sql = "select id from orders" }))
      (spl_eval :{ expr = "x.count()" })
    `);
    expect(n).toBe(2);
    // 未命名 → 不产生多余 env 绑定
    expect(runtime.hasBinding("rows")).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 错误路径
  // -------------------------------------------------------------------------

  test("未知 conn 名报错", () => {
    const { run } = setup();
    expect(() =>
      run(`(spl_query :{ conn = nosuch sql = "select 1" })`),
    ).toThrow(/nosuch/);
  });

  test("sqlite 查询缺 sql 报错", () => {
    const { run } = setup();
    run(`(spl_connect #db :{ type = "sqlite" path = "${DB_FILE}" })`);
    expect(() => run(`(spl_query :{ conn = db })`)).toThrow(/sql/);
  });

  test("spl_execute 缺 sql 报错", () => {
    const { run } = setup();
    run(`(spl_connect #db :{ type = "sqlite" path = "${DB_FILE}" })`);
    expect(() => run(`(spl_execute :{ conn = db })`)).toThrow(/sql/);
  });

  test("spl_eval 缺 expr 报错", () => {
    const { run } = setup();
    expect(() => run(`(spl_eval :{ with = {a = 1} })`)).toThrow(/expr/);
  });

  test("文件数据源不支持 execute → spl_execute 报错", () => {
    const { ctx, run } = setup();
    const csvPath = join(workspaceRoot, "t.csv");
    require("node:fs").writeFileSync(csvPath, "a,b\n1,2\n");
    openDataSource(ctx, { type: "csv", name: "c", path: "t.csv" });
    expect(() =>
      run(`(spl_execute :{ conn = c sql = "delete from csv_data" })`),
    ).toThrow(/execute/);
  });
});
