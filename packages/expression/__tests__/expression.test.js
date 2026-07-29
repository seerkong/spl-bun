import { compileExpression, evaluateExpression } from "../src/index";
const scope = { a: 2, b: 5, name: null, text: "Hello", nums: [1, 2, 3] };
describe("expression parser and evaluator", () => {
    test("respects operator precedence and parentheses", () => {
        expect(evaluateExpression("a + b * 2", scope)).toBe(12);
        expect(evaluateExpression("(a + b) * 2", scope)).toBe(14);
        expect(evaluateExpression("-a + b", scope)).toBe(3);
    });
    test("logical operators and null semantics", () => {
        expect(evaluateExpression("a > 1 and b < 10", scope)).toBe(true);
        expect(evaluateExpression("name == null", scope)).toBe(true);
        expect(evaluateExpression("name != null", scope)).toBe(false);
        expect(evaluateExpression("name or a", scope)).toBe(true);
    });
    test("functions basic set", () => {
        expect(evaluateExpression("len(text)", scope)).toBe(5);
        expect(evaluateExpression("upper(text)", scope)).toBe("HELLO");
        expect(evaluateExpression("nvl(name, \"unknown\")", scope)).toBe("unknown");
        expect(evaluateExpression("sum(nums)", scope)).toBe(6);
        expect(evaluateExpression("avg(nums)", scope)).toBeCloseTo(2);
    });
    test("datetime helpers", () => {
        const d = new Date("2024-01-01T00:00:00Z");
        const s = { d };
        expect(evaluateExpression("format(d, \"date\")", s)).toBe("2024-01-01");
        expect(typeof evaluateExpression("now()", s)).toBe("object");
        expect(evaluateExpression("datediff(dateadd(d, 1), d)", s)).toBeCloseTo(1);
    });
    test("compiled expression reuse", () => {
        const compiled = compileExpression("a * b + len(text)");
        expect(compiled.evaluate(scope)).toBe(15);
        expect(compiled.evaluate({ a: 1, b: 10, text: "abc" })).toBe(13);
    });
});
