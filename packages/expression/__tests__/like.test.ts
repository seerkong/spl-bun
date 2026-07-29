import { describe, expect, test } from "bun:test";

import { evaluateExpression } from "../src/index";

describe("like()", () => {
  test("standard wildcards '*' and '?'", () => {
    expect(evaluateExpression('like("hello", "he*o")', {})).toBe(true);
    expect(evaluateExpression('like("hello", "he?lo")', {})).toBe(true);
    expect(evaluateExpression('like("hello", "he?l?")', {})).toBe(true);
    expect(evaluateExpression('like("hello", "he?l")', {})).toBe(false);
  });

  test("escapes wildcard characters", () => {
    expect(evaluateExpression('like("a*b", "a\\\\*b")', {})).toBe(true);
    expect(evaluateExpression('like("a?b", "a\\\\?b")', {})).toBe(true);
  });

  test("SQL wildcards with option 's'", () => {
    expect(evaluateExpression('like("abcd", "a%", "s")', {})).toBe(true);
    expect(evaluateExpression('like("abcd", "a___", "s")', {})).toBe(true);
    expect(evaluateExpression('like("abcd", "A%", "s")', {})).toBe(false);
  });

  test("option 'c' makes matching case-insensitive (non-SQL)", () => {
    expect(evaluateExpression('like("Hello", "he*o", "c")', {})).toBe(true);
  });

  test("option 'c' ignored when combined with 's'", () => {
    expect(evaluateExpression('like("Hello", "he%o", "sc")', {})).toBe(false);
  });

  test("SQL wildcard escaping", () => {
    expect(evaluateExpression('like("a%b", "a\\\\%b", "s")', {})).toBe(true);
    expect(evaluateExpression('like("a_b", "a\\\\_b", "s")', {})).toBe(true);
  });

  test("null inputs return false", () => {
    expect(evaluateExpression('like(null, "*")', {})).toBe(false);
    expect(evaluateExpression('like("x", null)', {})).toBe(false);
  });
});
