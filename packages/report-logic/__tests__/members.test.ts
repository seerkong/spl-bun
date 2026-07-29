import { expect,test } from "bun:test";
import { compileExpression } from "depa-data-expression";
import { compileReport,renderReport } from "../src";
import type { ReportTemplate } from "depa-data-report-contract";
const runtime={evaluate:(source:string,scope:Record<string,unknown>)=>compileExpression(source).evaluate(scope)};

test("relative layers follow retained sibling identity after physical deletion",()=>{
  const source:ReportTemplate={sheets:[{name:"Retained",rowCount:2,colCount:3,merges:[],cells:[
    {row:0,col:0,value:"*=qty",annotation:"expandType=r\nexpandExpr=rows\nrowTestExpr=qty>0"},
    {row:0,col:1,annotation:"valueExpr=SUM(A1[A1:+0])"},{row:0,col:2,annotation:"valueExpr=SUM(A1[A1:-1])"},
    {row:1,col:0,value:"TAIL"},
  ]}]};
  const result=renderReport(runtime,{template:compileReport(source),datasets:{rows:[{qty:0},{qty:2},{qty:3}]}}).sheets[0];
  expect(result.cells.filter(c=>c.origin==="B1").map(c=>c.value)).toEqual([2,3]);
  expect(result.cells.filter(c=>c.origin==="C1").map(c=>c.value)).toEqual([0,2]);
});
test("report aggregates iterate one level, rank ignores numeric strings, and empty proportion is null",()=>{
  const source:ReportTemplate={sheets:[{name:"Strict",rowCount:2,colCount:5,merges:[],cells:[
    {row:0,col:0,annotation:"expandType=r\nexpandExpr=items\nvalueExpr=cell.ev"},
    {row:0,col:1,annotation:"valueExpr=RANK(A1)"},
    {row:1,col:0,annotation:"valueExpr=SUM(nested)\nrowParent=A0"},
    {row:1,col:1,annotation:"valueExpr=COUNT(nested)\nrowParent=A0"},
    {row:1,col:2,annotation:"valueExpr=COUNTA(nested)\nrowParent=A0"},
    {row:1,col:3,annotation:"valueExpr=PROPORTION(A1[A1:99])\nrowParent=A0"},
  ]}]};
  const result=renderReport(runtime,{template:compileReport(source),params:{items:[10,"100",false,20,null],nested:[[1,2],3]}}).sheets[0];
  expect(result.cells.filter(c=>c.origin==="B1").map(c=>c.value)).toEqual([2,3,3,1,null]);
  expect(["A2","B2","C2","D2"].map(origin=>result.cells.find(c=>c.origin===origin)?.value)).toEqual([3,1,2,null]);
});

