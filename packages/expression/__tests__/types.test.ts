import { evaluateTypedExpression, makeCursorHandle, makeDbHandle, makeFileHandle, TYPE_CURSOR, TYPE_DB, TYPE_FILE, TYPE_SEQUENCE, TYPE_TABLE } from "../src/index";

describe("typed expression evaluation", () => {
  test("returns sequence type for arrays", () => {
    const result = evaluateTypedExpression("nums", { nums: [1, 2, 3] });
    expect(result.type).toBe(TYPE_SEQUENCE);
    expect(result.value).toEqual([1, 2, 3]);
  });

  test("returns table type for objects", () => {
    const result = evaluateTypedExpression("obj", { obj: { a: 1 } });
    expect(result.type).toBe(TYPE_TABLE);
  });

  test("typed wrappers yield explicit types", () => {
    expect(evaluateTypedExpression("db", { db: makeDbHandle({}) }).type).toBe(TYPE_DB);
    expect(evaluateTypedExpression("file", { file: makeFileHandle({}) }).type).toBe(TYPE_FILE);
    expect(evaluateTypedExpression("cursor", { cursor: makeCursorHandle({}) }).type).toBe(TYPE_CURSOR);
  });
});
