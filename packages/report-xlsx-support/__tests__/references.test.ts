import { expect,test } from "bun:test";
import * as XLSX from "xlsx";
import { compileExpression } from "depa-data-expression";
import { compileReport,renderReport } from "depa-data-report-logic";
import { readXlsxTemplate,writeXlsxReport,xlsxParts,reportToHtml } from "../src";
import { object,list,parseXml,text } from "../src/xml";
const runtime={evaluate:(source:string,scope:Record<string,unknown>)=>compileExpression(source).evaluate(scope)};
function fixture(book:XLSX.WorkBook,edit:(cfb:ReturnType<typeof XLSX.CFB.read>)=>void):Uint8Array{
  const cfb=XLSX.CFB.read(XLSX.write(book,{type:"buffer",bookType:"xlsx"}),{type:"buffer"});edit(cfb);
  return new Uint8Array(XLSX.CFB.write(cfb,{type:"buffer",fileType:"zip"})as Uint8Array);
}
function change(cfb:ReturnType<typeof XLSX.CFB.read>,path:string,edit:(source:string)=>string):void{
  const source=Buffer.from(XLSX.CFB.find(cfb,`/${path}`).content as Uint8Array).toString();
  XLSX.CFB.utils.cfb_add(cfb,`/${path}`,Buffer.from(edit(source)));
}
function xml(parts:ReadonlyMap<string,Uint8Array>,path:string){return parseXml(new TextDecoder().decode(parts.get(path)));}

test("shared masters/followers become independent formulas; array boundaries survive actual XLSX",()=>{
  const book=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet([["qty","double","","array"],[2],[3]]);
  sheet.B2={t:"n",f:"A2*2"};sheet.B3={t:"n",f:"A3*2"};sheet.D1={t:"n",f:"SUM(A2:A3)"};
  XLSX.utils.book_append_sheet(book,sheet,"Formulas");
  const bytes=fixture(book,cfb=>change(cfb,"xl/worksheets/sheet1.xml",source=>source.replace("<f>A2*2</f>",'<f t="shared" si="0" ref="B2:B3">A2*2</f>').replace("<f>A3*2</f>",'<f t="shared" si="0"/>').replace("<f>SUM(A2:A3)</f>",'<f t="array" ref="D1:D1">SUM(A2:A3)</f>')));
  const {template,archive}=readXlsxTemplate(bytes),report=renderReport(runtime,{template:compileReport(template)});
  expect(report.sheets[0].cells.filter(c=>c.formula).map(c=>c.value)).toEqual([5,4,6]);
  const output=writeXlsxReport(archive,report),opened=XLSX.read(output,{type:"buffer"}).Sheets.Formulas;
  expect([opened.B2.f,opened.B2.v,opened.B3.f,opened.B3.v]).toEqual(["A2*2",4,"A3*2",6]);
  const nodes=list(object(xml(xlsxParts(output),"xl/worksheets/sheet1.xml").worksheet).sheetData).flatMap(v=>list(object(v).row)).flatMap(v=>list(object(v).c)).map(object);
  expect(object(nodes.find(c=>c["@r"]==="D1")?.f)).toMatchObject({"@t":"array","@ref":"D1","#text":"SUM(A2:A3)"});
  expect(nodes.filter(c=>object(c.f)["@t"]==="shared")).toHaveLength(0);
});

