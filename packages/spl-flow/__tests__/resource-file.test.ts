import { expect,test } from "bun:test";
import { mkdtempSync,writeFileSync,readFileSync,readdirSync,mkdirSync,rmSync,symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { evaluateFlow,evaluateFlowSync,buildFlowScope,closeFlowScope,type FlowExecutionContext } from "../src";
import { workspaceFile } from "../src/file-effect";
import { FlowResources } from "../src/resources";

test("real file import/export/write are typed, atomic and bound to workspace including symlinks",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"spl-file-effects-")),outside=mkdtempSync(join(tmpdir(),"spl-file-outside-"));
  try {
    const rows=[{id:"001",value:2,text:'a,"b"\nline'},{id:"002",value:3,text:"尾行"}];
    for(const extension of ["csv","json"]){
      const output=await evaluateFlow([{row:1,col:"A",expr:`file("out.${extension}").export(rows)`},{row:2,col:"A",expr:`file("out.${extension}").import()`}],{workspaceRoot:directory,scope:{rows}});
      expect(output.cells.map(cell=>cell.status)).toEqual(["ok","ok"]);
      expect((output.scope.A2 as {rows:unknown[]}).rows).toEqual(rows);
    }
    const file=workspaceFile(join(directory,"out.json"),directory);
    const original=readFileSync(join(directory,"out.json"),"utf8");
    const circular: Record<string,unknown>={};circular.self=circular;
    expect(()=>file.export([{value:circular}])).toThrow();
    expect(readFileSync(join(directory,"out.json"),"utf8")).toBe(original);
    mkdirSync(join(directory,"target"));
    expect(()=>workspaceFile(join(directory,"target"),directory).write("failure")).toThrow();
    expect(readdirSync(directory).some(name=>name.endsWith(".tmp"))).toBe(false);
    writeFileSync(join(outside,"secret"),"unchanged");symlinkSync(outside,join(directory,"link"));
    expect(()=>workspaceFile(join(directory,"link","secret"),directory).write("bad")).toThrow("workspace");
    expect(readFileSync(join(outside,"secret"),"utf8")).toBe("unchanged");
    const escaped=await evaluateFlow([{row:1,col:"A",expr:'file("../escape.csv").write("x")'}],{workspaceRoot:directory});
    expect(escaped.cells[0].error).toContain("workspace");
  } finally {rmSync(directory,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true});}
});

test("flow-owned connections and real SQL cursors close on result/error; injected handles retain ownership",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"spl-run-resources-")),path=join(directory,"input.db");
  const database=new Database(path);database.run("create table t(id);insert into t values(1),(2),(3)");database.close();
  let active=0,opened=0,closed=0;
  const config:FlowExecutionContext={workspaceRoot:directory,dataSourceConfigs:[{type:"sqlite",name:"db",path}],observeResource:event=>{if(event.phase==="open"){active++;opened++;}else{active--;closed++;}}};
  try {
    const output=await evaluateFlow([{row:1,col:"A",expr:'db.cursor("select id from t")'},{row:2,col:"A",expr:"A1.fetch(2)"},{row:3,col:"A",expr:"result A2"}],config);
    expect(output.cells.every(cell=>cell.status==="ok")).toBe(true);
    expect(output.result).toEqual([{id:1},{id:2}]);
    expect(active).toBe(0);expect(opened).toBe(closed);
    const failed=await evaluateFlow([{row:1,col:"A",expr:'db.query("select missing from t")'}],config);
    expect(failed.cells[0].status).toBe("error");expect(active).toBe(0);
    await expect(evaluateFlow([{row:1,col:"A",expr:'end "stop"'}],config)).rejects.toThrow("stop");
    expect(active).toBe(0);
    const scope=buildFlowScope(config);
    expect(active).toBe(1);
    await evaluateFlow([{row:1,col:"A",expr:'db.query("select id from t")'}],{workspaceRoot:directory,scope});
    expect(active).toBe(1);
    await closeFlowScope(scope);await closeFlowScope(scope);expect(active).toBe(0);
    const sync=evaluateFlowSync([{row:1,col:"A",expr:'db.cursor("select * from t")'}],config);
    expect(sync.cells[0].error).toContain("async");expect(active).toBe(0);
  } finally {rmSync(directory,{recursive:true,force:true});}
});

test("async flow owns CSV cursors and unused lazy branches open no file resources",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"spl-flow-csv-stream-"));
  writeFileSync(join(directory,"input.csv"),"id,v\n1,2\n2,3\n3,4");
  let opened=0,closed=0;
  try {
    const output=await evaluateFlow([{row:1,col:"A",expr:'if(false,file("absent.csv").cursor(),file("input.csv").cursor())'},{row:2,col:"A",expr:"A1.fetch(1)"},{row:3,col:"A",expr:"A1.fetch(1)"}],{workspaceRoot:directory,observeResource:event=>event.phase==="open"?opened++:closed++});
    expect(output.cells.every(cell=>cell.status==="ok")).toBe(true);
    expect(output.scope.A2).toEqual([{id:1,v:2}]);expect(output.scope.A3).toEqual([{id:2,v:3}]);
    expect(opened).toBe(1);expect(closed).toBe(1);
  } finally {rmSync(directory,{recursive:true,force:true});}
});

test("flow cancellation interrupts real SQL consumption and cleanup continues after another release fails",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"spl-flow-cancel-")),path=join(directory,"input.db");
  const db=new Database(path);db.run("create table t(id)");db.close();
  const abort=new AbortController();let active=0;
  const timer=setTimeout(()=>abort.abort(new Error("cancel flow")),10);
  try {
    const output=await evaluateFlow([{row:1,col:"A",expr:'db.cursor("with recursive n(x) as (select 1 union all select x+1 from n where x<1000000) select x from n")'},{row:2,col:"A",expr:"A1.skip(1000000)"},{row:3,col:"A",expr:'file("late.txt").write("forbidden")'}],{workspaceRoot:directory,signal:abort.signal,dataSourceConfigs:[{type:"sqlite",name:"db",path}],observeResource:event=>active+=event.phase==="open"?1:-1});
    expect(output.cells[1].status).toBe("error");expect(output.cells[2].status).toBe("error");
    expect(active).toBe(0);expect(readdirSync(directory)).not.toContain("late.txt");
    const resources=new FlowResources();let closed=0;
    resources.own({close:()=>{closed++;}},"good");
    resources.own({close:()=>{throw new Error("bad release");}},"bad");
    expect(()=>resources.close()).toThrow("cleanup failed");expect(closed).toBe(1);
  } finally {clearTimeout(timer);rmSync(directory,{recursive:true,force:true});}
});

test('exact values export through CSV/JSON and lossless JSON import preserves numeric tokens',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'spl-exact-export-'));
 try{
  const output=await evaluateFlow([{row:1,col:'A',expr:"file('exact.csv').export([{id:long('9007199254740993'),v:decimal('0.30')}])"},{row:2,col:'A',expr:"file('exact.json').export([{id:long('9007199254740993'),v:decimal('0.30')}])"}],{workspaceRoot:directory});
  expect(output.cells.map(cell=>cell.status)).toEqual(['ok','ok']);
  expect(readFileSync(join(directory,'exact.csv'),'utf8')).toBe('id,v\r\n9007199254740993,0.3\r\n');
  expect(workspaceFile(join(directory,'exact.json'),directory).import()).toMatchObject({rows:[{id:'9007199254740993',v:'0.3'}]});
 }finally{rmSync(directory,{recursive:true,force:true});}
});
