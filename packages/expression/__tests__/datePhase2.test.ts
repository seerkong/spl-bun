import { describe, expect, test } from "bun:test";

import { evaluateExpression } from "../src/index";

function ymd(value: unknown): string {
  if (!(value instanceof Date)) {
    throw new Error("expected Date");
  }
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

describe("date phase-2 builtins", () => {
  test("age() default uses month/day adjustment", () => {
    expect(
      evaluateExpression(
        "age(datetime(2000, 6, 15, 0, 0, 0), datetime(2026, 6, 14, 0, 0, 0))",
        {},
      ),
    ).toBe(25);
  });

  test("age() option 'y' ignores month/day", () => {
    expect(
      evaluateExpression(
        "age(datetime(2000, 6, 15, 0, 0, 0), datetime(2026, 6, 14, 0, 0, 0), 'y')",
        {},
      ),
    ).toBe(26);
  });

  test("age() option 'm' adjusts by month only", () => {
    expect(
      evaluateExpression(
        "age(datetime(2000, 6, 15, 0, 0, 0), datetime(2026, 6, 14, 0, 0, 0), 'm')",
        {},
      ),
    ).toBe(26);
  });

  test("workday() shifts across weekends", () => {
    const out = evaluateExpression("workday(datetime(2026, 1, 2, 0, 0, 0), 1)", {});
    expect(ymd(out)).toBe("2026-01-05");
  });

  test("workday() supports negative shifts", () => {
    const out = evaluateExpression("workday(datetime(2026, 1, 5, 0, 0, 0), -1)", {});
    expect(ymd(out)).toBe("2026-01-02");
  });

  test("workday() treats weekday offDays as holidays", () => {
    const out = evaluateExpression(
      "workday(datetime(2026, 1, 2, 0, 0, 0), 1, [datetime(2026, 1, 5, 0, 0, 0)])",
      {},
    );
    expect(ymd(out)).toBe("2026-01-06");
  });

  test("workday() treats weekend offDays as adjusted workdays", () => {
    const out = evaluateExpression(
      "workday(datetime(2026, 1, 2, 0, 0, 0), 1, [datetime(2026, 1, 3, 0, 0, 0)])",
      {},
    );
    expect(ymd(out)).toBe("2026-01-03");
  });

  test("workdays() returns list of workdays (inclusive)", () => {
    const out = evaluateExpression(
      "workdays(datetime(2026, 1, 1, 0, 0, 0), datetime(2026, 1, 7, 0, 0, 0))",
      {},
    ) as unknown[];
    expect(out.map(ymd)).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-05",
      "2026-01-06",
      "2026-01-07",
    ]);
  });

  test("workdays(...,'n') returns count", () => {
    expect(
      evaluateExpression(
        "workdays(datetime(2026, 1, 1, 0, 0, 0), datetime(2026, 1, 7, 0, 0, 0), 'n')",
        {},
      ),
    ).toBe(5);
  });

  test("workdays() option 'x' excludes the end date", () => {
    const out = evaluateExpression(
      "workdays(datetime(2026, 1, 1, 0, 0, 0), datetime(2026, 1, 7, 0, 0, 0), 'x')",
      {},
    ) as unknown[];
    expect(out.map(ymd)).toEqual(["2026-01-01", "2026-01-02", "2026-01-05", "2026-01-06"]);

    expect(
      evaluateExpression(
        "workdays(datetime(2026, 1, 1, 0, 0, 0), datetime(2026, 1, 7, 0, 0, 0), 'nx')",
        {},
      ),
    ).toBe(4);
  });

  test("workdays() applies offDays holiday + weekend override", () => {
    const out = evaluateExpression(
      "workdays(datetime(2026, 1, 1, 0, 0, 0), datetime(2026, 1, 7, 0, 0, 0), [datetime(2026, 1, 5, 0, 0, 0), datetime(2026, 1, 3, 0, 0, 0)])",
      {},
    ) as unknown[];
    expect(out.map(ymd)).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-06",
      "2026-01-07",
    ]);
  });
});
