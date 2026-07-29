import { FunctionRegistryBuilder, evaluateExpression } from "../src/index";

describe("function registry builder", () => {
  test("extends builtins", () => {
    const registry = new FunctionRegistryBuilder().add("double", (v: unknown) => Number(v) * 2).build();
    expect(evaluateExpression("double(5)", {}, registry)).toBe(10);
  });
});
