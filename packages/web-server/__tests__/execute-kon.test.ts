/**
 * POST /api/execute-kon 端点测试（behavior web-flow-api / execute-kon-endpoint）。
 *
 * 覆盖 delta 全部 case：
 * - kon-query-roundtrip：spl_connect+spl_query（及预注册 demo 数据源）脚本
 *   返回相同 data。
 * - kon-error-shape：未知数据源 / 语法错误 → {status:"error", error 含可定位
 *   信息}；源码超 64KB → error 含限制说明。
 *
 * 通过 createApp() + app.handle(new Request(...)) 直接测，不监听端口。
 * Kon 相关用例依赖本机 kunun 仓库（路径单点维护在 kon-spl-dsl 的测试 helper），
 * 缺失时跳过。
 */
import { describe, expect, test } from "bun:test";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { apiRoutes, type KonExecuteRequest } from "depa-data-web-shared";
import { createApp } from "../src/server";
import { detectKunun, KUNUN_RUNTIME_ENTRY } from "../../kon-spl-dsl/__tests__/helpers/kunun";

const kununAvailable = detectKunun(KUNUN_RUNTIME_ENTRY, "execute-kon");

const __dirname = dirname(fileURLToPath(import.meta.url));
// 独立于 server.integration.test.ts 的确定性测试库（data/out 已在 .gitignore 语义下）。
const TEST_DB_RELATIVE = join("data", "out", "demo.execute-kon-test.db");
const testDbPath = join(__dirname, "..", TEST_DB_RELATIVE);

// createApp 内部完成 demo.db 初始化（initDatabase），无需额外手工步骤。
const { app } = createApp({ dbPath: testDbPath, resetDb: true });

async function post(route: string, payload: unknown) {
  const res = await app.handle(
    new Request(`http://localhost${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
  expect(res.status).toBe(200);
  return res.json();
}

const postKon = (payload: KonExecuteRequest) => post(apiRoutes.executeKon, payload);

const ROUNDTRIP_SQL = "select AREAID, AREANAME from AREA order by AREAID limit 3";

describe.skipIf(!kununAvailable)("POST /api/execute-kon", () => {
  // ---------------------------------------------------------------------------
  // kon-query-roundtrip
  // ---------------------------------------------------------------------------

  test("kon-query-roundtrip：预注册 demo 数据源 spl_query 返回确定性 data", async () => {
    const kon = await postKon({
      source: `(spl_query #rows :{ conn = demo sql = "${ROUNDTRIP_SQL}" })`,
    });
    expect(kon.status).toBe("ok");
    expect(kon.data.columns).toEqual(["AREAID", "AREANAME"]);
    expect(kon.data.rows.length).toBe(3);
    expect(String(kon.data.rows[0]?.AREANAME).trim()).toBe("China");
  });

  test("kon-query-roundtrip：spl_connect + spl_query（相对路径连测试库）与预注册 demo 一致", async () => {
    const registered = await postKon({
      source: `(spl_query #rows :{ conn = demo sql = "${ROUNDTRIP_SQL}" })`,
    });
    const kon = await postKon({
      source: [
        `(spl_connect #db :{ type = "sqlite" path = "${TEST_DB_RELATIVE}" })`,
        `(spl_query #rows :{ conn = db sql = "${ROUNDTRIP_SQL}" })`,
      ].join("\n"),
    });
    expect(kon.status).toBe("ok");
    expect(kon.data).toEqual(registered.data);
  });

  test("csv/json 预注册数据源可经 spl_query 访问", async () => {
    const kon = await postKon({
      source: `(spl_query :{ conn = sales sql = "select count(*) as cnt from csv_data" })`,
    });
    expect(kon.status).toBe("ok");
    expect(kon.data.columns).toEqual(["cnt"]);
    expect(kon.data.rows[0]?.cnt).toBeGreaterThan(0);

    const users = await postKon({
      source: `(spl_query :{ conn = users sql = "select count(*) as cnt from json_data" })`,
    });
    expect(users.status).toBe("ok");
    expect(users.data.rows[0]?.cnt).toBeGreaterThanOrEqual(10);
  });

  test("非表格最终值放 result（data 缺席）；scope 对 spl_eval 可见", async () => {
    const scalar = await postKon({ source: `(spl_eval :{ expr = "1+41" })` });
    expect(scalar.status).toBe("ok");
    expect(scalar.result).toBe(42);
    expect(scalar.data).toBeUndefined();

    const scoped = await postKon({
      source: `(spl_eval :{ expr = "base * 2" })`,
      scope: { base: 21 },
    });
    expect(scoped.status).toBe("ok");
    expect(scoped.result).toBe(42);
  });

  // ---------------------------------------------------------------------------
  // kon-error-shape
  // ---------------------------------------------------------------------------

  test("kon-error-shape：未知数据源 → {status:'error', error 含数据源名}", async () => {
    const res = await postKon({
      source: `(spl_query :{ conn = nosuch sql = "select 1" })`,
    });
    expect(res.status).toBe("error");
    expect(typeof res.error).toBe("string");
    expect(res.error).toContain("nosuch");
  });

  test("kon-error-shape：语法错误 → {status:'error', error 非空}", async () => {
    const res = await postKon({ source: `(spl_eval :{ expr = ` });
    expect(res.status).toBe("error");
    expect(typeof res.error).toBe("string");
    expect(res.error.length).toBeGreaterThan(0);
  });

  test("kon-error-shape：源码超 64KB → error 含限制说明", async () => {
    const big = `(spl_eval :{ expr = "1" })` + " ".repeat(70000);
    const res = await postKon({ source: big });
    expect(res.status).toBe("error");
    expect(res.error).toMatch(/65536|maxSourceBytes/);
  });

  test("kon-error-shape：source 缺失或非字符串 → {status:'error'}", async () => {
    const missing = await post(apiRoutes.executeKon, {});
    expect(missing.status).toBe("error");
    expect(typeof missing.error).toBe("string");

    const wrongType = await post(apiRoutes.executeKon, { source: 42 });
    expect(wrongType.status).toBe("error");
  });

  test("每请求独立：前一请求的绑定/数据源注册不泄漏到下一请求", async () => {
    const first = await postKon({
      source: `(spl_connect #db :{ type = "sqlite" path = "${TEST_DB_RELATIVE}" })\n(spl_eval #marker :{ expr = "1" })`,
    });
    expect(first.status).toBe("ok");
    // 第二个请求引用上个请求注册的 db → 未知数据源错误
    const second = await postKon({
      source: `(spl_query :{ conn = db sql = "select 1 as one" })`,
    });
    expect(second.status).toBe("error");
    expect(second.error).toContain("db");
  });
});
