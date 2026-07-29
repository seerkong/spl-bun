import { expect, test } from "bun:test";
import { DataSet, type JoinType } from "../src";
import { evaluateExpression } from "depa-data-expression";

test("pivot and unpivot preserve sums, schema, encounter order and explicit duplicate/null policies", () => {
  const source = [{k:"A",m:"Jan",v:10},{k:"A",m:"Jan",v:5},{k:"A",m:"Feb",v:20},{k:"B",m:"Feb",v:7}];
  const input = DataSet.fromRows(source), spec = {keys:["k"],category:"m",value:"v",reducer:"sum" as const};
  const output = input.pivot(spec);
  expect(output.rows).toEqual([{k:"A",Jan:15,Feb:20},{k:"B",Jan:null,Feb:7}]);
  expect(output.schema.map(column=>column.name)).toEqual(["k","Jan","Feb"]);
  const reverse = output.unpivot({keys:["k"],columns:["Jan","Feb"]});
  expect(reverse.rows).toEqual([{k:"A",category:"Jan",value:15},{k:"A",category:"Feb",value:20},{k:"B",category:"Feb",value:7}]);
  expect(reverse.rows.reduce((sum,row)=>sum+Number(row.value),0)).toBe(42);
  expect(output.unpivot({keys:["k"],columns:["Jan","Feb"],includeNulls:true}).rows).toHaveLength(4);
  expect(evaluateExpression("input.pivot(spec)",{input,spec})).toEqual({rows:output.rows,schema:output.schema});
  expect(() => input.pivot({...spec,reducer:"error"})).toThrow("Duplicate pivot");
  expect(source[0].v).toBe(10);
});

test("pivot typed categories require distinct aliases; empty input has declared columns", () => {
  const input = DataSet.fromRows([{k:1,c:1,v:2},{k:"1",c:"1",v:3}]);
  const spec = {keys:["k"],category:"c",value:"v",columns:[{value:1,as:"number"},{value:"1",as:"text"}]};
  expect(input.pivot(spec).rows).toEqual([{k:1,number:2,text:null},{k:"1",number:null,text:3}]);
  expect(new DataSet(input.schema,[]).pivot(spec).schema.map(column=>column.name)).toEqual(["k","number","text"]);
  expect(() => input.pivot({keys:["k"],category:"c",value:"v"})).toThrow("collision");
  expect(() => input.pivot({...spec,value:"missing"})).toThrow("missing");
  expect(() => input.pivot({...spec,columns:[{value:1,as:"k"}]})).toThrow("collision");
});

test("six joins share stable cardinalities across core and member; right/full retain orphan schema", () => {
  const left = DataSet.fromRows([{id:1,l:"a"},{id:1,l:"b"},{id:2,l:"c"}]);
  const right = DataSet.fromRows([{id:1,r:"x"},{id:3,r:"y"}]);
  for (const [type,count] of Object.entries({inner:2,left:3,full:4,semi:2,anti:1,right:3})) {
    const spec = {type:type as JoinType,leftKeys:["id"]}, result = left.join(right,spec);
    expect(result.rows).toHaveLength(count);
    expect(evaluateExpression("left.join(right,spec)",{left,right,spec})).toEqual({schema:result.schema,rows:result.rows});
  }
  expect(left.join(right,{type:"full",leftKeys:["id"]}).rows[3]).toEqual({id:undefined,l:undefined,right_id:3,r:"y"});
  expect(left.join(right,{type:"right",leftKeys:["id"]}).rows.map(row=>row.r)).toEqual(["x","x","y"]);
  expect(left.join(DataSet.fromRows([{id:1},{id:1}]),{type:"inner",leftKeys:["id"]}).rows).toHaveLength(4);
  expect(left.rows[0]).toEqual({id:1,l:"a"});
});

