import { evalParamTree, parseParamTree, replaceMacros, compileExpression } from "../src/index";

describe("param parser", () => {
  test("parses nested separators", () => {
    const tree = parseParamTree("a:b,c:d;e");
    expect(tree?.type).toBe("symbol");
    expect(tree && tree.type === "symbol" ? tree.separator : null).toBe(";");
    const topChildren = tree && tree.type === "symbol" ? tree.children : [];
    expect(topChildren.length).toBe(2);
  });

  test("evaluates leaf expressions", () => {
    const tree = parseParamTree("1+2,3*4");
    const evalLeaf = (raw: string, scope: Record<string, unknown>) => compileExpression(raw).evaluate(scope);
    const result = evalParamTree(tree, {}, evalLeaf);
    expect(result).toEqual([3, 12]);
  });
});

describe("macro replacement", () => {
  test("replaces ${} with expression result", () => {
    const out = replaceMacros("hello ${1+2}", {});
    expect(out).toBe("hello 3");
  });

  test("replaces $(name) with macro value", () => {
    const out = replaceMacros("value $(name)", { name: "x" });
    expect(out).toBe("value x");
  });
});
