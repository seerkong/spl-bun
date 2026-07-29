import { expect, test } from "bun:test";
import { runSplKon, toQueryResult } from "../src";

test("Kon pivot/unpivot are real table transformations and preserve total42", () => {
  const input = {columns:["k","m","v"],rows:[{k:"A",m:"Jan",v:10},{k:"A",m:"Jan",v:5},{k:"A",m:"Feb",v:20},{k:"B",m:"Feb",v:7}]};
  const result = runSplKon('(spl_pivot #wide :{in=input keys=[k] category=m value=v reducer=sum})\n(spl_unpivot :{in=wide keys=[k] columns=[Jan Feb]})',{tables:{input}});
  const value = toQueryResult(result.value);
  expect(value.rows).toHaveLength(3);
  expect(value.rows.reduce((sum,row)=>sum+Number(row.value),0)).toBe(42);
});

test("Kon exposes all six joins with the same finite multiset cardinalities", () => {
  const left = {columns:["id"],rows:[{id:1},{id:1},{id:2}]}, right = {columns:["id"],rows:[{id:1},{id:3}]};
  for (const [type,count] of Object.entries({inner:2,left:3,full:4,semi:2,anti:1,right:3})) {
    expect(toQueryResult(runSplKon(`(spl_join :{left=left right=right on=[id] type=${type}})`,{tables:{left,right}}).value).rows).toHaveLength(count);
  }
});

test("Kon table structure, grouped blocks, dimensions and index lookup use public adapters", () => {
  const input={columns:["a","b","v"],rows:[{a:"A",b:"x",v:1},{a:"A",b:"y",v:2},{a:"B",b:"z",v:3}]};
  const config={tables:{input}};
  expect(toQueryResult(runSplKon('(spl_rename :{in=input mapping={v=amount}})',config).value).columns).toEqual(["a","b","amount"]);
  expect(toQueryResult(runSplKon('(spl_groupc #wide :{in=input keys=[a] values=[b v]})\n(spl_ungroupc :{in=wide keys=[a] values=[b v] blocks=[[b_1 v_1] [b_2 v_2]] includeNulls=false})',config).value).rows).toHaveLength(3);
  expect(toQueryResult(runSplKon('(spl_groupi :{in=input columns=[a b v]})',config).value).rows[0]).toEqual({a:"A",b:["x","y"],v:[[1],[2]]});
  expect(runSplKon('(spl_index #idx :{in=input keys=[a]})\n(spl_eval :{expr="idx.lookup([\'A\'])"})',config).value).toHaveLength(2);
});