test("join type equality, empty inputs, sparse fields, Date keys and collisions remain exact", () => {
  const left = new DataSet([{name:"k",type:"unknown"}],[{k:null},{},{k:1},{k:new Date(0)}]);
  const right = new DataSet([{name:"k",type:"unknown"}],[{k:undefined},{k:"1"},{k:new Date(0)}]);
  expect(left.join(right,{type:"inner",leftKeys:["k"]}).rows).toHaveLength(2);
  expect(new DataSet(left.schema,[]).join(right,{type:"full",leftKeys:["k"]}).rows).toHaveLength(3);
  expect(left.join(new DataSet(right.schema,[]),{type:"anti",leftKeys:["k"]}).rows).toHaveLength(4);
  expect(() => DataSet.fromRows([{k:1,right_k:2}]).join(right,{type:"full",leftKeys:["k"]})).toThrow("collision");
  expect(() => left.join(right,{type:"inner",leftKeys:["missing"]})).toThrow("missing");
});

test("table rename/alter and typed read-only indexes produce independent structural values", () => {
  const input = DataSet.fromRows([{k:1,a:"2"},{k:"1",a:"3"},{k:new Date(0),a:"4"}]);
  expect(input.rename({a:"b"}).rows.map(row=>row.b)).toEqual(["2","3","4"]);
  expect(() => input.rename({a:"k"})).toThrow("collision");
  expect(input.alter([{name:"a",type:"number"},{name:"new",type:"string",defaultValue:"x"}]).rows).toEqual([{a:2,new:"x"},{a:3,new:"x"},{a:4,new:"x"}]);
  expect(() => DataSet.fromRows([{k:"invalid"}]).alter([{name:"k",type:"number"}])).toThrow("convert");
  const index = input.index(["k"],true);
  expect(index.lookup([1])).toEqual([{k:1,a:"2"}]);
  expect(index.lookup(["1"])).toEqual([{k:"1",a:"3"}]);
  expect(index.lookup([new Date(0)])[0].a).toBe("4");
  expect(() => (index.lookup([1]) as unknown[]).push({})).toThrow();
  input.rows[0].a="changed";
  expect(index.lookup([1])[0].a).toBe("2");
  expect(() => DataSet.fromRows([{k:1},{k:1}]).index(["k"],true)).toThrow("Duplicate");
});

test("adjacent grouping, source groupc block columns and groupi nested dimensions have distinct semantics", () => {
  const input=DataSet.fromRows([{a:"A",b:"x",v:1},{a:"A",b:"y",v:2},{a:"A",b:"x",v:3},{a:"B",b:"z",v:4},{a:"A",b:"x",v:5}]);
  expect(input.groupRows({keys:["a"],adjacent:true}).rows.map(row=>(row.rows as unknown[]).length)).toEqual([3,1,1]);
  expect(input.groupRows({keys:["a"]}).rows.map(row=>(row.rows as unknown[]).length)).toEqual([4,1]);
  const wide=input.groupc({keys:["a"],values:["b","v"]});
  expect(wide.rows[0]).toEqual({a:"A",b_1:"x",v_1:1,b_2:"y",v_2:2,b_3:"x",v_3:3,b_4:"x",v_4:5});
  expect(wide.ungroupc({keys:["a"],values:["b","v"],blocks:[["b_1","v_1"],["b_2","v_2"],["b_3","v_3"],["b_4","v_4"]],includeNulls:false}).rows.map(row=>row.v)).toEqual([1,2,3,5,4]);
  expect(input.groupi({columns:["a","b","v"]}).rows).toEqual([{a:"A",b:["x","y"],v:[[1,3,5],[2]]},{a:"B",b:["z"],v:[[4]]}]);
  expect(evaluateExpression("input.groupi({columns:['a','b','v']})",{input})).toEqual({schema:input.groupi({columns:["a","b","v"]}).schema,rows:input.groupi({columns:["a","b","v"]}).rows});
  expect(input.rows[1].b).toBe("y");
});
