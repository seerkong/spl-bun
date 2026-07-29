/**
 * runSplKon 门面 + toQueryResult 归一 helper 测试。
 *
 * 覆盖 behavior delta（kon-spl-dsl / run-spl-kon-facade）的全部 case：
 * - run-basic：spl_eval #v 后 value=42 且 bindings.v=42。
 * - run-with-datasource：config.dataSources 注册 sqlite → spl_query →
 *   toQueryResult 与直接查询一致。
 * - fresh-per-call：每次调用全新 runtime/context，前次变量不可见（报错）。
 * - source-size-limit：source 超过 maxSourceBytes 抛含大小限制说明的错误。
 *
 * 另锁定实现定案：
 * - bindings 采集 = 执行后 Kon env 快照（snapshotKonEnv 同源逻辑），
 *   `#name` 绑定与 `(var x ...)` 绑定都会出现在 bindings 中。
 * - toQueryResult 归一规则：DataSet（instanceof 或 {schema,rows} duck 形态）
 *   → {columns, rows}（columns 取 schema 列名序）；已是 {columns, rows}
 *   原样返回；标量 / 数组 / null 等非表格值返回 null。
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

const kununAvailable = detectKunun(KUNUN_RUNTIME_ENTRY, "run");

describe.skipIf(!kununAvailable)("runSplKon / toQueryResult", () => {
  let runSplKon: any;
  let toQueryResult: any;

  let workspaceRoot: string;
  const DB_FILE = "orders.db";

  beforeAll(async () => {
    ({ runSplKon, toQueryResult } = await import("../src/index"));

    workspaceRoot = mkdtempSync(join(tmpdir(), "kon-spl-run-"));
    const db = new Database(join(workspaceRoot, DB_FILE));
    db.run("CREATE TABLE orders (id INTEGER, amount REAL)");
    db.run("INSERT INTO orders VALUES (1, 100), (2, 200)");
    db.close();
  });

  afterAll(() => {
    if (workspaceRoot) rmSync(workspaceRoot, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // run-basic
  // -------------------------------------------------------------------------

  test("run-basic：spl_eval #v → value=42 且 bindings.v=42", () => {
    const source = `(spl_eval #v :{ expr = "1+41" })\n(v)`;
    const result = runSplKon(source, {});
    expect(result.value).toBe(42);
    expect(result.bindings.v).toBe(42);
  });

  test("bindings 快照：(var x ...) 绑定同样被采集", () => {
    const result = runSplKon(`(var x 7) (spl_eval #v :{ expr = "x + 1" })`, {});
    expect(result.value).toBe(8);
    expect(result.bindings.x).toBe(7);
    expect(result.bindings.v).toBe(8);
  });

  test("config.scope 对 spl_eval 可见", () => {
    const result = runSplKon(`(spl_eval :{ expr = "base * 2" })`, {
      scope: { base: 21 },
    });
    expect(result.value).toBe(42);
  });

  // -------------------------------------------------------------------------
  // run-with-datasource
  // -------------------------------------------------------------------------

  test("run-with-datasource：dataSources 注册 sqlite → spl_query → toQueryResult 与直查一致", () => {
    const result = runSplKon(
      `(spl_query #rows :{ conn = db sql = "select id, amount from orders order by id" })`,
      {
        workspaceRoot,
        dataSources: [{ type: "sqlite", name: "db", path: DB_FILE }],
      },
    );
    expect(result.value).toBeInstanceOf(DataSet);

    const direct = new Database(join(workspaceRoot, DB_FILE))
      .query("select id, amount from orders order by id")
      .all();
    const qr = toQueryResult(result.value);
    expect(qr).toEqual({
      columns: ["id", "amount"],
      rows: direct as Record<string, unknown>[],
    });
    // bindings 也拿得到同一 DataSet
    expect(result.bindings.rows).toBe(result.value);
  });

  // -------------------------------------------------------------------------
  // fresh-per-call
  // -------------------------------------------------------------------------

  test("fresh-per-call：前次调用定义的变量在下次调用不可见（报未定义错误）", () => {
    const first = runSplKon(`(var x 1) (spl_eval #y :{ expr = "x + 1" })`, {});
    expect(first.bindings.x).toBe(1);
    // 全新 runtime：Kon 层引用 x 报 Unbound name（无状态泄漏）
    expect(() => runSplKon(`(x)`, {})).toThrow(/Unbound name: x/);
    // 引擎事实（实测锁定）：spl_eval 的通用表达式 parser 对未定义标识符
    // 未定义变量按空值参与加法，Variant.add(null,1)=1，bindings 仍为空
    const second = runSplKon(`(spl_eval :{ expr = "x + 1" })`, {});
    expect(second.value).toBe(1);
    expect(second.bindings).toEqual({});
  });

  test("fresh-per-call：数据源注册表不跨调用共享", () => {
    runSplKon(`(spl_query :{ conn = db sql = "select 1 as one" })`, {
      workspaceRoot,
      dataSources: [{ type: "sqlite", name: "db", path: DB_FILE }],
    });
    // 第二次不注册 db → 未知数据源
    expect(() =>
      runSplKon(`(spl_query :{ conn = db sql = "select 1 as one" })`, {
        workspaceRoot,
      }),
    ).toThrow(/db/);
  });

  // -------------------------------------------------------------------------
  // source-size-limit
  // -------------------------------------------------------------------------

  test("source-size-limit：超过 maxSourceBytes 抛含大小限制说明的错误", () => {
    const source = `(spl_eval :{ expr = "1" }) ; ${"x".repeat(100)}`;
    expect(() => runSplKon(source, { maxSourceBytes: 64 })).toThrow(
      /maxSourceBytes|64/,
    );
    expect(() => runSplKon(source, { maxSourceBytes: 64 })).toThrow(/64/);
  });

  test("source-size-limit：默认限制 65536 字节，未超限正常执行", () => {
    // 默认限制下小脚本正常执行
    const ok = runSplKon(`(spl_eval :{ expr = "1+1" })`, {});
    expect(ok.value).toBe(2);
    // 构造 > 65536 字节的源码（注释填充不影响语义，但大小检查在解析前）
    const big = `(spl_eval :{ expr = "1+1" })` + " ".repeat(70000);
    expect(() => runSplKon(big, {})).toThrow(/65536/);
  });

  // -------------------------------------------------------------------------
  // toQueryResult 归一规则
  // -------------------------------------------------------------------------

  test("toQueryResult：DataSet → {columns, rows}（columns 取 schema 列名序）", () => {
    const ds = new DataSet(
      [
        { name: "b", type: "number" },
        { name: "a", type: "number" },
      ],
      [
        { b: 1, a: 2 },
        { b: 3, a: 4 },
      ],
    );
    expect(toQueryResult(ds)).toEqual({
      columns: ["b", "a"],
      rows: [
        { b: 1, a: 2 },
        { b: 3, a: 4 },
      ],
    });
  });

  test("toQueryResult：{schema, rows} duck 形态（DataSet 形态）同样归一", () => {
    const duck = {
      schema: [{ name: "n", type: "number" }],
      rows: [{ n: 1 }],
    };
    expect(toQueryResult(duck)).toEqual({ columns: ["n"], rows: [{ n: 1 }] });
  });

  test("toQueryResult：已是 {columns, rows} 原样返回", () => {
    const qr = { columns: ["a"], rows: [{ a: 1 }] };
    expect(toQueryResult(qr)).toBe(qr);
  });

  test("toQueryResult：标量 / 数组 / null 返回 null", () => {
    expect(toQueryResult(42)).toBeNull();
    expect(toQueryResult("s")).toBeNull();
    expect(toQueryResult(null)).toBeNull();
    expect(toQueryResult(undefined)).toBeNull();
    expect(toQueryResult([1, 2, 3])).toBeNull();
    expect(toQueryResult({ foo: 1 })).toBeNull();
  });
});
