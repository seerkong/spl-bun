import { expect, test } from "bun:test";
import { runSplKon, toQueryResult } from "../src";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CsvDataSource } from "../../spl-flow/src/datasource/csv";
import { JsonDataSource } from "../../spl-flow/src/datasource/json";
import { Cursor } from "depa-data-expression";

test("Kon native aggregate counts, compound AST and empty schema match core rules", () => {
  const input = {columns:["a","b","v"],rows:[{a:10,b:1,v:0},{a:20,b:3,v:""},{a:null,b:null,v:false},{a:null,b:null,v:null}]};
  const query = '(spl_groups :{in=input agg={ratio="sum(a)/sum(b)" a="avg(a)" n="count(v)" d="icount(v)"}})';
  expect(toQueryResult(runSplKon(query,{tables:{input}}).value)).toEqual({columns:["ratio","a","n","d"],rows:[{ratio:7.5,a:15,n:2,d:2}]});
  expect(toQueryResult(runSplKon(query,{tables:{input:{...input,rows:[]}}}).value)).toEqual({columns:["ratio","a","n","d"],rows:[{ratio:null,a:null,n:0,d:0}]});
  expect(() => runSplKon('(spl_groups :{in=input agg={a="avg(missing)"}})',{tables:{input}})).toThrow("missing");
  expect(toQueryResult(runSplKon('(spl_select :{in=input where="0"})',{tables:{input}}).value).rows).toHaveLength(4);
  expect(toQueryResult(runSplKon('(spl_derive :{in=input cols={a="b+1" c="a+1"}})',{tables:{input}}).value).rows[0]).toEqual({a:2,b:1,v:0,c:3});
});

test("legacy and Kon file SQL preserve the same types, later columns, quoted fields and empty headers", async () => {
  const directory = mkdtempSync(join(tmpdir(), "spl-input-parity-"));
  try {
    writeFileSync(join(directory,"data.csv"), 'id,amount,label\n001,1200.50,"a,b"\n2,3.5,"line\nbreak"');
    writeFileSync(join(directory,"data.json"), JSON.stringify([{a:1},{a:2,'b"q':3}]));
    writeFileSync(join(directory,"empty.csv"), "id,v\n");
    for (const type of ["csv","json"] as const) {
      const filename = `data.${type}`, sql = `select * from ${type}_data`, path = join(directory,filename);
      const source = type === "csv" ? new CsvDataSource({type,name:"input",path}) : new JsonDataSource({type,name:"input",path});
      try {
        await expect(source.query("select missing from broken")).rejects.toThrow();
        const actual = await source.query(sql);
        const kon = toQueryResult(runSplKon(`(spl_query :{conn=input sql=${JSON.stringify(sql)}})`,{workspaceRoot:directory,dataSources:[{type,name:"input",path:filename}]}).value);
        expect(kon).toEqual({columns:actual.columns,rows:actual.rows.map(values=>Object.fromEntries(actual.columns.map((name,index)=>[name,values[index]])))});
        if (type === "csv") expect(actual.rows).toEqual([["001",1200.5,"a,b"],[2,3.5,"line\nbreak"]]);
        else expect(actual).toEqual({columns:["a",'b"q'],rows:[[1,null],[2,3]]});
      } finally { await source.close(); }
    }
    const empty = new CsvDataSource({type:"csv",name:"empty",path:join(directory,"empty.csv")});
    try { expect(await empty.query("select * from csv_data")).toEqual({columns:["id","v"],rows:[]}); }
    finally { await empty.close(); }
  } finally { rmSync(directory,{recursive:true,force:true}); }
});

test("synchronous Kon rejects cursor operations before consuming caller-owned position",async()=>{
  const cursor=Cursor.from([1,2,3]);
  expect(()=>runSplKon('(spl_eval :{expr="cursor.fetch(1)"})',{scope:{cursor}})).toThrow("async");
  expect(cursor.position).toBe(0);
  expect(await cursor.fetch(1)).toEqual([1]);
  await cursor.close();
  expect(()=>runSplKon('(spl_eval :{expr="input.cursor()"})',{tables:{input:{columns:["id"],rows:[{id:1}]}}})).toThrow("async");
});

test('Kon derives exact amounts from text and keeps exact sums through the query stages',()=>{
 const source='(spl_derive #d :{in=input cols={n="long(id)+1" price="decimal(amount)"}}) (spl_groups :{in=d agg={total="sum(price)"}})';
 const input={columns:['id','amount'],rows:[{id:'9007199254740993',amount:'0.1'},{id:'9007199254740994',amount:'0.2'}]};
 const result=runSplKon(source,{tables:{input}});
 expect(String(toQueryResult(result.value)!.rows[0].total)).toBe('0.3');
 expect((result.bindings.d as any).rows.map((r:any)=>String(r.n))).toEqual(['9007199254740994','9007199254740995']);
 expect(input.rows[0].amount).toBe('0.1');
});

