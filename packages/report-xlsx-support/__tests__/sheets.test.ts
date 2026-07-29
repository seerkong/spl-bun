import { expect,test } from "bun:test";
import * as XLSX from "xlsx";
import { compileExpression } from "depa-data-expression";
import { compileReport,renderReport } from "depa-data-report-logic";
import { readXlsxTemplate,writeXlsxReport,reportToHtml,xlsxParts } from "../src";

export function dynamicTemplate(): Uint8Array {
  const workbook=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([["封面"]]),"Cover");
  const sheet=XLSX.utils.aoa_to_sheet([["${entity.name}"],["产地","品牌","单价","属性"],["*=产地","*=品牌","*=单价",""]]);
  sheet.A3.c=[{a:"report",t:"expandType=r\nexpandExpr=entity.list"}];
  sheet.D2.c=[{a:"report",t:"expandType=c\nexpandExpr=entity.columns"}];
  sheet.D3.c=[{a:"report",t:"valueExpr=cell.rp.ev.属性.field(cell.cp.ev)"}];
  sheet["!cols"]=[{wch:18},{wch:15},{wch:12},{wch:14}];
  sheet["!rows"]=[{hpt:30},{hpt:22},{hpt:20}];
  sheet.C3.z="0.00";
  XLSX.utils.book_append_sheet(workbook,sheet,"sheet1");
  XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([["dump",1]]),"XptWorkbookModel");
  XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([["构建循环变量","data"],["循环变量名","entity"],["表单名称表达式","entity.name"]]),"sheet1-XptSheetModel");
  return new Uint8Array(XLSX.write(workbook,{type:"buffer",bookType:"xlsx"}));
}
export const fruits=[
  {name:"苹果",columns:["克重","大小","颜色"],list:[{产地:"山东",品牌:"A",单价:3.2,属性:{克重:"100",大小:"中",颜色:"红"}},{产地:"陕西",品牌:"B",单价:4.1,属性:{克重:"120",大小:"大",颜色:"青"}}]},
  {name:"香蕉",columns:["长度","成熟度","存储"],list:[{产地:"海南",品牌:"C",单价:2.1,属性:{长度:"150",成熟度:"中等",存储:"低温"}}]},
];
const runtime={evaluate:(source:string,scope:Record<string,unknown>)=>compileExpression(source).evaluate(scope)};

test("source-17 equivalent sheets preserve independent dynamic columns and XLSX relationships/styles",()=>{
  const bytes=dynamicTemplate(), snapshot=bytes.slice();
  const {template,archive}=readXlsxTemplate(bytes);
  expect(template.sheets.map(s=>s.name)).toEqual(["Cover","sheet1"]);
  const report=renderReport(runtime,{template:compileReport(template),params:{data:fruits}});
  expect(report.sheets.map(s=>s.name)).toEqual(["Cover","苹果","香蕉"]);
  const output=writeXlsxReport(archive,report),book=XLSX.read(output,{type:"buffer",cellNF:true,cellStyles:true});
  expect(book.SheetNames).toEqual(["Cover","苹果","香蕉"]);
  expect(XLSX.utils.sheet_to_json(book.Sheets.苹果,{header:1})).toEqual([["苹果"],["产地","品牌","单价","克重","大小","颜色"],["山东","A",3.2,"100","中","红"],["陕西","B",4.1,"120","大","青"]]);
  expect(XLSX.utils.sheet_to_json(book.Sheets.香蕉,{header:1})).toEqual([["香蕉"],["产地","品牌","单价","长度","成熟度","存储"],["海南","C",2.1,"150","中等","低温"]]);
  expect(book.Sheets.苹果.C4.z).toBe("0.00"); expect(book.Sheets.香蕉["!rows"]?.[2].hpt).toBe(20);
  const parts=xlsxParts(output);
  expect(parts.get("xl/styles.xml")).toEqual(archive.parts.get("xl/styles.xml"));
  expect(parts.get("xl/theme/theme1.xml")).toEqual(archive.parts.get("xl/theme/theme1.xml"));
  expect(parts.has("xl/worksheets/sheet3.xml")).toBe(false); expect(parts.has("xl/worksheets/sheet4.xml")).toBe(false);
  expect(new TextDecoder().decode(parts.get("xl/_rels/workbook.xml.rels"))).toContain("reportSheet1.xml");
  const html=reportToHtml(report); expect(html).toContain("<h2>苹果</h2>"); expect(html).toContain("<h2>香蕉</h2>"); expect(html).toContain("低温");
  expect(bytes).toEqual(snapshot); expect(writeXlsxReport(archive,report)).toEqual(output);
});
test("empty loop retains cover, duplicate names deconflict, executable config is located and rejected",()=>{
  const bytes=dynamicTemplate(),{template,archive}=readXlsxTemplate(bytes);
  const empty=renderReport(runtime,{template:compileReport(template),params:{data:[]}});
  expect(XLSX.read(writeXlsxReport(archive,empty),{type:"buffer"}).SheetNames).toEqual(["Cover"]);
  const duplicate=renderReport(runtime,{template:compileReport(template),params:{data:[fruits[0],fruits[0],fruits[0]]}});
  expect(XLSX.read(writeXlsxReport(archive,duplicate),{type:"buffer"}).SheetNames).toEqual(["Cover","苹果","苹果(1)","苹果(2)"]);
  const book=XLSX.read(bytes,{type:"buffer"}); book.Sheets.XptWorkbookModel.A1={t:"s",v:"展开前"}; book.Sheets.XptWorkbookModel.B1={t:"s",v:'assign("data",data)'};
  expect(()=>readXlsxTemplate(new Uint8Array(XLSX.write(book,{type:"buffer",bookType:"xlsx"})))).toThrow("XptWorkbookModel!B1: 展开前 initialization script");
});
