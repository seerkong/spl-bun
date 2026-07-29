import { describe, expect, test } from "bun:test";

import { evaluateExpression } from "../src/index";

describe("regex()", () => {
  test("builtin and member forms are equivalent", () => {
    const builtin = evaluateExpression('regex("a1b2", "(\\\\d)")', {});
    const member = evaluateExpression('"a1b2".regex("(\\\\d)")', {});
    expect(member).toEqual(builtin);
  });

  test("no capture groups returns original string on match", () => {
    expect(evaluateExpression('regex("abc", "b")', {})).toBe("abc");
    expect(evaluateExpression('regex("abc", "z")', {})).toBeNull();
  });

  test("one capture group returns list of captured values", () => {
    expect(evaluateExpression('regex("a1b2", "(\\\\d)")', {})).toEqual(["1", "2"]);
  });

  test("multiple capture groups return list of tuples", () => {
    expect(evaluateExpression('regex("x=1,y=2", "(\\\\w)=(\\\\d)")', {})).toEqual([
      ["x", "1"],
      ["y", "2"],
    ]);
  });

  test("replacement first vs all", () => {
    expect(evaluateExpression('regex("a1b2", "(\\\\d)", "X")', {})).toBe("aXb2");
    expect(evaluateExpression('regex("a1b2", "(\\\\d)", "X", "a")', {})).toBe("aXbX");
  });

  test("parse extracted groups with option 'p'", () => {
    expect(evaluateExpression('regex("a1b2", "(\\\\d)", "p")', {})).toEqual([1, 2]);
  });

  test("option 'w' enforces whole-string match", () => {
    expect(evaluateExpression('regex("abc", "b", "w")', {})).toBeNull();
    expect(evaluateExpression('regex("abc", "abc", "w")', {})).toBe("abc");
  });

  test("option 'c' makes matching case-insensitive", () => {
    expect(evaluateExpression('regex("AbC", "abc", "c")', {})).toBe("AbC");
  });

  test("replacement honors option 'c' and 'a'", () => {
    expect(evaluateExpression('regex("aAa", "a", "X", "ca")', {})).toBe("XXX");
  });
});
