/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test";

import { builtins, evaluateExpression, type FunctionRegistry } from "../src/index";

describe("evaluator dispatch (options and arg groups)", () => {
  const registry: FunctionRegistry = {
    ...builtins,
    echo: (...args: unknown[]) => args,
  };

  test("passes @ options as last argument", () => {
    expect(evaluateExpression("echo@ab(1,2)", {}, registry)).toEqual([1, 2, "ab"]);
  });

  test("normalizes @ options to lowercase", () => {
    expect(evaluateExpression("echo@AB(1)", {}, registry)).toEqual([1, "ab"]);
  });

  test("passes argGroups when semicolon groups are present", () => {
    expect(evaluateExpression("echo(1,2;3)", {}, registry)).toEqual([1, 2, 3, [[1, 2], [3]]]);
  });

  test("passes argGroups before option", () => {
    expect(evaluateExpression("echo@x(1;2)", {}, registry)).toEqual([1, 2, [[1], [2]], "x"]);
  });
});
