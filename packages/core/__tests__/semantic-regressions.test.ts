import { expect, test } from "bun:test";
import { DataSet } from "../src";
import { evaluateExpression } from "depa-data-expression";

test("grouping preserves composite keys, types, dates and first encounter order", () => {
  const rows = [{ a: "x|y", b: "z" }, { a: "x", b: "y|z" }];
  expect(DataSet.fromRows(rows).aggregate({ groupBy: ["a", "b"], aggregates: { n: (r) => r.length } }).rows).toEqual(rows.map((r) => ({ ...r, n: 1 })));
  const data = DataSet.fromRows([{ k: 1 }, { k: "1" }, { k: null }, {}, { k: "undefined" }, { k: new Date(0) }, { k: new Date(0) }]);
  const groups = data.aggregate({ groupBy: ["k"], aggregates: { n: (r) => r.length } });
  expect(groups.rows.map((r) => r.n)).toEqual([1, 1, 1, 1, 1, 2]);
  expect(groups.rows[0].k).toBe(1); expect(groups.schema[0].type).toBe("number");
  const member = evaluateExpression('data.group({groupBy:["k"],aggregates:{n:{type:"count"}}})', { data }) as { rows: unknown[] };
  expect(member.rows).toEqual(groups.rows);
});

test("join keys cannot collide through delimiters, coercion or implicit case folding", () => {
  const left = DataSet.fromRows([{ a: "x\u0001y", b: "z" }, { a: 1, b: 2 }, { a: "A", b: 3 }]);
  const right = DataSet.fromRows([{ a: "x", b: "y\u0001z" }, { a: "1", b: 2 }, { a: "a", b: 3 }]);
  const spec = { type: "inner" as const, leftKeys: ["a", "b"] };
  expect(left.join(right, spec).rows).toEqual([]);
  const member = evaluateExpression('left.join(right,{type:"inner",leftKeys:["a","b"]})', { left, right }) as { rows: unknown[] };
  expect(member.rows).toEqual([]);
  expect(DataSet.fromRows([{ key: new Date(0) }]).join(DataSet.fromRows([{ key: new Date(0), v: 7 }]), { type: "inner", leftKeys: ["key"] }).rows[0].v).toBe(7);
});

test("join columns use declared schema across sparse rows and reject prefix collisions", () => {
  const left = DataSet.fromRows([{ id: 1, a: "left" }, { id: 2 }]);
  const right = DataSet.fromRows([{ id: 2, a: "right" }]);
  const spec = { type: "left" as const, leftKeys: ["id"] };
  expect(left.join(right, spec).rows[1].right_a).toBe("right");
  expect(() => DataSet.fromRows([{ id: 1, right_id: "kept" }]).join(DataSet.fromRows([{ id: 1 }]), { type: "inner", leftKeys: ["id"] })).toThrow("column collision");
  expect(DataSet.fromRows([{ id: 1 }, { id: 2, later: 3 }]).schema.map((c) => c.name)).toEqual(["id", "later"]);
});

test("sum(a) and avg(b) have independent accumulators, including scoped expressions", () => {
  const data = DataSet.fromRows([{ id: 1, a: 10, b: 100 }, { id: 2, a: 20, b: 200 }]);
  const result = data.window({ orderBy: [{ column: "id" }], outputs: { runningSum: { column: "a", as: "sa" }, runningAvg: { column: "b", as: "ab" } } });
  expect(result.rows.map((r) => [r.sa, r.ab])).toEqual([[10, 100], [30, 150]]);
  const scoped = data.window({ orderBy: [{ column: "id" }], outputs: { runningSum: { column: "a", expression: "a*scale", as: "s" }, runningAvg: { column: "b", expression: "b+offset", as: "a" } } }, { scale: 2, offset: 1 });
  expect(scoped.rows.map((r) => [r.s, r.a])).toEqual([[20, 101], [60, 151]]);
  expect(data.rows[0].a).toBe(10);
});

test("partition types remain distinct and date peers receive equal ranks", () => {
  const data = DataSet.fromRows([{ k: 1, id: 1 }, { k: "1", id: 2 }]);
  expect(data.window({ partitionBy: ["k"], orderBy: [{ column: "id" }], outputs: { rowNumber: "n" } }).rows.map((r) => r.n)).toEqual([1, 1]);
  const dates = DataSet.fromRows([{ date: new Date(1) }, { date: new Date(0) }, { date: new Date(0) }]);
  expect(dates.window({ orderBy: [{ column: "date" }], outputs: { rank: "r", denseRank: "dr" } }).rows.map((r) => [r.r, r.dr])).toEqual([[1, 1], [1, 1], [3, 2]]);
  expect(() => data.window({ orderBy: [{ column: "id" }], outputs: { rowNumber: "x", rank: "x" } })).toThrow("Duplicate");
});
