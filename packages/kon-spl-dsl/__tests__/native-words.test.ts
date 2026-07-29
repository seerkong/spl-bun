/**
 * 原生数据运算 word 端到端测试：spl_derive / spl_select（track
 * add-kon-spl-native-words T1.1）。
 *
 * 覆盖 behavior delta（kon-spl-dsl）case：
 * - native-words-common/in-resolution：Conf 的 in 值为变量名（裸标识符归一
 *   为字符串）时按「Kon env → ctx.scope」顺序解析到 DataSet；值本身是
 *   DataSet 时直接使用（该分支经程序化调用锁定，Kon Conf 值不求值，源码
 *   形态只能给名字）；解析失败报错含名字。
 * - native-words-common/opt-rejected：原生 word 不接受 `#opt = z`（Metadata
 *   权威通道）与 `@z`（Attr 省值糖）两种选项形态，误用均报错并提示用
 *   Conf 键表达模式或改用 spl_eval。
 * - native-derive-select/derive-with-scope：cols 行表达式直接引用 with/env
 *   变量（无需字符串拼接）；行字段优先于 with/env 同名变量（引擎实测：
 *   withComputedColumns 求值 scope 为 {...scope, ...row}，行覆盖外层）。
 * - native-derive-select/select-where：where 谓词过滤行，且可引用 with/env
 *   变量（filterExpr 同样 {...scope, ...row}）。
 *
 * 沿用 words.test.ts 模式：真实 Kon 源码 + RuntimeInterpreter 端到端；
 * 无 kunun 仓库时跳过。
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { DataSet } from "depa-data-core";
import { detectKunun, KUNUN_RUNTIME_ENTRY } from "./helpers/kunun";

const kununAvailable = detectKunun(KUNUN_RUNTIME_ENTRY, "native-words");

describe.skipIf(!kununAvailable)("native words: spl_derive / spl_select", () => {
  let RuntimeInterpreter: any;
  let EnableSplDsl: any;
  let createSplContext: any;
  let executeSelect: any;

  let workspaceRoot: string;
  const DB_FILE = "orders.db";

  beforeAll(async () => {
    ({ RuntimeInterpreter } = await import("kunun"));
    ({ EnableSplDsl, createSplContext } = await import("../src/index"));
    ({ executeSelect } = await import("../src/words/select"));

    workspaceRoot = mkdtempSync(join(tmpdir(), "kon-spl-native-"));
    const db = new Database(join(workspaceRoot, DB_FILE));
    db.run("CREATE TABLE orders (id INTEGER, amount REAL)");
    db.run("INSERT INTO orders VALUES (1, 100), (2, 200)");
    db.close();
  });

  afterAll(() => {
    if (workspaceRoot) rmSync(workspaceRoot, { recursive: true, force: true });
  });

  /** 每个测试独立的 runtime + ctx（沿用 words.test.ts 模式） */
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

  /** 常用前奏：连接 + 查出 orders（#orders 绑定 env） */
  const PRELUDE = `
    (spl_connect #db :{ type = "sqlite" path = "${DB_FILE}" })
    (spl_query #orders :{ conn = db sql = "select id, amount from orders order by id" })
  `;

  // -------------------------------------------------------------------------
  // native-words-common / in-resolution
  // -------------------------------------------------------------------------

  test("in-resolution：in = orders 按名解析 Kon env 绑定的 DataSet，#big 绑定过滤结果", () => {
    const { run } = setup();
    const rows = run(`
      ${PRELUDE}
      (spl_select #big :{ in = orders where = "amount > 10" })
      (spl_eval :{ expr = "big.count()" })
    `);
    // where 恒真 → 全部 2 行；big 已在 env 绑定，后续 spl_eval 可引用
    expect(rows).toBe(2);
  });

  test("in-resolution：Kon env 无该名时回退 ctx.scope", () => {
    const seed = new DataSet(
      [
        { name: "id", type: "number" },
        { name: "amount", type: "number" },
      ],
      [
        { id: 1, amount: 5 },
        { id: 2, amount: 50 },
      ],
    );
    const { run } = setup({ t: seed });
    const out = run(`(spl_select :{ in = t where = "amount > 10" })`);
    expect(out).toBeInstanceOf(DataSet);
    expect(out.rows).toEqual([{ id: 2, amount: 50 }]);
  });

  test("in-resolution 优先级：Kon env 同名绑定覆盖 ctx.scope", () => {
    const scopeDs = new DataSet(
      [{ name: "amount", type: "number" }],
      [{ amount: 1 }],
    );
    const { run } = setup({ orders: scopeDs });
    const out = run(`
      ${PRELUDE}
      (spl_select :{ in = orders where = "amount > 10" })
    `);
    // env 的 orders（2 行，amount 100/200）胜出，而非 ctx.scope 的单行表
    expect(out.rows.length).toBe(2);
    expect(out.rows.map((r: any) => r.amount)).toEqual([100, 200]);
  });

  test("in-resolution：值本身是 DataSet 时直接使用（程序化分支）", () => {
    const { runtime, ctx } = setup();
    const ds = new DataSet(
      [{ name: "amount", type: "number" }],
      [{ amount: 5 }, { amount: 500 }],
    );
    const out = executeSelect(ctx, runtime, {
      conf: { in: ds, where: "amount > 10" },
      options: "",
      body: [],
    });
    expect(out.rows).toEqual([{ amount: 500 }]);
  });

  test("in-resolution：解析失败报错含名字", () => {
    const { run } = setup();
    expect(() =>
      run(`(spl_select :{ in = nosuch where = "amount > 10" })`),
    ).toThrow(/nosuch/);
  });

  test("in-resolution：缺 in 报错", () => {
    const { run } = setup();
    expect(() => run(`(spl_select :{ where = "amount > 10" })`)).toThrow(/in/);
  });

  // -------------------------------------------------------------------------
  // native-words-common / opt-rejected（#opt 权威通道 与 @糖 两种都拒绝）
  // -------------------------------------------------------------------------

  test("opt-rejected：spl_select 带 #opt = z 报错并提示 Conf 键 / spl_eval", () => {
    const { run } = setup();
    expect(() =>
      run(`
        ${PRELUDE}
        (spl_select :{ in = orders where = "amount > 10" } #opt = z)
      `),
    ).toThrow(/Conf 键[\s\S]*spl_eval/);
  });

  test("opt-rejected：spl_derive 带 @z 糖同样报错", () => {
    const { run } = setup();
    expect(() =>
      run(`
        ${PRELUDE}
        (spl_derive @z :{ in = orders cols = {gross = "amount*2"} })
      `),
    ).toThrow(/Conf 键[\s\S]*spl_eval/);
  });

  // -------------------------------------------------------------------------
  // native-derive-select / derive-with-scope
  // -------------------------------------------------------------------------

  test("derive-with-scope：cols 表达式直接引用 with 变量 rate（无需字符串拼接）", () => {
    const { run } = setup();
    const priced = run(`
      ${PRELUDE}
      (spl_derive #priced :{ in = orders cols = {gross = "amount*rate"} with = {rate = 1.1} })
    `);
    expect(priced).toBeInstanceOf(DataSet);
    expect(priced.schema.map((c: any) => c.name)).toContain("gross");
    expect(priced.rows[0].gross).toBeCloseTo(110);
    expect(priced.rows[1].gross).toBeCloseTo(220);
  });

  test("derive-with-scope：cols 表达式引用 Kon env 变量（var 定义）", () => {
    const { run } = setup();
    const priced = run(`
      ${PRELUDE}
      (var rate 2)
      (spl_derive :{ in = orders cols = {gross = "amount*rate"} })
    `);
    expect(priced.rows.map((r: any) => r.gross)).toEqual([200, 400]);
  });

  test("derive-with-scope：行字段优先于 with/env 同名变量（行遮蔽）", () => {
    const { run } = setup();
    const out = run(`
      ${PRELUDE}
      (var amount 0)
      (spl_derive :{ in = orders cols = {gross = "amount*2"} with = {amount = -1} })
    `);
    // 行的 amount（100/200）遮蔽 env 的 0 与 with 的 -1
    expect(out.rows.map((r: any) => r.gross)).toEqual([200, 400]);
  });

  test("spl_derive 缺 cols 报错", () => {
    const { run } = setup();
    expect(() =>
      run(`
        ${PRELUDE}
        (spl_derive :{ in = orders })
      `),
    ).toThrow(/cols/);
  });

  // -------------------------------------------------------------------------
  // native-derive-select / select-where
  // -------------------------------------------------------------------------

  test("select-where：derive 结果续接 select，仅保留 gross > 150 的行", () => {
    const { run } = setup();
    const big = run(`
      ${PRELUDE}
      (spl_derive #priced :{ in = orders cols = {gross = "amount*rate"} with = {rate = 1.1} })
      (spl_select #big :{ in = priced where = "gross > 150" })
    `);
    expect(big).toBeInstanceOf(DataSet);
    expect(big.rows.length).toBe(1);
    expect(big.rows[0].gross).toBeCloseTo(220);
  });

  test("select-where：where 谓词引用 with/env 变量", () => {
    const { run } = setup();
    // env 变量 threshold
    const a = run(`
      ${PRELUDE}
      (var threshold 150)
      (spl_select :{ in = orders where = "amount > threshold" })
    `);
    expect(a.rows.map((r: any) => r.amount)).toEqual([200]);
    // with 覆盖 env 同名
    const b = run(`
      (spl_select :{ in = orders where = "amount > threshold" with = {threshold = 50} })
    `);
    expect(b.rows.map((r: any) => r.amount)).toEqual([100, 200]);
  });

  test("spl_select 缺 where 报错", () => {
    const { run } = setup();
    expect(() =>
      run(`
        ${PRELUDE}
        (spl_select :{ in = orders })
      `),
    ).toThrow(/where/);
  });

  // -------------------------------------------------------------------------
  // 注册面
  // -------------------------------------------------------------------------

  test("register：spl_derive / spl_select 已注册为 prefix keyword", () => {
    const { runtime } = setup();
    for (const w of ["spl_derive", "spl_select"]) {
      expect(runtime.getPrefixKeywordExpander(w)).toBeTruthy();
    }
  });
});

