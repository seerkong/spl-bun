import { expect, test } from "bun:test";
import { runSplKon, toQueryResult } from "../src";

const input = { columns: ["dept", "id", "a", "b"], rows: [{ dept: "E", id: 2, a: 20, b: 200 }, { dept: "E", id: 1, a: 10, b: 100 }, { dept: "W", id: 3, a: 4, b: 30 }] };
const tables = { input };

test("native window maps partition/order/outputs, named results and expression scope", () => {
  const result = runSplKon(`(spl_window #w :{in = input partitionBy = [dept] by = [id]
    outputs = {rowNumber = rn rank = r denseRank = dr runningSum = {column = a as = sa expression = "a*scale"} runningAvg = {column = b as = ab}}
    with = {scale = 2}})
    (spl_select :{in = w where = "rn > 1"})`, { tables });
  expect(toQueryResult(result.value)?.rows).toEqual([{ dept: "E", id: 2, a: 20, b: 200, rn: 2, r: 2, dr: 2, sa: 60, ab: 150 }]);
  expect(input.rows[0]).toEqual({ dept: "E", id: 2, a: 20, b: 200 });
});

test("core orderBy shape, ties, empty table schema and invocation isolation", () => {
  const result = runSplKon('(spl_window :{in = input orderBy = [{column = a direction = desc}] outputs = {rank = r}})', { tables });
  expect(toQueryResult(result.value)?.rows.map((r) => r.a)).toEqual([20, 10, 4]);
  const empty = runSplKon('(spl_window #w :{in = input by = id outputs = {rowNumber = rn}})', { tables: { input: { columns: input.columns, rows: [] } } });
  expect(toQueryResult(empty.value)).toEqual({ columns: [...input.columns, "rn"], rows: [] });
  expect(() => runSplKon('(spl_window :{in = w by = id outputs = {rank = r}})', { tables })).toThrow("w");
});

test("window diagnoses missing columns, unsupported outputs and duplicate aliases", () => {
  for (const [source, error] of [
    ['(spl_window :{in = input outputs = {rank = r}})', "orderBy"],
    ['(spl_window :{in = input by = missing outputs = {rank = r}})', "unknown input column"],
    ['(spl_window :{in = input by = id outputs = {lag = prev}})', "must be a list"],
    ['(spl_window :{in = input by = id outputs = {rank = x rowNumber = x}})', "Duplicate"],
  ]) expect(() => runSplKon(source, { tables })).toThrow(error);
});

test('Kon exposes relative row and frame declarations and keeps null/decimal policies through table adapters',()=>{
 const input={columns:['k','id','v'],rows:[{k:'A',id:1,v:'0.1'},{k:'A',id:2,v:null},{k:'A',id:3,v:'0.2'},{k:'B',id:1,v:'1'}]};
 const source=`(spl_derive #d :{in=input cols={v="decimal(v)"}})
 (spl_window :{in=d partitionBy=[k] by=id outputs={runningAvg={column=v as=mean} lag=[{column=v as=previous}] lead=[{column=v as=next defaultValue="end"}] frames=[{kind=sum column=v as=moving start=-1 end=0} {kind=count as=n start=null end=null}]}})`;
 const rows=toQueryResult(runSplKon(source,{tables:{input}}).value)!.rows;
 expect(rows.map(row=>String(row.mean))).toEqual(['0.1','0.1','0.15','1']);
 expect(rows.map(row=>String(row.previous))).toEqual(['null','0.1','null','null']);
 expect(rows.map(row=>String(row.next))).toEqual(['null','0.2','end','end']);
 expect(rows.map(row=>String(row.moving))).toEqual(['0.1','0.1','0.2','1']);
 expect(rows.map(row=>row.n)).toEqual([3,3,3,1]);
});
