/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test";
import { compileExpression } from "../src/index";

describe("call syntax extensions (SPL parity)", () => {
  test("parses function @ variants", () => {
    const compiled = compileExpression('T@c("./data/sales.csv")');
    expect(compiled.ast.type).toBe("call");
    if (compiled.ast.type !== "call") throw new Error("expected call AST");
    expect(compiled.ast.callee).toBe("T");
    expect(compiled.ast.option).toBe("c");
  });

  test("parses member @ variants", () => {
    const compiled = compileExpression('f.xlsimport@t(;"School1")');
    expect(compiled.ast.type).toBe("member_call");
    if (compiled.ast.type !== "member_call") throw new Error("expected member_call AST");
    expect(compiled.ast.method).toBe("xlsimport");
    expect(compiled.ast.option).toBe("t");
    expect(compiled.ast.argGroups).toEqual([[], [{ type: "literal", value: "School1" }]]);
  });

  test("parses semicolon argument groups in function calls", () => {
    const compiled = compileExpression('T("./out.xlsx", data; "School1")');
    expect(compiled.ast.type).toBe("call");
    if (compiled.ast.type !== "call") throw new Error("expected call AST");
    expect(compiled.ast.argGroups).toEqual([
      [
        { type: "literal", value: "./out.xlsx" },
        { type: "identifier", name: "data" },
      ],
      [{ type: "literal", value: "School1" }],
    ]);

    const compiled2 = compileExpression('T("./out.xlsx"; "School1")');
    expect(compiled2.ast.type).toBe("call");
    if (compiled2.ast.type !== "call") throw new Error("expected call AST");
    expect(compiled2.ast.argGroups).toEqual([
      [{ type: "literal", value: "./out.xlsx" }],
      [{ type: "literal", value: "School1" }],
    ]);
  });
});