test("loop sheets relocate validation/CF/links/names/printing while rich text, freeze and protection stay intact",()=>{
  const book=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([["删除隐藏单元",false]]),"XptWorkbookModel");
  const sheet=XLSX.utils.aoa_to_sheet([["Name","Qty","Site","Go"],["*=name","*=qty","Web","Jump"],["END","","Bad"]]);
  sheet.A2.c=[{a:"report",t:"expandType=r\nexpandExpr=entity.rows"}];
  sheet.C2.l={Target:"https://example.com/?a=1&b=2"};sheet.D2.l={Target:"#Template!A2"};sheet.C3.l={Target:"javascript:alert(1)"};
  XLSX.utils.book_append_sheet(book,sheet,"Template");
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([["构建循环变量","data"],["循环变量名","entity"],["表单名称表达式","entity.name"]]),"Template-XptSheetModel");
  const bytes=fixture(book,cfb=>{
    change(cfb,"xl/worksheets/sheet2.xml",source=>source.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/,'<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A3" sqref="A3"/></sheetView></sheetViews>').replace(/<c r="A1"[\s\S]*?<\/c>/,'<c r="A1" t="inlineStr"><is><r><rPr><color rgb="FFFF0000"/><b/></rPr><t>Red</t></r><r><t>Name</t></r></is></c>').replace('</worksheet>','<sheetProtection sheet="1" password="ABCD"/><conditionalFormatting sqref="B2"><cfRule type="expression" priority="9"><formula>B2&lt;0</formula></cfRule></conditionalFormatting><dataValidations count="1"><dataValidation type="custom" sqref="B2"><formula1>A2&lt;&gt;""</formula1></dataValidation></dataValidations><autoFilter ref="A1:D3"/><rowBreaks count="1" manualBreakCount="1"><brk id="2" min="0" max="16383" man="1"/></rowBreaks><pageSetup orientation="landscape" paperSize="9"/></worksheet>'));
    change(cfb,"xl/workbook.xml",source=>source.replace('</workbook>',`<definedNames><definedName name="_xlnm.Print_Area" localSheetId="1">'Template'!$A$1:$D$3</definedName><definedName name="_xlnm.Print_Titles" localSheetId="1">'Template'!$1:$1</definedName><definedName name="Orders">'Template'!$A$2:$B$2</definedName></definedNames></workbook>`));
  });
  const snapshot=bytes.slice(),{template,archive}=readXlsxTemplate(bytes),report=renderReport(runtime,{template:compileReport(template),params:{data:[{name:"A",rows:[{name:"a",qty:-2},{name:"b",qty:3}]},{name:"B",rows:[{name:"c",qty:7}]}]}});
  const output=writeXlsxReport(archive,report),parts=xlsxParts(output),bookOut=XLSX.read(output,{type:"buffer"});
  expect(bookOut.SheetNames).toEqual(["A","B"]);
  // SheetJS exposes escaped relationship attributes. The XML codec and IR own
  // decoded URL values; verify both instead of trusting that display property.
  expect(report.sheets[0].cells.find(c=>c.row===2&&c.col===2)?.linkUrl).toBe("https://example.com/?a=1&b=2");
  const links=list(object(xml(parts,"xl/worksheets/_rels/sheet2.xml.rels").Relationships).Relationship).map(object).filter(rel=>text(rel["@Type"]).endsWith("/hyperlink"));
  expect(links.map(rel=>rel["@Target"])).toEqual(["https://example.com/?a=1&b=2","https://example.com/?a=1&b=2"]);
  expect(bookOut.Sheets.A.D3.l?.Target).toBe("#'A'!A3");expect(bookOut.Sheets.A.C4.l).toBeUndefined();
  const ws=object(xml(parts,"xl/worksheets/sheet2.xml").worksheet);
  expect(object(object(ws.dataValidations).dataValidation)).toMatchObject({"@sqref":"B2:B3",formula1:'A2<>""'});
  expect(object(ws.conditionalFormatting)["@sqref"]).toBe("B2:B3");expect(object(object(ws.conditionalFormatting).cfRule)["@priority"]).toBe("9");expect(object(object(ws.conditionalFormatting).cfRule).formula).toBe("B2<0");
  expect(object(ws.autoFilter)["@ref"]).toBe("A1:D4");expect(object(object(ws.rowBreaks).brk)["@id"]).toBe("3");
  const view=object(object(ws.sheetViews).sheetView);
  expect(object(view.pane)).toMatchObject({"@ySplit":"1","@topLeftCell":"A2"});expect(object(view.selection)["@activeCell"]).toBe("A4");
  expect(object(ws.sheetProtection)["@password"]).toBe("ABCD");expect(object(ws.pageSetup)["@orientation"]).toBe("landscape");
  const names=list(object(object(xml(parts,"xl/workbook.xml").workbook).definedNames).definedName).map(object);
  expect(names.filter(n=>n["@name"]==="_xlnm.Print_Area").map(n=>[n["@localSheetId"],text(n)])).toEqual([["0","'A'!$A$1:$D$4"],["1","'B'!$A$1:$D$3"]]);
  expect(text(names.find(n=>n["@name"]==="Orders"))).toBe("'A'!$A$2:$B$3,'B'!$A$2:$B$2");
  expect(names.filter(n=>n["@name"]==="_xlnm.Print_Titles").map(n=>text(n))).toEqual(["'A'!$1:$1","'B'!$1:$1"]);
  const html=reportToHtml(report);expect(html).toContain('color:#FF0000');expect(html).toContain('>Red</span>');expect(html).toContain('https://example.com/?a=1&amp;b=2');expect(html).not.toContain('javascript:');
  expect(bytes).toEqual(snapshot);expect(parts.has("xl/worksheets/sheet1.xml")).toBe(false);
});

