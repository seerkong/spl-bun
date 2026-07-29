import { describe, expect, test } from "bun:test";

import { evaluateExpression } from "../src/index";

describe("math phase-2 builtins", () => {
  test("exp() computes e^x", () => {
    expect(evaluateExpression("exp(1)", {})).toBeCloseTo(2.718281828, 6);
  });

  test("ln() is natural logarithm", () => {
    expect(evaluateExpression("ln(exp(2))", {})).toBeCloseTo(2, 6);
  });

  test("sign() returns -1/0/1", () => {
    expect(evaluateExpression("sign(-3)", {})).toBe(-1);
    expect(evaluateExpression("sign(0)", {})).toBe(0);
    expect(evaluateExpression("sign(7)", {})).toBe(1);
  });

  test("sign(null) returns null", () => {
    expect(evaluateExpression("sign(null)", {})).toBeNull();
  });

  test("gcd() and lcm() accept arrays and variadic numbers", () => {
    expect(evaluateExpression("gcd([12, 18])", {})).toBe(6);
    expect(evaluateExpression("lcm(3, 4, 6)", {})).toBe(12);
  });

  test("lcm() returns 0 when any input is <= 0 (Java parity)", () => {
    expect(evaluateExpression("lcm(3, 0)", {})).toBe(0);
    expect(evaluateExpression("lcm(3, -2)", {})).toBe(0);
  });

  test("gcd() returns 0 when any input is < 0 (Java parity)", () => {
    expect(evaluateExpression("gcd(3, -1)", {})).toBe(0);
    expect(evaluateExpression("gcd([-1, 3])", {})).toBe(0);
  });
});
