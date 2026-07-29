import { expect, test } from "bun:test";
import { DataSet, Engine, createFilterStep, AvgGather } from "../src";
import { evaluateExpression } from "depa-data-expression";

test("all aggregate entry points share absent numeric values and Variant counts", () => {
  const input = new DataSet([{ name: "v", type: "unknown" }], [{ v: 10 },{ v: null },{ v: undefined },{ v: "bad" }]);
  expect(evaluateExpression("input.avg('v')", { input })).toBe(10);
  expect(input.aggregateWithGather({ a: { type: "avg", field: "v" } }).rows).toEqual([{ a: 10 }]);
  expect(evaluateExpression("input.group({aggregates:{a:{type:'avg',field:'v'}}})", { input })).toMatchObject({ rows: [{ a: 10 }] });
  expect(DataSet.fromRows([{v:0},{v:""},{v:false},{v:null}]).aggregateWithGather({ n: { type: "count", field: "v" } }).rows).toEqual([{n:2}]);
  const empty = new DataSet(input.schema, []);
  expect(empty.aggregate({ aggregates: { n: rows => rows.length } }).rows).toEqual([{n:0}]);
  expect(empty.aggregate({ groupBy: ["v"], aggregates: { n: rows => rows.length } }).rows).toEqual([]);
  expect(empty.aggregateWithGather({ n: {type:"count"}, a:{type:"avg",field:"v"}, s:{type:"sum",field:"v"} }).rows).toEqual([{n:0,a:null,s:null}]);
  expect(input.rows[1].v).toBeNull();
  const average = new AvgGather("v");
  const left = average.gather({rows:[{v:10}],index:0});
  const right = average.gatherWith(average.gather({rows:[{v:20}],index:0}),{rows:[{v:30}],index:0});
  expect(average.finish(average.gatherWith(left,{rows:[{v:right}],index:0}))).toBe(20);
});

test("derive has sequential visibility; schema binding distinguishes unknown and sparse fields", async () => {
  const input = DataSet.fromRows([{x:1,a:100},{x:2,a:200}]);
  expect(input.withComputedColumns({a:"x+1",b:"a+1"}).rows).toEqual([{x:1,a:2,b:3},{x:2,a:3,b:4}]);
  expect(evaluateExpression("input.derive({a:'x+1',b:'a+1'})",{input})).toMatchObject({rows:[{x:1,a:2,b:3},{x:2,a:3,b:4}]});
  expect(input.rows[0].a).toBe(100);
  expect(() => input.filterExpr("missing > 0")).toThrow(/Unknown field 'missing'.*missing > 0/);
  const sparse = new DataSet([{name:"v",type:"unknown"}], [{},{v:1}]);
  expect(sparse.filterExpr("v > 0").rows).toEqual([{v:1}]);
  expect(sparse.filterExpr("v == null", {v:99}).rows).toEqual([{}]);
  expect(() => sparse.withComputedColumns({b:"missing+1"})).toThrow("missing");
  const engine = new Engine();
  await expect(engine.run([{name:"input",execute:()=>input},createFilterStep("broken",{sourceStep:"input",expression:"missing>0"})])).rejects.toThrow(/broken.*missing/);
});
