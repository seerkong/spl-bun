import { describe, expect, test } from "bun:test";
import * as XLSX from "xlsx";
import { compileReport, renderReport } from "depa-data-report-logic";
import { readXlsxTemplate, writeXlsxReport, reportToHtml, xlsxParts, formatReportValue } from "../src";
import type { ReportExpressionRuntime } from "depa-data-report-contract";
import { compileExpression } from "depa-data-expression";

const runtime: ReportExpressionRuntime = { evaluate: (expression, scope) => scope[expression] };
const decoder = new TextDecoder();

/** Synthetic fixture, informed by nop-report's public annotation semantics.
 * No upstream code, proprietary workbook or Java initialization script is copied.
 */
export function sampleTemplate(): Uint8Array {
  const sheet = XLSX.utils.aoa_to_sheet([["${title}", "", "", ""], ["*=name", "*=qty", "*=label", ""], ["END"]]);
  sheet.A2.c = [{ a: "report", t: "expandType=r\nexpandExpr=orders" }];
  sheet["!merges"] = [XLSX.utils.decode_range("A1:D1"), XLSX.utils.decode_range("C2:D2")];
  sheet["!rows"] = [{ hpt: 25 }, { hpt: 30 }];
  sheet["!cols"] = [{ wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
  sheet.B2.z = "0.00";
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "订单");
  const cfb = XLSX.CFB.read(XLSX.write(book, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
  const styles = `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="14"/><name val="Arial"/><color rgb="FF183A55"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFECEFF4"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FF8899AA"/></left><bottom style="thin"><color rgb="FF8899AA"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="2" fontId="1" fillId="2" borderId="1" applyAlignment="1"><alignment horizontal="right" wrapText="1"/></xf></cellXfs></styleSheet>`;
  XLSX.CFB.utils.cfb_add(cfb, "/xl/styles.xml", Buffer.from(styles));
  const xmlEntry = XLSX.CFB.find(cfb, "/xl/worksheets/sheet1.xml");
  const xml = Buffer.from(xmlEntry.content as Uint8Array).toString().replace(/(<c r="[ABCD]2")(?: s="\d+")?/g, '$1 s="1"');
  XLSX.CFB.utils.cfb_add(cfb, "/xl/worksheets/sheet1.xml", Buffer.from(xml));
  return new Uint8Array(XLSX.CFB.write(cfb, { type: "buffer", fileType: "zip", compression: true }) as Uint8Array);
}

describe("XLSX template projection", () => {
  test("real bytes preserve styles/theme, merges, row dimensions and typed values; safe HTML", () => {
    const bytes = sampleTemplate();
    const snapshot = bytes.slice();
    const { template, archive } = readXlsxTemplate(bytes);
    const rendered = renderReport(runtime, { template: compileReport(template), datasets: { orders: [{ name: "Alice", qty: 2, label: "<b>A</b>" }, { name: "Bob", qty: 3, label: "B" }] }, params: { title: "订单" } });
    const output = writeXlsxReport(archive, rendered);
    const book = XLSX.read(output, { type: "buffer", cellNF: true, cellStyles: true });
    const sheet = book.Sheets["订单"];
    expect(sheet.A1.v).toBe("订单"); expect(sheet.A2.v).toBe("Alice"); expect(sheet.A3.v).toBe("Bob");
    expect(sheet.B3.v).toBe(3); expect(sheet.B3.t).toBe("n"); expect(sheet.B3.z).toBe("0.00");
    expect(sheet.A4.v).toBe("END");
    expect(sheet["!merges"]?.map(XLSX.utils.encode_range)).toEqual(["A1:D1", "C2:D2", "C3:D3"]);
    expect(sheet["!rows"]?.[2].hpt).toBe(30);
    expect(sheet.A2.c).toBeUndefined();
    const outParts = xlsxParts(output);
    expect(outParts.get("xl/styles.xml")).toEqual(archive.parts.get("xl/styles.xml"));
    expect(outParts.get("xl/theme/theme1.xml")).toEqual(archive.parts.get("xl/theme/theme1.xml"));
    const xml = decoder.decode(outParts.get("xl/worksheets/sheet1.xml"));
    expect(xml).toMatch(/<c[^>]*r="B3"[^>]*s="1"/);
    const html = reportToHtml(rendered);
    expect(html).toContain("&lt;b&gt;A&lt;/b&gt;"); expect(html).not.toContain("<b>A</b>");
    expect(html).toContain('colspan="2"'); expect(html).toContain("background-color:#ECEFF4");
    expect(html).toContain("3.00"); expect(bytes).toEqual(snapshot);
    expect(writeXlsxReport(archive, rendered)).toEqual(output);
  });
  test("relocates autoFilter and rejects invalid ZIP input", () => {
    const bytes = sampleTemplate(); const cfb = XLSX.CFB.read(Buffer.from(bytes), { type: "buffer" });
    const original = Buffer.from(XLSX.CFB.find(cfb, "/xl/worksheets/sheet1.xml").content as Uint8Array).toString();
    XLSX.CFB.utils.cfb_add(cfb, "/xl/worksheets/sheet1.xml", Buffer.from(original.replace("</worksheet>", '<autoFilter ref="A1:D3"/></worksheet>')));
    const tagged = new Uint8Array(XLSX.CFB.write(cfb, { type: "buffer", fileType: "zip" }) as Uint8Array);
    const { template, archive } = readXlsxTemplate(tagged);
    const report = renderReport(runtime, { template: compileReport(template), datasets: { orders: [{ name: "A" }, { name: "B" }] }, params: { title: "t" } });
    const output=XLSX.read(writeXlsxReport(archive,report),{type:"buffer"});
    expect(output.Sheets["订单"]["!autofilter"]?.ref).toBe("A1:D4");
    expect(() => readXlsxTemplate(new Uint8Array([1, 2, 3]))).toThrow("XLSX ZIP");
  });
  test("two-axis layout exports values, dynamic headers, column widths and stretched labels", () => {
    const sheet = XLSX.utils.aoa_to_sheet([["Region", "*=>sales!product"], ["*=^sales!region", ""]]);
    sheet.B2.c = [{ a: "report", t: "valueExpr=sumQty" }];
    sheet["!cols"] = [{ wch: 18 }, { wch: 12 }];
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Matrix");
    const { template, archive } = readXlsxTemplate(new Uint8Array(XLSX.write(book, { type: "buffer", bookType: "xlsx" })));
    const data = [{ region: "E", product: "A", qty: 2 }, { region: "E", product: "B", qty: 3 }, { region: "E", product: "A", qty: 4 }, { region: "W", product: "B", qty: 5 }];
    const report = renderReport({ evaluate(source, scope) { return source === "sumQty" ? scope.records.reduce((sum, r) => sum + Number(r.qty), 0) : scope[source]; } }, { template: compileReport(template), datasets: { sales: data } });
    const output = XLSX.read(writeXlsxReport(archive, report), { type: "buffer", cellStyles: true }).Sheets.Matrix;
    expect(XLSX.utils.sheet_to_json(output, { header: 1 })).toEqual([["Region", "A", "B"], ["E", 6, 3], ["W", 0, 5]]);
    expect(output["!cols"]?.[2].width).toBe(output["!cols"]?.[1].width);
    expect(reportToHtml(report)).toContain(">6</td>");
  });
});

test("formula values survive XLSX reopening and match formatted HTML, including unknown/error/string caches", () => {
  const sheet = XLSX.utils.aoa_to_sheet([["id", "qty", "price", "total"], ["*=id", "*=qty", "*=price", ""], ["Sum"], ["Unknown"]]);
  sheet.A2.c = [{ a: "report", t: "expandType=r\nexpandExpr=orders" }];
  sheet.D2 = { t: "n", f: "B2*C2", z: "0.00" };
  sheet.D3 = { t: "n", f: "SUM(D2:D2)" };
  sheet.B4 = { t: "n", f: "UNKNOWN(1)" };
  sheet.A4 = { t: "n", f: "AVERAGE(Z99:Z99)" };
  sheet.C4 = { t: "n", f: "B4+1" };
  sheet.D4 = { t: "str", f: 'IF(TRUE,"OK","no")' };
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "Orders");
  const bytes = new Uint8Array(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  const { template, archive } = readXlsxTemplate(bytes);
  const report = renderReport(runtime, { template: compileReport(template), datasets: { orders: [{ id: "001", qty: 2, price: 10 }, { id: "002", qty: 3, price: 4 }] } });
  const output = XLSX.read(writeXlsxReport(archive, report), { type: "buffer", cellNF: true }).Sheets.Orders;
  expect([output.D2.f, output.D2.v, output.D3.f, output.D3.v, output.D4.f, output.D4.v]).toEqual(["B2*C2", 20, "B3*C3", 12, "SUM(D2:D3)", 32]);
  expect(output.D5.v).toBe("OK"); expect(output.D5.f).toContain("IF");
  expect(output.A5.t).toBe("e"); expect(output.A5.v).toBe(36);
  const unknown = report.sheets[0].cells.filter(c => c.origin === "B4" || c.origin === "C4");
  expect(unknown.map(c => c.formulaStatus)).toEqual(["uncomputed", "uncomputed"]);
  const html = reportToHtml(report);
  expect(html).toContain(">20.00</td>"); expect(html).toContain(">32</td>"); expect(html).toContain(">OK</td>");
  expect(html).toContain("Uncomputed dependency");
  expect(html).toContain("#NUM!");
});

test("named style samples, display/export roles, visibility and numeric styles survive real XLSX",()=>{
  const book=XLSX.utils.book_new();
  const sheet=XLSX.utils.aoa_to_sheet([["QTY",3],["*=qty"],["Total"]]);
  sheet.A2.c=[{a:"report",t:'expandType=r\nexpandExpr=orders\nstyleIdExpr=if(qty<0,"red","normal")\nformatExpr="￥"+cell.formattedValue\nexportFormattedValue=true\nvisibleExpr=qty>0'}];
  sheet.B1.c=[{a:"report",t:'styleIdExpr="red"'}];
  sheet.B3={t:"n",f:"SUM(A2)"};
  XLSX.utils.book_append_sheet(book,sheet,"Styled");
  const config=XLSX.utils.aoa_to_sheet([["命名样式"],["序号","样式ID","样式"],[1,"red",333],[2,"normal",444]]);
  XLSX.utils.book_append_sheet(book,config,"XptWorkbookModel");
  const cfb=XLSX.CFB.read(XLSX.write(book,{type:"buffer",bookType:"xlsx"}),{type:"buffer"});
  const styleXml=new TextDecoder().decode(xlsxParts(sampleTemplate()).get("xl/styles.xml")).replace("FF183A55","FFCC0000").replace('<cellXfs count="2"><xf numFmtId="0"','<cellXfs count="2"><xf numFmtId="2"');
  XLSX.CFB.utils.cfb_add(cfb,"/xl/styles.xml",Buffer.from(styleXml));
  const configXml=Buffer.from(XLSX.CFB.find(cfb,"/xl/worksheets/sheet2.xml").content as Uint8Array).toString().replace('<c r="C3"','<c r="C3" s="1"');
  XLSX.CFB.utils.cfb_add(cfb,"/xl/worksheets/sheet2.xml",Buffer.from(configXml));
  const bytes=new Uint8Array(XLSX.CFB.write(cfb,{type:"buffer",fileType:"zip"})as Uint8Array);
  const {template,archive}=readXlsxTemplate(bytes);
  expect(template.sheets[0].cells.find(c=>c.row===1&&c.col===0)?.annotation).toContain("styleIdExpr");
  const report=renderReport({evaluate:(expression,scope)=>compileExpression(expression).evaluate(scope),formatValue:formatReportValue},{template:compileReport(template),datasets:{orders:[{qty:-2},{qty:3}]}});
  const records=report.sheets[0].cells.filter(c=>c.origin==="A2");
  expect(records.map(c=>[c.value,c.displayValue,c.exportValue,c.styleId])).toEqual([[-2,"￥-2.00","￥-2.00",1],[3,"￥3.00","￥3.00",0]]);
  const bytesOut=writeXlsxReport(archive,report),output=XLSX.read(bytesOut,{type:"buffer",cellStyles:true}).Sheets.Styled;
  expect(output.A2.v).toBe("￥-2.00");expect(output.A2.t).toBe("s");expect(output.A3.v).toBe("￥3.00");
  expect(output.B4.v).toBe(1);expect(output.B4.f).toBeUndefined();
  expect(output["!rows"]?.[1].hidden).toBe(true);
  const xml=new TextDecoder().decode(xlsxParts(bytesOut).get("xl/worksheets/sheet1.xml"));
  expect(xml).toMatch(/<c[^>]*r="B1"[^>]*s="1"/);
  const html=reportToHtml(report);expect(html).toContain("<tr hidden");expect(html).toContain("￥-2.00");expect(html).toContain("color:#CC0000");
});

test("in-place reservations and physical deletion survive XLSX serialization without changing neighbors",()=>{
  const source=XLSX.utils.aoa_to_sheet([["Header","Neighbor"],["*=qty"],[],[],["TAIL"]]);
  source.A2.c=[{a:"report",t:"expandType=r\nexpandExpr=orders\nexpandInplaceCount=3\nrowTestExpr=qty>0"}];
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,source,"Reserved");
  const bytes=new Uint8Array(XLSX.write(book,{type:"buffer",bookType:"xlsx"}));
  const {template,archive}=readXlsxTemplate(bytes);
  for(const [data,tail]of [[[1,2],"A5"],[[1,2,3,4],"A6"],[[0,2,3,4],"A5"]]as const){
    const report=renderReport({evaluate:(expr,scope)=>compileExpression(expr).evaluate(scope)}, {template:compileReport(template),datasets:{orders:data.map(qty=>({qty}))}});
    const output=XLSX.read(writeXlsxReport(archive,report),{type:"buffer"}).Sheets.Reserved;
    expect(output[tail].v).toBe("TAIL");expect(output.B1.v).toBe("Neighbor");
    expect(report.sheets[0].cells.filter(c=>c.origin==="A2").map(c=>c.value)).toEqual(data.filter(qty=>qty>0));
  }
});

test("blank style cells copy continuous borders without inventing values",()=>{
  const original=sampleTemplate(),cfb=XLSX.CFB.read(Buffer.from(original),{type:"buffer"});
  const node=XLSX.CFB.find(cfb,"/xl/worksheets/sheet1.xml"),source=Buffer.from(node.content as Uint8Array).toString();
  XLSX.CFB.utils.cfb_add(cfb,"/xl/worksheets/sheet1.xml",Buffer.from(source.replace(/(<row r="2"[^>]*>)([\s\S]*?)(<\/row>)/,'$1$2<c r="E2" s="1"/>$3')));
  const bytes=new Uint8Array(XLSX.CFB.write(cfb,{type:"buffer",fileType:"zip"})as Uint8Array),{template,archive}=readXlsxTemplate(bytes);
  const report=renderReport(runtime,{template:compileReport(template),datasets:{orders:[{name:"A"},{name:"B"}]},params:{title:"T"}});
  const xml=decoder.decode(xlsxParts(writeXlsxReport(archive,report)).get("xl/worksheets/sheet1.xml"));
  expect(xml).toMatch(/<c[^>]*r="E2"[^>]*s="1"\s*\/>/);expect(xml).toMatch(/<c[^>]*r="E3"[^>]*s="1"\s*\/>/);
});

test("row and column default styles reach actual cells and empty HTML cells without changing values",()=>{
  const book=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet([[2,3],[4,5,6]]);sheet["!cols"]=[{wch:12},{wch:12},{wch:12}];XLSX.utils.book_append_sheet(book,sheet,"Inherited");
  const cfb=XLSX.CFB.read(XLSX.write(book,{type:"buffer",bookType:"xlsx"}),{type:"buffer"});
  XLSX.CFB.utils.cfb_add(cfb,"/xl/styles.xml",Buffer.from(xlsxParts(sampleTemplate()).get("xl/styles.xml")!));
  const original=Buffer.from(XLSX.CFB.find(cfb,"/xl/worksheets/sheet1.xml").content as Uint8Array).toString();
  XLSX.CFB.utils.cfb_add(cfb,"/xl/worksheets/sheet1.xml",Buffer.from(original.replace('<row r="1"','<row r="1" s="1" customFormat="1"').replace(/<cols>[\s\S]*?<\/cols>/,'<cols><col min="1" max="1" width="12"/><col min="2" max="2" width="12" style="1"/><col min="3" max="3" width="12"/></cols>')));
  const bytes=new Uint8Array(XLSX.CFB.write(cfb,{type:"buffer",fileType:"zip"})as Uint8Array),before=bytes.slice(),{template,archive}=readXlsxTemplate(bytes);
  expect(template.sheets[0].cells.map(cell=>cell.styleId)).toEqual([1,1,0,1,0]);
  const report=renderReport(runtime,{template:compileReport(template)}),output=XLSX.read(writeXlsxReport(archive,report),{type:"buffer",cellNF:true}).Sheets.Inherited;
  expect([output.A1.z,output.B1.z,output.A2.z,output.B2.z,output.C2.z]).toEqual(["0.00","0.00","General","0.00","General"]);
  expect([output.A1.v,output.B1.v,output.A2.v,output.B2.v,output.C2.v]).toEqual([2,3,4,5,6]);
  expect(reportToHtml(report).match(/background-color:#ECEFF4/g)).toHaveLength(4);expect(bytes).toEqual(before);
});