test("tables get independent parts, names, ids and structured references for every loop sheet",()=>{
  const book=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet([["Name","Qty"],["*=name","*=qty"],["END"]]);
  sheet.A2.c=[{a:"report",t:"expandType=r\nexpandExpr=entity.rows"}];sheet.D3={t:"n",f:"SUM(Orders[Qty])",c:[{a:"report",t:"formulaMode=excel"}]};
  sheet["!ref"]="A1:D3";
  XLSX.utils.book_append_sheet(book,sheet,"Template");
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([["构建循环变量","data"],["循环变量名","entity"],["表单名称表达式","entity.name"]]),"Template-XptSheetModel");
  const bytes=fixture(book,cfb=>{
    change(cfb,"xl/worksheets/sheet1.xml",s=>s.replace('</worksheet>','<tableParts count="1"><tablePart r:id="rIdTable"/></tableParts></worksheet>'));
    change(cfb,"xl/worksheets/_rels/sheet1.xml.rels",s=>s.replace('</Relationships>','<Relationship Id="rIdTable" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/></Relationships>'));
    XLSX.CFB.utils.cfb_add(cfb,"/xl/tables/table1.xml",Buffer.from('<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="7" name="Orders" displayName="Orders" ref="A1:B2" headerRowCount="1" totalsRowCount="0"><autoFilter ref="A1:B2"/><tableColumns count="2"><tableColumn id="1" name="Name"/><tableColumn id="2" name="Qty"/></tableColumns><tableStyleInfo name="TableStyleMedium2" showRowStripes="1"/></table>'));
    change(cfb,"[Content_Types].xml",s=>s.replace('</Types>','<Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/></Types>'));
  });
  const {template,archive}=readXlsxTemplate(bytes),report=renderReport(runtime,{template:compileReport(template),params:{data:[{name:"First",rows:[{name:"a",qty:2},{name:"b",qty:3}]},{name:"Second",rows:[{name:"c",qty:7}]}]}});
  const output=writeXlsxReport(archive,report),parts=xlsxParts(output);
  const tables=[...parts.keys()].filter(path=>/^xl\/tables\/[^/]+\.xml$/.test(path)).map(path=>object(xml(parts,path).table));
  expect(tables.map(t=>[t["@id"],t["@displayName"],t["@ref"],object(t.autoFilter)["@ref"]])).toEqual([["1","Orders","A1:B3","A1:B3"],["2","Orders_2","A1:B2","A1:B2"]]);
  expect(tables.map(t=>list(object(t.tableColumns).tableColumn).map(c=>object(c)["@name"]))).toEqual([["Name","Qty"],["Name","Qty"]]);
  expect(tables.every(t=>object(t.tableStyleInfo)["@name"]==="TableStyleMedium2")).toBe(true);
  const first=object(xml(parts,"xl/worksheets/_rels/sheet1.xml.rels").Relationships),second=object(xml(parts,"xl/worksheets/_rels/reportSheet1.xml.rels").Relationships);
  const targets=[first,second].map(root=>list(root.Relationship).map(object).find(r=>text(r["@Type"]).endsWith("/table"))?.["@Target"]);
  expect(new Set(targets).size).toBe(2);
  const formulas=["xl/worksheets/sheet1.xml","xl/worksheets/reportSheet1.xml"].map(path=>list(object(object(xml(parts,path).worksheet).sheetData).row).flatMap(r=>list(object(r).c)).map(object).find(c=>text(c.f).includes("Orders"))?.f);
  expect(formulas).toEqual(["SUM(Orders[Qty])","SUM(Orders_2[Qty])"]);
  const overrides=list(object(xml(parts,"[Content_Types].xml").Types).Override).map(object);
  expect(overrides.filter(node=>text(node["@PartName"]).startsWith("/xl/tables/")).length).toBe(2);
});

test("unknown extensions are precisely located for affected layouts; unsafe URL schemes remain inert",()=>{
  const book=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet([["*=qty","link"]]);
  sheet.A1.c=[{a:"report",t:"expandType=r\nexpandExpr=data"}];sheet.B1.c=[{a:"report",t:"linkExpr=url"}];XLSX.utils.book_append_sheet(book,sheet,"Unknown");
  const bytes=fixture(book,cfb=>change(cfb,"xl/worksheets/sheet1.xml",s=>s.replace('</worksheet>','<extLst><ext uri="custom"/></extLst></worksheet>')));
  const {template,archive}=readXlsxTemplate(bytes);
  const report=renderReport(runtime,{template:compileReport(template),datasets:{data:[{qty:1,url:"javascript:alert(1)"},{qty:2,url:"data:text/html,evil"}]}});
  expect(()=>writeXlsxReport(archive,report)).toThrow("xl/worksheets/sheet1.xml/extLst");
  expect(reportToHtml(report)).not.toContain("<a ");
  const fixed=renderReport(runtime,{template:compileReport(template),datasets:{data:[{qty:1,url:"https://example.com"}]}});
  expect(()=>writeXlsxReport(archive,fixed)).not.toThrow();
  expect(reportToHtml(fixed)).toContain('<a href="https://example.com"');
});
