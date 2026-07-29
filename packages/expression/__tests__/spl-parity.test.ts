import { expect, test } from "bun:test";
import { builtins, evaluateExpression, truthy } from "../src";

test("SPL Variant truth and count retain zero/empty string while excluding false/null", () => {
  const values = [0, "", false, null, undefined];
  expect(values.map(truthy)).toEqual([true,true,false,false,false]);
  expect(evaluateExpression("if(0,1,2)", {})).toBe(1);
  expect(evaluateExpression("count(xs)", { xs: values })).toBe(2);
  expect(evaluateExpression("xs.count()", { xs: values })).toBe(2);
  expect(evaluateExpression("xs.count('v')", { xs: { schema: [{ name: "v" }], rows: values.map(v => ({ v })) } })).toBe(2);
  expect(evaluateExpression("count(0,'',false,null)", {})).toBe(2);
  const object = {};
  expect(builtins.icount([0,"",false,null,1,"1",new Date(0),new Date(0),object,object,{}])).toBe(7);
});

test("logical operators and builtin conditional calls evaluate only the selected AST branch", () => {
  let calls = 0;
  const functions = { ...builtins, bomb: () => { calls++; throw new Error("boom"); } };
  for (const [expression, value] of [["false && bomb()",false], ["true || bomb()",true], ["if(0,1,bomb())",1], ["if(false,bomb(),2)",2], ["case(2,1,bomb(),2,7,bomb())",7]] as const) {
    expect(evaluateExpression(expression, {}, functions)).toBe(value);
  }
  expect(calls).toBe(0);
  expect(() => evaluateExpression("if(true,bomb(),2)", {}, functions)).toThrow("boom");
  expect(calls).toBe(1);
  expect(evaluateExpression("0 && ''", {})).toBe(true);
  expect(evaluateExpression("null || 0", {})).toBe(true);
  // An explicitly replaced function keeps its own ordinary call contract.
  expect(evaluateExpression("if(0,1,2)", {}, { ...builtins, if: () => "custom" })).toBe("custom");
  expect(evaluateExpression('ifp("false:unknown();7",ctx)', {ctx:{}})).toBe(7);
  expect(evaluateExpression('casep("2,1:unknown(),2:7;unknown()",ctx)', {ctx:{}})).toBe(7);
});

test("SPL concatenation preserves sequence order and duplicates independently of set operators", () => {
  expect(evaluateExpression("[1,2] | [2,3]", {})).toEqual([1,2,2,3]);
  expect(evaluateExpression("null | [2,2]", {})).toEqual([2,2]);
  expect(evaluateExpression("[1,2] & [2,3]", {})).toEqual([1,2,3]);
  expect(evaluateExpression("[1,2] ^ [2,3]", {})).toEqual([2]);
  expect(evaluateExpression("[1,2] \\ [2,3]", {})).toEqual([1]);
});

test("source multiset pairing is stable across duplicate counts, Date keys and named sequence folds",()=>{
  expect(evaluateExpression("[1,1,2] & [1,2,2,3]",{})).toEqual([1,1,2,2,3]);
  expect(evaluateExpression("[1,1,2] ^ [1,2]",{})).toEqual([1,2]);
  expect(evaluateExpression("[1,1,2] \\ [1,2]",{})).toEqual([1]);
  expect(evaluateExpression("null ^ [1]",{})).toBeNull();
  expect(()=>evaluateExpression("1 ^ [1]",{})).toThrow("array");
  const a=new Date(0),b=new Date(0);
  expect(evaluateExpression("left ^ right",{left:[a,a,1,"1"],right:[b,"1"]})).toEqual([a,"1"]);
  expect(evaluateExpression("[[1,1],[1,2]].union()",{})).toEqual([1,1,2]);
  expect(evaluateExpression("[[1,1],[1]].isect()",{})).toEqual([1]);
  expect(evaluateExpression("[[1,1],[1]].diff()",{})).toEqual([1]);
  expect(evaluateExpression("[[1,1],[1]].conj()",{})).toEqual([1,1,1]);
  expect(evaluateExpression("union([1,1],[1,2],null)",{})).toEqual([1,2]);
  expect(evaluateExpression("union([1,1])",{})).toEqual([1,1]);
  expect(evaluateExpression("[{parts:[1,1]},{parts:[1,2]}].union('parts')",{})).toEqual([1,1,2]);
  expect(evaluateExpression("[[1],[2]].union@m()",{})).toEqual([1,2]);
});

test("numeric and calendar compatibility boundaries are explicit and reproducible",()=>{
  expect(evaluateExpression("0.1+0.2",{})).toBe(0.30000000000000004);
  expect(evaluateExpression("9007199254740992+1",{})).toBe(9007199254740993n);
  expect(evaluateExpression("1/0",{})).toBe(Infinity);
  expect(Number.isNaN(evaluateExpression("0/0",{}) as number)).toBe(true);
  expect(evaluateExpression("date('not-a-date')",{})).toBeNull();
  const leap=evaluateExpression("dateadd(datetime(2024,2,28,12,0,0),1)",{}) as Date;
  expect([leap.getFullYear(),leap.getMonth()+1,leap.getDate()]).toEqual([2024,2,29]);
  const end=evaluateExpression("dateadd(datetime(2024,2,29,12,0,0),1)",{}) as Date;
  expect([end.getMonth()+1,end.getDate()]).toEqual([3,1]);
  const child=Bun.spawnSync([process.execPath,"-e",'import {evaluateExpression} from "./packages/expression/src";const a=evaluateExpression("datetime(2024,3,9,12,0,0)",{});const b=evaluateExpression("dateadd(a,1)",{a});console.log(JSON.stringify([b.getHours(),(b-a)/3600000]));'],{cwd:import.meta.dir+"/../../..",env:{...process.env,TZ:"America/New_York"}});
  expect(child.exitCode).toBe(0);expect(JSON.parse(new TextDecoder().decode(child.stdout))).toEqual([12,23]);
});
