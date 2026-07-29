import { expect,test } from "bun:test";
import { compileExpression } from "depa-data-expression";
import { compileReport,renderReport } from "../src";
import type { ReportTemplate,TemplateCell } from "depa-data-report-contract";
const runtime={evaluate:(source:string,scope:Record<string,unknown>)=>compileExpression(source).evaluate(scope)};
function table(annotation:string):ReportTemplate{return{sheets:[{name:"Process",rowCount:3,colCount:2,merges:[],cells:[
  {row:0,col:0,value:"QTY"},{row:1,col:0,value:"*=qty",annotation:`expandType=r\nexpandExpr=data\n${annotation}`},
  {row:1,col:1,value:"*=qty"},{row:2,col:0,formula:"SUM(B2)",formulaMode:"report"},
]}]};}

test("physical row deletion recalculates formulas over retained instances while hidden rows stay physical",()=>{
  const data=[{qty:0},{qty:2},{qty:3}];
  const deleted=renderReport(runtime,{template:compileReport(table("rowTestExpr=qty>0")),datasets:{data}}).sheets[0];
  expect(deleted.rowCount).toBe(4);expect(deleted.cells.filter(c=>c.origin==="A2").map(c=>[c.row,c.value])).toEqual([[1,2],[2,3]]);
  expect(deleted.cells.find(c=>c.origin==="A3")).toMatchObject({row:3,value:5,formula:"SUM(B2:B3)"});
  const hidden=renderReport(runtime,{template:compileReport(table("visibleExpr=qty>0")),datasets:{data}}).sheets[0];
  expect(hidden.rowCount).toBe(5);expect(hidden.hiddenRows).toEqual({1:true});expect(hidden.cells.find(c=>c.origin==="A3")?.value).toBe(5);
  const source=table("visibleExpr=qty>0");source.config={removeHiddenCell:true};
  expect(renderReport(runtime,{template:compileReport(source),datasets:{data}}).sheets[0].rowCount).toBe(4);
  expect(data.map(row=>row.qty)).toEqual([0,2,3]);
});
test("multi-line config, local styles and separate raw/display/export values preserve types and input palette",()=>{
  const source=table('valueExpr="""\nif(qty>0,\nqty,0)\n"""\nstyleIdExpr=if(qty<0,"red","normal")\nformatExpr=concat("display:",value)\nexportFormattedValue=true');
  source.styles={normal:{styleId:0,numberFormat:"0.00",css:{color:"#000000"}},red:{styleId:1,numberFormat:"0.00",css:{color:"#FF0000"}}};
  const before=JSON.stringify(source),data=[{qty:-2},{qty:3}];
  const output=renderReport(runtime,{template:compileReport(source),datasets:{data}}).sheets[0];
  expect(output.cells.filter(c=>c.origin==="A2").map(c=>[c.value,c.displayValue,c.exportValue,c.styleId,c.css?.color])).toEqual([[0,"display:0","display:0",1,"#FF0000"],[3,"display:3","display:3",0,"#000000"]]);
  expect(JSON.stringify(source)).toBe(before);
  expect(()=>compileReport(table('valueExpr="""\n1+2'))).toThrow("unterminated valueExpr");
  expect(()=>renderReport(runtime,{template:compileReport(table('styleIdExpr="missing"')),datasets:{data}})).toThrow("Unknown report style missing");
});
test("field-only child expansion accepts array, scalar, null and static expand markers without merging duplicates",()=>{
  const source:ReportTemplate={sheets:[{name:"Children",rowCount:2,colCount:2,merges:[],cells:[
    {row:0,col:0,value:"*=name",annotation:"expandType=r\nexpandExpr=parents"},
    {row:0,col:1,annotation:"expandType=r\nfield=children\nvalueExpr=cell.ev"},
    {row:1,col:0,value:"END"},
  ]}]};
  const report=renderReport(runtime,{template:compileReport(source),params:{parents:[{name:"P",children:["a","a"]},{name:"Q",children:3},{name:"R",children:null}]}});
  expect(report.sheets[0].cells.filter(c=>c.origin==="B1").map(c=>c.value)).toEqual(["a","a",3,undefined]);
  const marker:ReportTemplate={sheets:[{name:"Static",rowCount:1,colCount:1,merges:[],cells:[{row:0,col:0,value:"X",annotation:"expandType=r\nkeepExpandEmpty=false"}]}]};
  expect(renderReport(runtime,{template:compileReport(marker)}).sheets[0].cells[0].value).toBe("X");
});
test("pure cell patches are applied before dependents and reject unknown mutation fields",()=>{
  const source:ReportTemplate={sheets:[{name:"Patch",rowCount:1,colCount:2,merges:[],cells:[
    {row:0,col:0,value:2,annotation:'processExpr={value:value*2,displayValue:"four"}'},
    {row:0,col:1,formula:"A1+1"},
  ]}]};
  const report=renderReport(runtime,{template:compileReport(source)});
  expect(report.sheets[0].cells.map(c=>c.value)).toEqual([4,5]);expect(report.sheets[0].cells[0].displayValue).toBe("four");
  (source.sheets[0].cells[0]as TemplateCell).annotation='processExpr={row:999}';
  expect(()=>renderReport(runtime,{template:compileReport(source)})).toThrow("Unsupported cell patch field row");
});
test("explicit dictionaries format labels with raw fallback; formula export is an independent policy",()=>{
  const source:ReportTemplate={sheets:[{name:"Policy",rowCount:2,colCount:3,merges:[],cells:[
    {row:0,col:0,value:"A",annotation:"dict=status"},
    {row:1,col:0,value:"unknown",annotation:"dict=status"},
    {row:0,col:1,value:2},
    {row:0,col:2,annotation:"valueExpr=SUM(B1)+1\nexportFormula=true"},
    {row:1,col:2,formula:"B1+2",annotation:"exportFormula=false"},
  ]}]};
  const sheet=renderReport(runtime,{template:compileReport(source),params:{dicts:{status:{A:"Active"}}}}).sheets[0];
  expect(sheet.cells.filter(c=>c.col===0).map(c=>[c.value,c.displayValue])).toEqual([["A","Active"],["unknown","unknown"]]);
  expect(sheet.cells.find(c=>c.origin==="C1")).toMatchObject({value:3,formula:"(SUM(B1)+1)"});
  expect(sheet.cells.find(c=>c.origin==="C2")).toMatchObject({value:4,formula:undefined});
  expect(()=>renderReport(runtime,{template:compileReport(source)})).toThrow("Unknown report dictionary status");
});
test("row and column style projections survive deletion with row precedence",()=>{
  const source=table("rowTestExpr=qty>0");
  source.sheets[0].rowStyles={1:{styleId:1,css:{color:"blue"}},2:{styleId:2,css:{color:"red"}}};
  source.sheets[0].colStyles={1:{styleId:0,css:{color:"green"}}};
  const report=renderReport(runtime,{template:compileReport(source),datasets:{data:[{qty:0},{qty:2},{qty:3}]}}).sheets[0];
  expect(Object.entries(report.rowStyles??{}).map(([row,style])=>[row,style.styleId])).toEqual([["1",1],["2",1],["3",2]]);
  expect(report.cells.filter(cell=>cell.origin==="B2").map(cell=>[cell.styleId,cell.css?.color])).toEqual([[1,"blue"],[1,"blue"]]);
  expect(report.cells.find(cell=>cell.origin==="A3")).toMatchObject({row:3,value:5,styleId:2});
});