// ===========================================================================
// spl_groups（track add-kon-spl-native-words T1.2，delta native-groups）
// ===========================================================================

describe.skipIf(!kununAvailable)("native words: spl_groups", () => {
  let RuntimeInterpreter: any;
  let EnableSplDsl: any;
  let createSplContext: any;

  beforeAll(async () => {
    ({ RuntimeInterpreter } = await import("kunun"));
    ({ EnableSplDsl, createSplContext } = await import("../src/index"));
  });

  /** sales：region/amount/id 三列，east 两行 west 一行 */
  function makeSales(): DataSet {
    return new DataSet(
      [
        { name: "id", type: "number" },
        { name: "region", type: "string" },
        { name: "amount", type: "number" },
      ],
      [
        { id: 1, region: "east", amount: 100 },
        { id: 2, region: "west", amount: 200 },
        { id: 3, region: "east", amount: 50 },
      ],
    );
  }

  function setup(scope: Record<string, unknown> = { sales: makeSales() }): {
    runtime: any;
    run: (source: string) => any;
  } {
    const runtime = RuntimeInterpreter.CreateRuntime();
    const ctx = createSplContext({ workspaceRoot: tmpdir(), scope });
    EnableSplDsl(runtime, ctx);
    const run = (source: string) =>
      RuntimeInterpreter.EvalBlockSourceWithRuntimeSync(runtime, source);
    return { runtime, run };
  }

  // -------------------------------------------------------------------------
  // native-groups / groups-basic
  // -------------------------------------------------------------------------

  test("groups-basic：keys=[region] + agg map，每组 total/cnt 正确且 #byRegion 绑定", () => {
    const { run } = setup();
    const out = run(
      `(spl_groups #byRegion :{ in = sales keys = [region] agg = {total = "sum(amount)" cnt = "count(id)"} })`,
    );
    expect(out).toBeInstanceOf(DataSet);
    expect(out.schema.map((c: any) => c.name)).toEqual(["region", "total", "cnt"]);
    const byKey = Object.fromEntries(out.rows.map((r: any) => [r.region, r]));
    expect(Object.keys(byKey).sort()).toEqual(["east", "west"]);
    expect(byKey.east.total).toBe(150);
    expect(byKey.east.cnt).toBe(2);
    expect(byKey.west.total).toBe(200);
    expect(byKey.west.cnt).toBe(1);
    // #byRegion 已绑定 env，后续原生 word 可按名引用
    const filtered = run(`(spl_select :{ in = byRegion where = "total > 180" })`);
    expect(filtered.rows.map((r: any) => r.region)).toEqual(["west"]);
  });

  // -------------------------------------------------------------------------
  // native-groups / groups-whole-table（keys = [] 与缺省两种形态）
  // -------------------------------------------------------------------------

  test("groups-whole-table：keys = [] → 单行全表聚合", () => {
    const { run } = setup();
    const out = run(
      `(spl_groups :{ in = sales keys = [] agg = {total = "sum(amount)" cnt = "count(id)"} })`,
    );
    expect(out.rows).toEqual([{ total: 350, cnt: 3 }]);
  });

  test("groups-whole-table：keys 缺省 → 单行全表聚合", () => {
    const { run } = setup();
    const out = run(
      `(spl_groups :{ in = sales agg = {total = "sum(amount)"} })`,
    );
    expect(out.rows).toEqual([{ total: 350 }]);
  });

  // -------------------------------------------------------------------------
  // agg 表达式引用 with / env 变量（word 层逐行求内层表达式 → 引用可用，锁定）
  // -------------------------------------------------------------------------

  test("agg 内层表达式引用 with 变量：sum(amount*rate)", () => {
    const { run } = setup();
    const out = run(
      `(spl_groups :{ in = sales keys = [region] agg = {total = "sum(amount*rate)"} with = {rate = 2} })`,
    );
    const byKey = Object.fromEntries(out.rows.map((r: any) => [r.region, r.total]));
    expect(byKey).toEqual({ east: 300, west: 400 });
  });

  test("agg 内层表达式引用 Kon env 变量，且行字段遮蔽同名外层变量", () => {
    const { run } = setup();
    const out = run(`
      (var rate 3)
      (var amount 0)
      (spl_groups :{ in = sales agg = {total = "sum(amount*rate)"} })
    `);
    // rate 取 env 的 3；amount 是行字段，遮蔽 env 的 0 → 350*3
    expect(out.rows).toEqual([{ total: 1050 }]);
  });

  // -------------------------------------------------------------------------
  // 错误路径
  // -------------------------------------------------------------------------

  test("缺 in 报错", () => {
    const { run } = setup();
    expect(() =>
      run(`(spl_groups :{ agg = {total = "sum(amount)"} })`),
    ).toThrow(/in/);
  });

  test("缺 agg 报错", () => {
    const { run } = setup();
    expect(() => run(`(spl_groups :{ in = sales keys = [region] })`)).toThrow(
      /agg/,
    );
  });

  test("未知聚合函数报错（含函数名与支持面）", () => {
    const { run } = setup();
    expect(() =>
      run(`(spl_groups :{ in = sales agg = {x = "frobnicate(amount)"} })`),
    ).toThrow(/frobnicate[\s\S]*sum/);
  });

  test("agg 值不是「聚合函数(表达式)」形态时报错", () => {
    const { run } = setup();
    expect(() =>
      run(`(spl_groups :{ in = sales agg = {x = "amount"} })`),
    ).toThrow(/聚合函数/);
  });

  test("opt-rejected：spl_groups 带 #opt = z 报错并提示 Conf 键 / spl_eval", () => {
    const { run } = setup();
    expect(() =>
      run(`(spl_groups :{ in = sales agg = {total = "sum(amount)"} } #opt = z)`),
    ).toThrow(/Conf 键[\s\S]*spl_eval/);
  });

  // -------------------------------------------------------------------------
  // 注册面
  // -------------------------------------------------------------------------

  test("register：spl_groups 已注册为 prefix keyword", () => {
    const { runtime } = setup();
    expect(runtime.getPrefixKeywordExpander("spl_groups")).toBeTruthy();
  });
});

