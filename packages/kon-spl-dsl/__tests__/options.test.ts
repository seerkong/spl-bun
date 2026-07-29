/**
 * applyOptions 纯函数测试。
 *
 * 覆盖 behavior delta（kon-spl-dsl）requirements/spl-options 的改写侧：
 * - metadata-opt：interval(start, end) + "m" → interval@m(start, end)
 * - attr-sugar：A.pos(2) + "a" → A.pos@a(2)（成员调用改写方法名）
 * - conflict-error：表达式已含 @y 且声明 m → 抛含冲突说明的错误
 * 以及边界：幂等（已含相同选项）、空选项原样返回、
 * 最外层不是调用（如 "1+1"）→ 抛错并引导直接在表达式串内写 @opt。
 */
import { describe, test, expect } from "bun:test";
import { applyOptions } from "../src/options";
import { compileExpression } from "depa-data-expression";

describe("applyOptions", () => {
  test("顶层函数调用：interval(start, end) + m → interval@m(start, end)", () => {
    expect(applyOptions("interval(start, end)", "m")).toBe(
      "interval@m(start, end)",
    );
  });

  test("顶层成员调用：A.pos(2) + a → A.pos@a(2)", () => {
    expect(applyOptions("A.pos(2)", "a")).toBe("A.pos@a(2)");
  });

  test("多字符选项串整体注入：f(x) + ab → f@ab(x)", () => {
    expect(applyOptions("f(x)", "ab")).toBe("f@ab(x)");
  });

  test("改写结果可被 depa-data-expression 编译且 option 正确", () => {
    const out = applyOptions("orders.select(amount>10)", "o");
    expect(out).toBe("orders.select@o(amount>10)");
    const ast: any = compileExpression(out).ast;
    expect(ast.type).toBe("member_call");
    expect(ast.option).toBe("o");
  });

  test("alias 参数能被静态解析与注入选项，运行时仍验证支持的选项", () => {
    expect(applyOptions("orders.derive(amount*rate:gross)", "o")).toBe("orders.derive@o(amount*rate:gross)");
  });

  test("冲突：interval@y(...) 又声明 m → 抛含冲突说明的错误", () => {
    expect(() => applyOptions("interval@y(start, end)", "m")).toThrow(
      /冲突|conflict/i,
    );
    // 错误信息应同时点名两个选项
    expect(() => applyOptions("interval@y(start, end)", "m")).toThrow(/y/);
    expect(() => applyOptions("interval@y(start, end)", "m")).toThrow(/m/);
  });

  test("幂等：已含相同选项时原样返回", () => {
    expect(applyOptions("interval@m(start, end)", "m")).toBe(
      "interval@m(start, end)",
    );
    expect(applyOptions("A.pos@a(2)", "a")).toBe("A.pos@a(2)");
  });

  test("空选项：原样返回", () => {
    expect(applyOptions("interval(start, end)", "")).toBe(
      "interval(start, end)",
    );
    expect(applyOptions("1+1", "")).toBe("1+1");
  });

  test("最外层非调用（纯字面量表达式）带选项 → 抛错并引导在表达式串内写 @opt", () => {
    expect(() => applyOptions("1+1", "m")).toThrow(/@/);
    expect(() => applyOptions("1+1", "m")).toThrow(/最外层|outermost/i);
  });

  test("复杂 object 的成员调用：(a+b).f(x) + m → (a+b).f@m(x)", () => {
    expect(applyOptions("(a+b).f(x)", "m")).toBe("(a+b).f@m(x)");
  });

  test("参数含括号字符串不干扰定位：f(\"a(b\") + m → f@m(\"a(b\")", () => {
    expect(applyOptions('f("a(b")', "m")).toBe('f@m("a(b")');
  });
});
