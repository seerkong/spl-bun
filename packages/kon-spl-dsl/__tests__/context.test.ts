/**
 * SplContext 与同步数据源测试（T2.1）。
 *
 * 覆盖 behavior delta（kon-spl-dsl）requirements/datasource-words 的数据源侧：
 * - sqlite：注册/打开 → query 返回 DataSet 且内容正确；execute DML 返回 changes。
 * - csv/json：临时文件 → query()（无 sql）全量读取为 DataSet；带 sql 时经
 *   临时内存 sqlite 查询（与 spl-flow datasource 语义一致，本地同步实现）。
 * - workspace-escape：相对路径越出 workspaceRoot / root 外绝对路径 →
 *   抛 "Path escapes workspace root"。
 * - 数据源 close 幂等。
 *
 * 不依赖 kunun；word 注册（spl_connect 等）在 T2.2。
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { DataSet } from "depa-data-core";
import {
  createSplContext,
  openDataSource,
  resolveWorkspacePath,
  type SplContext,
  type SyncDataSource,
} from "../src/context";

let root: string;
let ctx: SplContext;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "kon-spl-dsl-ctx-"));
  // 准备 sqlite 测试库
  const db = new Database(join(root, "test.db"), { create: true });
  db.run("CREATE TABLE orders (id INTEGER PRIMARY KEY, item TEXT, amount REAL)");
  db.run("INSERT INTO orders (id, item, amount) VALUES (1, 'apple', 10.5), (2, 'pear', 3)");
  db.close();
  // csv / json 测试文件
  writeFileSync(join(root, "orders.csv"), "id,item,amount\n1,apple,10.5\n2,pear,3\n");
  writeFileSync(
    join(root, "orders.json"),
    JSON.stringify([
      { id: 1, item: "apple", amount: 10.5 },
      { id: 2, item: "pear", amount: 3 },
    ]),
  );
  ctx = createSplContext({ workspaceRoot: root });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("createSplContext", () => {
  test("默认值：workspaceRoot=process.cwd()，scope={}，注册表为空", () => {
    const c = createSplContext({});
    expect(c.workspaceRoot).toBe(process.cwd());
    expect(c.scope).toEqual({});
    expect(c.dataSources.size).toBe(0);
  });

  test("显式配置：workspaceRoot 与 scope 透传", () => {
    const c = createSplContext({ workspaceRoot: root, scope: { rate: 1.1 } });
    expect(c.workspaceRoot).toBe(root);
    expect(c.scope.rate).toBe(1.1);
  });
});

describe("resolveWorkspacePath", () => {
  test("相对路径基于 root 解析", () => {
    expect(resolveWorkspacePath("test.db", root)).toBe(join(root, "test.db"));
    expect(resolveWorkspacePath("sub/a.csv", root)).toBe(join(root, "sub", "a.csv"));
  });

  test("root 内绝对路径原样通过", () => {
    const abs = join(root, "test.db");
    expect(resolveWorkspacePath(abs, root)).toBe(abs);
  });

  test("workspace-escape：../ 越界抛错", () => {
    expect(() => resolveWorkspacePath("../outside.db", root)).toThrow(
      "Path escapes workspace root",
    );
  });

  test("workspace-escape：root 外绝对路径抛错", () => {
    expect(() => resolveWorkspacePath(join(tmpdir(), "elsewhere.db"), root)).toThrow(
      "Path escapes workspace root",
    );
  });

  test("workspace-escape：前缀相似但不同目录（root + '-evil'）抛错", () => {
    expect(() => resolveWorkspacePath(root + "-evil" + sep + "x.db", root)).toThrow(
      "Path escapes workspace root",
    );
  });
});

describe("sqlite 数据源", () => {
  test("注册/打开 → query 返回 DataSet 且内容正确；注册表可查", () => {
    const ds = openDataSource(ctx, { type: "sqlite", name: "db", path: "test.db" });
    expect(ds.type).toBe("sqlite");
    expect(ds.name).toBe("db");
    expect(ctx.dataSources.get("db")).toBe(ds);

    const result = ds.query("SELECT id, item, amount FROM orders ORDER BY id");
    expect(result).toBeInstanceOf(DataSet);
    expect(result.rows).toEqual([
      { id: 1, item: "apple", amount: 10.5 },
      { id: 2, item: "pear", amount: 3 },
    ]);
    expect(result.schema.map((c) => c.name)).toEqual(["id", "item", "amount"]);
  });

  test("query 支持参数绑定", () => {
    const ds = ctx.dataSources.get("db") as SyncDataSource;
    const result = ds.query("SELECT item FROM orders WHERE id = ?", [2]);
    expect(result.rows).toEqual([{ item: "pear" }]);
  });

  test("execute 执行 DML 返回 changes", () => {
    const ds = ctx.dataSources.get("db") as SyncDataSource;
    expect(ds.execute).toBeDefined();
    const r = ds.execute!("INSERT INTO orders (id, item, amount) VALUES (?, ?, ?)", [
      3,
      "plum",
      7,
    ]);
    expect(r.changes).toBe(1);
    const r2 = ds.execute!("UPDATE orders SET amount = amount + 1 WHERE id <= 2");
    expect(r2.changes).toBe(2);
    // 回滚测试写入，避免影响其他 case
    ds.execute!("DELETE FROM orders WHERE id = 3");
    ds.execute!("UPDATE orders SET amount = amount - 1 WHERE id <= 2");
  });

  test("sqlite 路径越界 → 抛路径越界错误（behavior case workspace-escape）", () => {
    expect(() =>
      openDataSource(ctx, { type: "sqlite", name: "evil", path: "../outside.db" }),
    ).toThrow("Path escapes workspace root");
    expect(ctx.dataSources.has("evil")).toBe(false);
  });
});

describe("csv 数据源", () => {
  test("query()（无 sql）全量读取为 DataSet，数值字段归一为 number", () => {
    const ds = openDataSource(ctx, { type: "csv", name: "csv", path: "orders.csv" });
    const result = ds.query();
    expect(result).toBeInstanceOf(DataSet);
    expect(result.rows).toEqual([
      { id: 1, item: "apple", amount: 10.5 },
      { id: 2, item: "pear", amount: 3 },
    ]);
    expect(result.schema.map((c) => c.name)).toEqual(["id", "item", "amount"]);
  });

  test("query(sql) 经临时内存 sqlite 查询", () => {
    const ds = ctx.dataSources.get("csv") as SyncDataSource;
    const result = ds.query("SELECT item FROM csv_data WHERE id = ?", [1]);
    expect(result.rows).toEqual([{ item: "apple" }]);
  });

  test("csv 路径越界 → 抛错", () => {
    expect(() =>
      openDataSource(ctx, { type: "csv", name: "evil-csv", path: "../x.csv" }),
    ).toThrow("Path escapes workspace root");
  });
});

describe("json 数据源", () => {
  test("query()（无 sql）全量读取为 DataSet", () => {
    const ds = openDataSource(ctx, { type: "json", name: "json", path: "orders.json" });
    const result = ds.query();
    expect(result).toBeInstanceOf(DataSet);
    expect(result.rows).toEqual([
      { id: 1, item: "apple", amount: 10.5 },
      { id: 2, item: "pear", amount: 3 },
    ]);
  });

  test("query(sql) 经临时内存 sqlite 查询", () => {
    const ds = ctx.dataSources.get("json") as SyncDataSource;
    const result = ds.query("SELECT count(*) AS n FROM json_data");
    expect(result.rows).toEqual([{ n: 2 }]);
  });
});

describe("数据源 close", () => {
  test("close 幂等：重复调用不抛错，close 后注册表仍保留条目（由调用方管理）", () => {
    const localCtx = createSplContext({ workspaceRoot: root });
    const ds = openDataSource(localCtx, { type: "sqlite", name: "db2", path: "test.db" });
    expect(ds.close).toBeDefined();
    ds.close!();
    ds.close!(); // 幂等
    const csv = openDataSource(localCtx, { type: "csv", name: "csv2", path: "orders.csv" });
    csv.close!();
    csv.close!();
  });

  test("同名重复注册 → 抛错（避免句柄悬挂）", () => {
    const localCtx = createSplContext({ workspaceRoot: root });
    openDataSource(localCtx, { type: "sqlite", name: "dup", path: "test.db" });
    expect(() =>
      openDataSource(localCtx, { type: "sqlite", name: "dup", path: "test.db" }),
    ).toThrow(/already registered/);
  });
});