// ===========================================================================
// spl_sort / spl_join / spl_top（track add-kon-spl-native-words T2.1，
// delta native-sort-join-top）
//
// 引擎实测结论（findings 回写）：DataSet 无公开 sort 方法（compareRows 仅
// window 内部使用且未导出）→ 排序在 word 层实现（rows 拷贝 + 多键比较 +
// DataSet 重建，schema 保持，JS Array.sort 稳定）；join 直接映射
// DataSet.join(other, spec)（type/leftKeys/rightKeys/rightPrefix）；
// top = sort 复用 + slice（decisions.md #3）。
// ===========================================================================

describe.skipIf(!kununAvailable)("native words: spl_sort / spl_join / spl_top", () => {
  let RuntimeInterpreter: any;
  let EnableSplDsl: any;
  let createSplContext: any;

  beforeAll(async () => {
    ({ RuntimeInterpreter } = await import("kunun"));
    ({ EnableSplDsl, createSplContext } = await import("../src/index"));
  });

  /** t：id/amount，amount 有并列（100 两行）以验证多键与稳定语义 */
  function makeT(): DataSet {
    return new DataSet(
      [
        { name: "id", type: "number" },
        { name: "amount", type: "number" },
      ],
      [
        { id: 3, amount: 100 },
        { id: 1, amount: 200 },
        { id: 2, amount: 100 },
      ],
    );
  }

  /** emp/dept：join 用例数据 */
  function makeEmp(): DataSet {
    return DataSet.fromRows([
      { id: 1, name: "a", dept: "D1" },
      { id: 2, name: "b", dept: "D2" },
      { id: 3, name: "c", dept: "D3" },
    ]);
  }
  function makeDept(): DataSet {
    return DataSet.fromRows([
      { dept: "D1", dname: "Sales" },
      { dept: "D2", dname: "Eng" },
    ]);
  }

  function setup(extraScope: Record<string, unknown> = {}): {
    runtime: any;
    run: (source: string) => any;
  } {
    const runtime = RuntimeInterpreter.CreateRuntime();
    const ctx = createSplContext({
      workspaceRoot: tmpdir(),
      scope: { t: makeT(), emp: makeEmp(), dept: makeDept(), ...extraScope },
    });
    EnableSplDsl(runtime, ctx);
    const run = (source: string) =>
      RuntimeInterpreter.EvalBlockSourceWithRuntimeSync(runtime, source);
    return { runtime, run };
  }

  // -------------------------------------------------------------------------
  // native-sort-join-top / sort-multi-key
  // -------------------------------------------------------------------------

  test("sort-multi-key：by = [{col = amount desc = true} \"id\"] → amount 降序、并列按 id 升序", () => {
    const { run } = setup();
    const out = run(`(spl_sort #s :{ in = t by = [{col = amount desc = true} "id"] })`);
    expect(out).toBeInstanceOf(DataSet);
    expect(out.rows.map((r: any) => r.id)).toEqual([1, 2, 3]);
    expect(out.rows.map((r: any) => r.amount)).toEqual([200, 100, 100]);
    // schema 保持、原 DataSet 不被就地修改
    expect(out.schema.map((c: any) => c.name)).toEqual(["id", "amount"]);
    // #s 已绑定 env，后续 word 可按名引用
    const first = run(`(spl_top :{ in = s n = 1 by = "amount" desc = true })`);
    expect(first.rows).toEqual([{ id: 1, amount: 200 }]);
  });

  test("sort：单键字符串简写 by = \"amount\"（升序，锁定）", () => {
    const { run } = setup();
    const out = run(`(spl_sort :{ in = t by = "amount" })`);
    expect(out.rows.map((r: any) => r.amount)).toEqual([100, 100, 200]);
    // 稳定：并列 100 保持输入相对序（id 3 在 id 2 之前）
    expect(out.rows.map((r: any) => r.id)).toEqual([3, 2, 1]);
  });

  test("sort：不就地修改输入 DataSet", () => {
    const t = makeT();
    const { run } = setup({ t2: t });
    run(`(spl_sort :{ in = t2 by = "amount" })`);
    expect(t.rows.map((r: any) => r.id)).toEqual([3, 1, 2]);
  });

  test("opt-rejected（P1 待办①）：spl_sort 带 #opt = z 报错并提示 Conf 键 / spl_eval", () => {
    const { run } = setup();
    expect(() =>
      run(`(spl_sort :{ in = t by = ["amount"] } #opt = z)`),
    ).toThrow(/Conf 键[\s\S]*spl_eval/);
  });

  test("spl_sort 缺 by 报错", () => {
    const { run } = setup();
    expect(() => run(`(spl_sort :{ in = t })`)).toThrow(/by/);
  });

  test("spl_sort by 项是 map 但缺 col 报错", () => {
    const { run } = setup();
    expect(() => run(`(spl_sort :{ in = t by = [{desc = true}] })`)).toThrow(/col/);
  });

  // -------------------------------------------------------------------------
  // native-sort-join-top / join-left
  // -------------------------------------------------------------------------

  test("join-left：type = \"left\" on = [dept]，未匹配行右列为空值", () => {
    const { run } = setup();
    const j = run(`(spl_join #j :{ left = emp right = dept type = "left" on = [dept] })`);
    expect(j).toBeInstanceOf(DataSet);
    expect(j.rows.length).toBe(3);
    const byId = Object.fromEntries(j.rows.map((r: any) => [r.id, r]));
    expect(byId[1].dname).toBe("Sales");
    expect(byId[2].dname).toBe("Eng");
    // 未匹配行（D3）右表列为空值
    expect(byId[3].dname).toBeUndefined();
  });

  test("join inner：type 缺省为 inner，未匹配行被丢弃", () => {
    const { run } = setup();
    const j = run(`(spl_join :{ left = emp right = dept on = [dept] })`);
    expect(j.rows.length).toBe(2);
    expect(j.rows.map((r: any) => r.id).sort()).toEqual([1, 2]);
  });

  test("join：leftOn/rightOn 异名键", () => {
    const dept2 = DataSet.fromRows([
      { code: "D1", dname: "Sales" },
      { code: "D3", dname: "Ops" },
    ]);
    const { run } = setup({ dept2 });
    const j = run(
      `(spl_join :{ left = emp right = dept2 leftOn = [dept] rightOn = [code] })`,
    );
    expect(j.rows.length).toBe(2);
    const byId = Object.fromEntries(j.rows.map((r: any) => [r.id, r]));
    expect(byId[1].dname).toBe("Sales");
    expect(byId[3].dname).toBe("Ops");
  });

  test("join：rightPrefix 处理右表同名列", () => {
    const deptN = DataSet.fromRows([{ dept: "D1", name: "Sales" }]);
    const { run } = setup({ deptN });
    const j = run(
      `(spl_join :{ left = emp right = deptN on = [dept] rightPrefix = "d_" })`,
    );
    expect(j.rows.length).toBe(1);
    // 左表 name 保留、右表同名 name 加前缀
    expect(j.rows[0].name).toBe("a");
    expect(j.rows[0].d_name).toBe("Sales");
    expect(j.schema.map((c: any) => c.name)).toContain("d_name");
  });

  test("spl_join 缺 on（且无 leftOn/rightOn）报错", () => {
    const { run } = setup();
    expect(() => run(`(spl_join :{ left = emp right = dept })`)).toThrow(/on/);
  });

  test("spl_join 只给 leftOn 不给 rightOn 报错", () => {
    const { run } = setup();
    expect(() =>
      run(`(spl_join :{ left = emp right = dept leftOn = [dept] })`),
    ).toThrow(/rightOn/);
  });

  test("spl_join type 非法值报错", () => {
    const { run } = setup();
    expect(() =>
      run(`(spl_join :{ left = emp right = dept type = "outer" on = [dept] })`),
    ).toThrow(/type/);
  });

  test("spl_join 缺 left/right 报错", () => {
    const { run } = setup();
    expect(() => run(`(spl_join :{ right = dept on = [dept] })`)).toThrow(/left/);
  });

  // -------------------------------------------------------------------------
  // native-sort-join-top / top-n
  // -------------------------------------------------------------------------

  test("top-n：n = 2 by = \"amount\" desc = true → amount 最大的 2 行", () => {
    const { run } = setup();
    const out = run(`(spl_top #t5 :{ in = t n = 2 by = "amount" desc = true })`);
    expect(out).toBeInstanceOf(DataSet);
    expect(out.rows.length).toBe(2);
    expect(out.rows[0].amount).toBe(200);
    expect(out.rows[1].amount).toBe(100);
    // schema 保持
    expect(out.schema.map((c: any) => c.name)).toEqual(["id", "amount"]);
  });

  test("top：desc 缺省 = false（升序，取最小的 n 行，对齐 SPL A.top 缺省语义，锁定）", () => {
    const { run } = setup();
    const out = run(`(spl_top :{ in = t n = 2 by = "amount" })`);
    expect(out.rows.map((r: any) => r.amount)).toEqual([100, 100]);
    // 稳定：并列保持输入相对序
    expect(out.rows.map((r: any) => r.id)).toEqual([3, 2]);
  });

  test("top：n 超过行数 → 返回全部行（锁定）", () => {
    const { run } = setup();
    const out = run(`(spl_top :{ in = t n = 99 by = "amount" })`);
    expect(out.rows.length).toBe(3);
  });

  test("top：n <= 0 或非正数报错（锁定：n 必须为正数）", () => {
    const { run } = setup();
    expect(() => run(`(spl_top :{ in = t n = 0 by = "amount" })`)).toThrow(/n/);
    expect(() => run(`(spl_top :{ in = t n = -1 by = "amount" })`)).toThrow(/n/);
  });

  test("spl_top 缺 by 报错", () => {
    const { run } = setup();
    expect(() => run(`(spl_top :{ in = t n = 2 })`)).toThrow(/by/);
  });

  test("opt-rejected：spl_top 带 @z 糖报错", () => {
    const { run } = setup();
    expect(() =>
      run(`(spl_top @z :{ in = t n = 2 by = "amount" })`),
    ).toThrow(/Conf 键[\s\S]*spl_eval/);
  });

  // -------------------------------------------------------------------------
  // 注册面
  // -------------------------------------------------------------------------

  test("register：spl_sort / spl_join / spl_top 已注册为 prefix keyword", () => {
    const { runtime } = setup();
    for (const w of ["spl_sort", "spl_join", "spl_top"]) {
      expect(runtime.getPrefixKeywordExpander(w)).toBeTruthy();
    }
  });
});
