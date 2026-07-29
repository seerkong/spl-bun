import { expect, test } from "bun:test";
import { compileExpression } from "depa-data-expression";
import { compileReport, renderReport } from "../src";
import type { ReportTemplate, ReportExpressionRuntime } from "depa-data-report-contract";
const runtime: ReportExpressionRuntime = { evaluate:(source,scope) => compileExpression(source).evaluate(scope) };
function source(): ReportTemplate {
  return { sheets:[{ name:"Cover", rowCount:1,colCount:1,merges:[],cells:[{row:0,col:0,value:"Cover"}] },{
    name:"Template",config:{beginLoop:"data",loopVarName:"entity",loopIndexName:"idx",sheetVarName:"entity",sheetNameExpr:"entity.name"},
    rowCount:2,colCount:3,merges:[],cells:[{row:0,col:0,value:"*=name"},{row:0,col:1,value:"*=idx"},{row:0,col:2,formula:"SUM(B2:B2)"},
      {row:1,col:0,value:"*=name",annotation:"expandType=r\nexpandExpr=entity.rows"},{row:1,col:1,value:"*=qty"},
      {row:1,col:2,value:"*=entity.name"}],
  }] };
}
test("dynamic sheets isolate loop scope, row fields, formula caches and source identity", () => {
  const template=source(), data=[{name:"苹果",rows:[{name:"red",qty:2},{name:"green",qty:3}]},{name:"香蕉",rows:[{name:"yellow",qty:7}]}];
  const before=JSON.stringify({template,data});
  const result=renderReport(runtime,{template:compileReport(template),params:{data,name:"global"}});
  expect(result.sheets.map(s=>s.name)).toEqual(["Cover","苹果","香蕉"]);
  expect(result.sheets.slice(1).map(s=>s.sourceSheetId)).toEqual(["Template","Template"]);
  expect(new Set(result.sheets.map(s=>s.instanceId)).size).toBe(3);
  expect(result.sheets[1].cells.find(c=>c.origin==="A1")?.value).toBe("苹果");
  expect(result.sheets[1].cells.filter(c=>c.origin==="A2").map(c=>c.value)).toEqual(["red","green"]);
  expect(result.sheets[2].cells.filter(c=>c.origin==="A2").map(c=>c.value)).toEqual(["yellow"]);
  expect(result.sheets.slice(1).map(s=>s.cells.find(c=>c.origin==="C1")?.value)).toEqual([5,7]);
  expect(JSON.stringify({template,data})).toBe(before);
  expect(renderReport(runtime,{template:compileReport(template),params:{data:[]}}).sheets.map(s=>s.name)).toEqual(["Cover"]);
});
test("workbook and sheet nested loops, test before loop, names and limits are deterministic", () => {
  const template=source();
  template.config={beginLoop:"groups",loopVarName:"group"};
  template.sheets[1].config!.beginLoop="group";
  template.sheets[1].config!.sheetNameExpr="entity.name";
  const item={name:"O'Brien / long sheet name 1234567890",rows:[{name:"x",qty:1}]};
  const report=renderReport(runtime,{template:compileReport(template),params:{groups:[[item,item],[item]]}});
  expect(report.sheets).toHaveLength(5);
  expect(report.sheets.every(s=>s.name.length<=31 && !s.name.includes("/"))).toBe(true);
  expect(new Set(report.sheets.map(s=>s.name.toLowerCase())).size).toBe(5);
  expect(report.sheets.filter(s=>s.sourceSheetId==="Template").map(s=>s.instancePath)).toEqual([[0,0],[0,1],[1,0]]);
  template.sheets[1].config!.testExpr="false";
  template.sheets[1].config!.beginLoop="missing()";
  expect(renderReport(runtime,{template:compileReport(template),params:{groups:[[]]}}).sheets.map(s=>s.name)).toEqual(["Cover"]);
  expect(()=>renderReport(runtime,{template:compileReport(source()),params:{data:[item,item]}},{maxSheets:2})).toThrow("sheet limit");
});
test("renamed native sheet qualifiers use matching instance and preserve literal text", () => {
  const template:ReportTemplate={sheets:[{name:"T",config:{beginLoop:"data",loopVarName:"entity",sheetNameExpr:"entity.name"},rowCount:1,colCount:3,merges:[],cells:[
    {row:0,col:0,value:"*=entity.n"},{row:0,col:1,formula:"T!$A$1*2"},{row:0,col:2,formula:'IF(TRUE,"T!A1",T!A1)'},
  ]}]};
  const result=renderReport(runtime,{template:compileReport(template),params:{data:[{name:"O'Brien",n:2},{name:"O'Brien",n:7}]}});
  expect(result.sheets.map(s=>s.name)).toEqual(["O'Brien","O'Brien(1)"]);
  expect(result.sheets.map(s=>s.cells[1].value)).toEqual([4,14]);
  expect(result.sheets[0].cells[1].formula).toBe("'O''Brien'!$A$1*2");
  expect(result.sheets[1].cells[1].formula).toBe("'O''Brien(1)'!$A$1*2");
  expect(result.sheets[1].cells[2].formula).toContain('"T!A1"');
});
