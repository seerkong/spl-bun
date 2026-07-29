/**
 * knot-reader 纯函数测试。
 *
 * 覆盖 behavior delta（kon-spl-dsl）requirements/knot-reading 的 case：
 * - conf-and-name：`#tag` 省值 → name；`:{}` → conf。
 * - next-chain-merge：Attr 与 `:{}` 同现时 parser 把 Conf 分裂到 knot.Next
 *   （KnParserV1 L1056 guard），读取必须沿 Next 链合并。
 * 以及 requirements/spl-options 的读取侧（options 归一）：
 * - `#opt = m`（Metadata，值为 KnWord）→ options="m"（权威）。
 * - `@a @b`（省值 Attr）按出现序拼接 → options="ab"（糖）。
 * - 两者同现 → Metadata 优先（不报错）。
 *
 * 归一规则（本测试锁定）：
 * - Conf 中裸标识符值（KnWord）取 .Value 归一为字符串；字符串/数字等字面量原样。
 * - Metadata 的 opt 值若为 KnWord 同样取 .Value。
 */
import { describe, test, expect } from "bun:test";
import { detectKunun, KUNUN_CONVERTER_ENTRY } from "./helpers/kunun";

const kununAvailable = detectKunun(KUNUN_CONVERTER_ENTRY, "knot-reader");

const { readWordCall } = await import("../src/knot-reader");

async function parseKnot(src: string): Promise<any> {
  const { KnConverter } = await import("kunun");
  return KnConverter.Kon.Parser.Parse(src);
}

describe.skipIf(!kununAvailable)("readWordCall", () => {
  test("conf-and-name：#orders 落 name，:{} 落 conf，KnWord 值归一为字符串", async () => {
    const knot = await parseKnot(
      `(spl_query #orders :{ conn = db sql = "select * from orders" })`,
    );
    const r = readWordCall(knot);
    expect(r.name).toBe("orders");
    // 裸标识符 db 在 Conf 中是 KnWord，读取时归一为其 .Value 字符串
    expect(r.conf.conn).toBe("db");
    expect(r.conf.sql).toBe("select * from orders");
    expect(r.options).toBe("");
    expect(r.body).toEqual([]);
  });

  test("next-chain-merge：Attr 导致 Conf 分裂到 Next，合并后 expr 与 attr a 都可取", async () => {
    const knot = await parseKnot(`(spl_eval @a :{ expr = "A.pos(2)" })`);
    // 前置断言：确认 parser 确实把 Conf 分裂到了 Next（陷阱存在）
    expect(knot.Conf ?? null).toBeNull();
    expect(knot.Next?.Conf?.expr).toBe("A.pos(2)");

    const r = readWordCall(knot);
    expect(r.conf.expr).toBe("A.pos(2)");
    // Attr 省值 → options 糖
    expect(r.options).toBe("a");
  });

  test("选项归一：#opt = m（Metadata 值为 KnWord）→ options='m'", async () => {
    const knot = await parseKnot(
      `(spl_eval #months :{ expr = "interval(start, end)" } #opt = m)`,
    );
    const r = readWordCall(knot);
    expect(r.name).toBe("months");
    expect(r.conf.expr).toBe("interval(start, end)");
    expect(r.options).toBe("m");
  });

  test("选项归一：#opt = \"m\"（Metadata 值为字符串）→ options='m'", async () => {
    const knot = await parseKnot(`(spl_eval :{ expr = "f(x)" } #opt = "m")`);
    expect(readWordCall(knot).options).toBe("m");
  });

  test("选项归一：@a @b 按出现序拼接 → options='ab'", async () => {
    const knot = await parseKnot(`(spl_eval :{ expr = "f(x)" } @a @b)`);
    expect(readWordCall(knot).options).toBe("ab");
  });

  test("选项归一：重复 Attr 省值键去重 @a @a → options='a'（锁定现行为，P1 遗留观察）", async () => {
    const knot = await parseKnot(`(spl_eval :{ expr = "f(x)" } @a @a)`);
    expect(readWordCall(knot).options).toBe("a");
  });

  test("优先级：#opt = m 与 @a 同现 → Metadata 优先，options='m'", async () => {
    const knot = await parseKnot(`(spl_eval :{ expr = "f(x)" } #opt = m @a)`);
    expect(readWordCall(knot).options).toBe("m");
  });

  test("无 name：name 为 undefined", async () => {
    const knot = await parseKnot(`(spl_eval :{ expr = "f(x)" })`);
    expect(readWordCall(knot).name).toBeUndefined();
  });

  test("body：:[...] 归入 body 数组", async () => {
    const knot = await parseKnot(`(spl_flow :[ 1 2 ])`);
    const r = readWordCall(knot);
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body.length).toBe(2);
  });
});