test('Kon date options and grouped calendar expressions use the shared source rules',()=>{
 const value=runSplKon('(spl_eval @m :{expr="elapse(datetime(2024,2,29,12,0,0),1)"})').value as Date;
 expect([value.getMonth()+1,value.getDate()]).toEqual([3,31]);
 expect(runSplKon('(spl_eval :{expr="interval@ymd(datetime(2024,1,31),datetime(2025,3,2))"})').value).toBe(10102);
});

test('Kon alias row expressions bind env/with and nested cursor calls reject before reading while lazy branches remain inert',async()=>{
 const input={columns:['a'],rows:[{a:2},{a:3}]};
 const value=runSplKon('(var rate 2) (spl_eval :{expr="input.derive(a*rate:gross,gross+1:next).select(next>6)" with={rate=3}})',{tables:{input}}).value;
 expect(toQueryResult(value)!.rows).toEqual([{a:2,gross:6,next:7},{a:3,gross:9,next:10}]);
 const cursor=Cursor.from([1,2]);
 for(const expr of ['{value:cursor.fetch(1)}','[{value:cursor.fetch(1)}]','input.calc("cursor.fetch(1)")'])expect(()=>runSplKon(`(spl_eval :{expr=${JSON.stringify(expr)}})`,{scope:{cursor},tables:{input}})).toThrow('async');
 expect(cursor.position).toBe(0);
 expect(runSplKon('(spl_eval :{expr="if(false,{value:cursor.fetch(1)},7)"})',{scope:{cursor}}).value).toBe(7);
 expect(cursor.position).toBe(0);await cursor.close();
});

test('expression table results feed native grouping without losing decimal instances',()=>{
 const input={columns:['amount'],rows:[{amount:'0.1'},{amount:'0.2'}]};
 const source='(spl_eval #priced :{expr="input.derive(decimal(amount)*rate:total)" with={rate=3}}) (spl_groups :{in=priced agg={total="sum(total)" mean="avg(total)"}})';
 const rows=toQueryResult(runSplKon(source,{tables:{input}}).value)!.rows;
 expect(Object.values(rows[0]).map(String)).toEqual(['0.9','0.45']);
 expect(()=>runSplKon('(spl_groups :{in=bad agg={n="count()"}})',{scope:{bad:{schema:[{name:'a'},{name:'a'}],rows:[]}}})).toThrow('duplicate');
});

test('Kon formatting composes with exact row values and source conversion functions',()=>{
 const input={columns:['id','amount'],rows:[{id:'9007199254740993',amount:'1200.5'}]};
 const source='(spl_derive :{in=input cols={label="format(\'%d: %,.2f\',long(id),decimal(amount))" value="number(amount)" date="string(datetime(2024,2,29),\'yyyyMMdd\')"}})';
 expect(toQueryResult(runSplKon(source,{tables:{input}}).value)!.rows[0]).toMatchObject({label:'9007199254740993: 1,200.50',value:1200.5,date:'20240229'});
});

test('Kon shares exact underflow signs and rejects invalid formatting on string/null values',()=>{
 const input={columns:['amount'],rows:[{amount:'-1e-400'},{amount:'1e-400'}]};
 const source='(spl_derive :{in=input cols={scientific="format(\'%e\',decimal(amount))" fixed="string(decimal(amount),\'0.000;(0.000)\')"}})';
 const rows=toQueryResult(runSplKon(source,{tables:{input}}).value)!.rows;
 expect(rows.map(row=>[row.scientific,row.fixed])).toEqual([['-1.000000e-400','(0.000)'],['1.000000e-400','0.000']]);
 for(const expr of ["string('x',123)","format('%tq',null)"])
  expect(()=>runSplKon(`(spl_eval :{expr=${JSON.stringify(expr)}})`)).toThrow();
 expect(input.rows).toEqual([{amount:'-1e-400'},{amount:'1e-400'}]);
});

test('Kon delegates null character and floating formatting without changing input scope',()=>{
 const scope={value:null};
 const expression="format('%1$c/%<C/%<8.2e/%<E/%<-6.2G',value)";
 expect(runSplKon(`(spl_eval :{expr=${JSON.stringify(expression)}})`,{scope}).value).toBe('null/NULL/      nu/NULL/NU    ');
 for(const pattern of ['%.1c','%05C','%.2d','%#g','%tq'])
  expect(()=>runSplKon(`(spl_eval :{expr=${JSON.stringify(`format('${pattern}',value)`)}})`,{scope})).toThrow();
 expect(scope).toEqual({value:null});
});
