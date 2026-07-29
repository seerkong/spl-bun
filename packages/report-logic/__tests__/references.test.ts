import { expect, test } from "bun:test";
import { compileExpression } from "depa-data-expression";
import { compileReport, renderReport, createReferenceProjection, copyFormula, mapFormulaReferences } from "../src";
import type { ReportTemplate } from "depa-data-report-contract";
const runtime={evaluate:(source:string,scope:Record<string,unknown>)=>compileExpression(source).evaluate(scope)};

test("reference tokens preserve strings, mixed absolutes, structured and external references",()=>{
  expect(copyFormula('SUM(A1,$B1,C$1,$D$1)+"A1"+\'O\'\'Brien\'!A1', {row:0,col:0},{row:2,col:1})).toBe('SUM(B3,$B3,D$1,$D$1)+"A1"+\'O\'\'Brien\'!B3');
  expect(mapFormulaReferences('LOG10(2)+Table1[A1]+[Other.xlsx]Data!A1+"A1"',()=>"CHANGED")).toBe('LOG10(2)+Table1[A1]+[Other.xlsx]Data!A1+"A1"');
  expect(copyFormula("$1:$2+$A:$B",{row:0,col:0},{row:2,col:1})).toBe("$1:$2+$A:$B");
});
test("in-place cell provenance projects ranges beyond unchanged global slot origins",()=>{
  const source:ReportTemplate={sheets:[{name:"Data",rowCount:2,colCount:4,merges:[],cells:[
    {row:1,col:1,annotation:"expandType=c\nexpandExpr=items\nexpandInplaceCount=3\nvalueExpr=cell.ev"},
  ]}]};
  const report=renderReport(runtime,{template:compileReport(source),params:{items:[1,2,3]}}),sheet=report.sheets[0];
  expect(sheet.colOrigins).toEqual([0,1,2,3]);
  expect(createReferenceProjection(report).ranges(sheet,{start:{row:1,col:1},end:{row:1,col:1}})).toEqual([{start:{row:1,col:1},end:{row:1,col:3}}]);
});
test("cross-sheet formulas use target geometry and matching loop instances",()=>{
  const source:ReportTemplate={config:{beginLoop:"books",loopVarName:"book"},sheets:[
    {name:"Detail",config:{sheetNameExpr:'book.name+" rows"'},rowCount:2,colCount:1,merges:[],cells:[{row:0,col:0,value:"Header"},{row:1,col:0,value:"*=qty",annotation:"expandType=r\nexpandExpr=book.rows"}]},
    {name:"Summary",config:{sheetNameExpr:'book.name+" sum"'},rowCount:1,colCount:1,merges:[],cells:[{row:0,col:0,formula:"SUM(Detail!A2:A2)"}]},
  ]};
  const report=renderReport(runtime,{template:compileReport(source),params:{books:[{name:"A",rows:[{qty:2},{qty:3}]},{name:"B",rows:[{qty:7}]}]}});
  expect(report.sheets.filter(s=>s.name.endsWith("sum")).map(s=>[s.cells[0].formula,s.cells[0].value])).toEqual([["SUM('A rows'!A2:A3)",5],["SUM('B rows'!A2:A2)",7]]);
});
test("single-cell arrays copy independently and multi-cell arrays reject overlapping output ranges",()=>{
  const source:ReportTemplate={sheets:[{name:"Arrays",rowCount:2,colCount:2,merges:[],cells:[
    {row:0,col:0,annotation:"expandType=r\nexpandExpr=items\nvalueExpr=cell.ev"},
    {row:0,col:1,formula:"A1*2",arrayFormulaRange:{start:{row:0,col:1},end:{row:0,col:1}}},
    {row:1,col:0,value:"TAIL"},
  ]}]};
  const result=renderReport(runtime,{template:compileReport(source),params:{items:[2,3]}});
  expect(result.sheets[0].cells.filter(c=>c.arrayFormulaRange).map(c=>[c.value,c.arrayFormulaRange])).toEqual([[4,{start:{row:0,col:1},end:{row:0,col:1}}],[6,{start:{row:1,col:1},end:{row:1,col:1}}]]);
  source.sheets[0].cells[1].arrayFormulaRange={start:{row:0,col:1},end:{row:1,col:1}};
  expect(()=>renderReport(runtime,{template:compileReport(source),params:{items:[2,3]}})).toThrow("overlapping expanded array formula");
});