test("cell-set chains expose readonly cell views, transformations, ranges, roots and dynamic report APIs",()=>{
  const expressions=[
    'SUM(B1.map("e.value*2"))','B1.filter("e.value>8").sum()','B1.get(-1).value','B1.cells.length','B1.realCells().size',
    'B1.firstCell.rp.name','EVAL_EXCEL_FORMULA("SUM(B1)")','EXPAND_EXCEL_FORMULA("SUM(B1)")','CELLS("B1").filter("e.value>8").size',
    'SUM(B1.flatMap("if(e.value>8,[e.value,e.value],[])"))','B1.filter("e.value!=20").rowCount','B1.cellRanges.length','B1.get(99).value',
  ];
  const source:ReportTemplate={sheets:[{name:"Members",rowCount:2,colCount:13,merges:[],cells:[
    {row:0,col:0,value:"*=^data!region"},
    {row:0,col:1,value:"*=qty",annotation:"expandType=r\nexpandExpr=data"},
    {row:0,col:2,annotation:'valueExpr=A1.rowChildSet("B1").size\nrowParent=A1'},
    {row:0,col:3,annotation:'valueExpr=A1.rowChildSet("B1").sum\nrowParent=A1'},
    {row:0,col:4,annotation:'valueExpr=B1.firstCell.rr.ev\nrowParent=A1'},
    {row:0,col:5,annotation:'valueExpr=B1.lastCell.ei\nrowParent=A1'},
    ...expressions.map((valueExpr,col)=>({row:1,col,annotation:`valueExpr=${valueExpr}\nrowParent=A0\ncolParent=A0`})),
  ]}]};
  const result=renderReport(runtime,{template:compileReport(source),datasets:{data:[{region:"N",qty:10},{region:"N",qty:20},{region:"S",qty:7}]}}).sheets[0];
  expect(result.cells.filter(c=>c.origin==="C1").map(c=>c.value)).toEqual([2,1]);
  expect(result.cells.filter(c=>c.origin==="D1").map(c=>c.value)).toEqual([30,7]);
  expect(result.cells.filter(c=>c.origin==="E1").map(c=>c.value)).toEqual(["N","S"]);
  expect(result.cells.filter(c=>c.origin==="F1").map(c=>c.value)).toEqual([1,0]);
  expect(result.cells.filter(c=>/^[A-Z]+2$/.test(c.origin)).map(c=>c.value)).toEqual([74,30,7,3,3,"A1",37,"SUM(B1:B3)",2,60,3,1,null]);
});
test("column child sets follow the column parent domain and export member selection to actual addresses",()=>{
  const source:ReportTemplate={sheets:[{name:"Columns",rowCount:3,colCount:2,merges:[],cells:[
    {row:0,col:1,value:"*=>data!product"},
    {row:1,col:0,value:"*=^data!region"},{row:1,col:1,annotation:'valueExpr=if(records.count()==0,0,records.sum("qty"))'},
    {row:2,col:0,annotation:'valueExpr=B1.colChildSet("B2").sum\nrowParent=A0\ncolParent=A0'},
    {row:2,col:1,annotation:'valueExpr=B1.colChildSet("B2").sum()\nrowParent=A0\ncolParent=B1\nexportFormula=true'},
  ]}]};
  const result=renderReport(runtime,{template:compileReport(source),datasets:{data:[{region:"E",product:"A",qty:2},{region:"W",product:"B",qty:5}]}}).sheets[0];
  expect(result.cells.find(c=>c.origin==="A3")?.value).toBe(7);
  expect(result.cells.filter(c=>c.origin==="B3").map(c=>[c.value,c.formula])).toEqual([[2,"SUM(B2:B3)"],[5,"SUM(C2:C3)"]]);
});
test("member and dynamic APIs reject arbitrary host calls, readonly mutations and recursive strings",()=>{
  const table=(expression:string):ReportTemplate=>({sheets:[{name:"Boundary",rowCount:1,colCount:2,merges:[],cells:[{row:0,col:0,value:2},{row:0,col:1,annotation:`valueExpr=${expression}`}]}]});
  expect(()=>renderReport(runtime,{template:compileReport(table("A1.constructor"))})).toThrow("Forbidden formula member");
  expect(()=>renderReport(runtime,{template:compileReport(table("A1.get(0).value()"))})).toThrow("not callable");
  expect(()=>renderReport(runtime,{template:compileReport(table('A1.map(1)')),params:{}})).toThrow("evaluator expression string");
  const mutate={evaluate:(source:string,scope:Record<string,unknown>)=>{
    if(source==="mutate"){(scope.e as {row:number}).row=999;return 1;}return runtime.evaluate(source,scope);
  }};
  expect(()=>renderReport(mutate,{template:compileReport(table('SUM(A1.map("mutate"))'))})).toThrow();
  const recursive='EVAL_EXCEL_FORMULA(expr)';
  expect(()=>renderReport(runtime,{template:compileReport(table(recursive)),params:{expr:recursive}})).toThrow("64 levels");
});
test("member sum preserves MathHelper coercion separately from strict report SUM; proportion rejects booleans",()=>{
  const source=(expression:string):ReportTemplate=>({sheets:[{name:"Numbers",rowCount:2,colCount:2,merges:[],cells:[
    {row:0,col:0,annotation:"expandType=r\nexpandExpr=items\nvalueExpr=cell.ev"},
    {row:1,col:1,annotation:`valueExpr=${expression}\nrowParent=A0\ncolParent=A0`},
  ]}]});
  const value=(expression:string,items:unknown[])=>renderReport(runtime,{template:compileReport(source(expression)),params:{items}}).sheets[0].cells.find(c=>c.origin==="B2")?.value;
  expect(value("A1.sum",[2,true,3])).toBe(6);expect(value("SUM(A1)",[2,true,3])).toBe(5);
  expect(Number.isNaN(value("A1.sum",[2,"3",null])as number)).toBe(true);
  expect(Number.isNaN(value("PROPORTION(A1[A1:1])",[0])as number)).toBe(true);
  expect(()=>value("PROPORTION(A1[A1:1])",[true])).toThrow("numeric value");
  expect(value("PROPORTION(A1[A1:1])",["2",4])).toBe(0.5);
});
test("SPL methods remain available inside report arithmetic through the explicit evaluator",()=>{
  const source:ReportTemplate={sheets:[{name:"Mixed",rowCount:1,colCount:2,merges:[],cells:[{row:0,col:0,value:2},{row:0,col:1,annotation:'valueExpr=SUM(A1)+records.count()'}]}]};
  expect(renderReport(runtime,{template:compileReport(source),datasets:{data:[{x:1},{x:2}]}}).sheets[0].cells[1].value).toBe(4);
});
test("report exports materialize type/lazy semantics while representable numeric formulas retain references",()=>{
  const source:ReportTemplate={sheets:[{name:"ExportPolicy",rowCount:1,colCount:8,merges:[],cells:[
    {row:0,col:0,value:1},{row:0,col:1,value:"1"},
    {row:0,col:2,formula:"COUNTIF(A1:B1,1)",formulaMode:"report"},
    {row:0,col:3,formula:"IF(TRUE,7,BOMB())",formulaMode:"report"},
    {row:0,col:4,formula:"OR(TRUE,1/0)",formulaMode:"report"},
    {row:0,col:5,formula:"SUM(A1:B1)",formulaMode:"report"},
    {row:0,col:6,formula:"IF(A1>0,10,20)",formulaMode:"report"},
    {row:0,col:7,formula:"A1+B1",formulaMode:"report"},
  ]}]};
  let bomb=0;const counted={evaluate:(source:string,scope:Record<string,unknown>)=>{if(source.includes("BOMB"))bomb++;return runtime.evaluate(source,scope);}};
  const cells=renderReport(counted,{template:compileReport(source)}).sheets[0].cells;
  expect(cells.slice(2).map(cell=>cell.value)).toEqual([1,7,true,1,10,"11"]);
  expect([2,3,4,7].map(index=>cells[index].formula)).toEqual([undefined,undefined,undefined,undefined]);
  expect(cells[5].formula).toBe("SUM(A1,B1)");expect(cells[6].formula).toBe("IF((A1>0),10,20)");expect(bomb).toBe(0);
});
test("report container literals and self-referencing postprocessing preserve raw dependency order",()=>{
  const source:ReportTemplate={styles:{red:{styleId:1},normal:{styleId:0}},sheets:[{name:"Literals",rowCount:1,colCount:4,merges:[],cells:[
    {row:0,col:0,value:2,annotation:'processExpr={value:A1*2,displayValue:"four"}\nstyleIdExpr=IF(A1>0,"red","normal")'},
    {row:0,col:1,formula:"A1+1"},
    {row:0,col:2,annotation:'valueExpr=SUM([1,"2",true,null,3])'},
    {row:0,col:3,annotation:'valueExpr=SUM([[1,2],3])'},
  ]}]};
  const result=renderReport(runtime,{template:compileReport(source)}).sheets[0].cells;
  expect(result.map(cell=>cell.value)).toEqual([4,5,4,3]);expect(result[0]).toMatchObject({displayValue:"four",styleId:1});
  source.sheets[0].cells[0].annotation='processExpr={value:B1+1}';
  expect(()=>renderReport(runtime,{template:compileReport(source)})).toThrow("Cyclic formula dependency");
});
test("parameter expansion owns its current records even with an unrelated sole dataset",()=>{
  const source:ReportTemplate={sheets:[{name:"Scope",rowCount:1,colCount:2,merges:[],cells:[
    {row:0,col:0,value:"*=qty",annotation:"expandType=r\nexpandExpr=items"},
    {row:0,col:1,annotation:'valueExpr=records.sum("qty")'},
  ]}]};
  const result=renderReport(runtime,{template:compileReport(source),datasets:{unrelated:[{qty:999}]},params:{items:[{qty:2},{qty:3}]}}).sheets[0];
  expect(result.cells.map(cell=>cell.value)).toEqual([2,2,3,3]);
});
