import { expect,test } from "bun:test";
import * as XLSX from "xlsx";
import { compileExpression } from "depa-data-expression";
import { compileReport,renderReport } from "depa-data-report-logic";
import { readXlsxTemplate,writeXlsxReport,xlsxParts,reportToHtml } from "../src";
import { list,object,parseXml,text } from "../src/xml";
function chartTemplate():Uint8Array{
  const book=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet([["Region","Qty"],["*=region","*=qty"]]);
  sheet.A2.c=[{a:"report",t:"expandType=r\nexpandExpr=entity.rows"}];XLSX.utils.book_append_sheet(book,sheet,"Template");
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([["构建循环变量","data"],["循环变量名","entity"],["表单名称表达式","entity.name"]]),"Template-XptSheetModel");
  const cfb=XLSX.CFB.read(XLSX.write(book,{type:"buffer",bookType:"xlsx"}),{type:"buffer"});
  function add(path:string,value:string):void{XLSX.CFB.utils.cfb_add(cfb,`/${path}`,Buffer.from(value));}
  function change(path:string,fn:(s:string)=>string):void{add(path,fn(Buffer.from(XLSX.CFB.find(cfb,`/${path}`).content as Uint8Array).toString()));}
  change("xl/worksheets/sheet1.xml",s=>s.replace('</worksheet>','<drawing r:id="rIdChartDrawing"/></worksheet>'));
  change("xl/worksheets/_rels/sheet1.xml.rels",s=>s.replace('</Relationships>','<Relationship Id="rIdChartDrawing" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>'));
  add("xl/drawings/drawing1.xml",'<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:oneCellAnchor><xdr:from><xdr:col>4</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="3810000" cy="2857500"/><xdr:graphicFrame><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Sales" descr="Sales----&#10;chartTestExpr=entity.show&#10;chartTitleExpr=entity.name&#10;seriesTestExpr=series.index==0&#10;seriesNameExpr=&quot;Total &quot;+entity.name&#10;axisTitleExpr=&quot;Amount &quot;+entity.name&#10;seriesDataExpr=NEVER_RUN()&#10;seriesCatExpr=ALSO_NEVER_RUN()"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="3810000" cy="2857500"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="rIdChart"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>');
  add("xl/drawings/_rels/drawing1.xml.rels",'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdChart" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/></Relationships>');
  const series=(index:number)=>`<c:ser><c:idx val="${index}"/><c:order val="${index}"/><c:tx><c:v>Old</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="4472C4"/></a:solidFill></c:spPr><c:cat><c:strRef><c:f>'Template'!$A$2:$A$2</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>OLD</c:v></c:pt></c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>'Template'!$B$2:$B$2</c:f><c:numCache><c:formatCode>0.00</c:formatCode><c:ptCount val="1"/><c:pt idx="0"><c:v>999</c:v></c:pt></c:numCache></c:numRef></c:val></c:ser>`;
  add("xl/charts/chart1.xml",`<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:style val="12"/><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr b="1"/><a:t>Old title</a:t></a:r></a:p></c:rich></c:tx></c:title><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/>${series(0)}${series(1)}<c:axId val="1"/><c:axId val="2"/></c:barChart><c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:crossAx val="2"/></c:catAx><c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="l"/><c:crossAx val="1"/></c:valAx></c:plotArea><c:legend><c:legendPos val="b"/></c:legend><c:plotVisOnly val="1"/></c:chart></c:chartSpace>`);
  change("[Content_Types].xml",s=>s.replace('</Types>','<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>'));
  return new Uint8Array(XLSX.CFB.write(cfb,{type:"buffer",fileType:"zip"})as Uint8Array);
}

test("dynamic native charts get independent parts, title/axis bindings, projected ranges and accurate caches",()=>{
  const bytes=chartTemplate(),before=bytes.slice(),{template,archive}=readXlsxTemplate(bytes);
  expect(template.sheets[0].charts).toHaveLength(1);
  expect(template.sheets[0].charts?.[0].inertBindings).toEqual({seriesDataExpr:"NEVER_RUN()",seriesCatExpr:"ALSO_NEVER_RUN()"});
  let inertCalls=0;
  const runtime={evaluate:(source:string,scope:Record<string,unknown>)=>{if(source.includes("NEVER_RUN"))inertCalls++;return compileExpression(source).evaluate(scope);}};
  const report=renderReport(runtime,{template:compileReport(template),params:{data:[{name:"A",show:true,rows:[{region:"East",qty:2},{region:"West",qty:5}]},{name:"B",show:true,rows:[{region:"North",qty:7}]},{name:"Hidden",show:false,rows:[]}]}});
  expect(report.sheets.map(sheet=>sheet.charts?.length)).toEqual([1,1,0]);
  expect(report.sheets[0].charts?.[0].references.find(ref=>ref.kind==="seriesData")).toMatchObject({formula:"'A'!$B$2:$B$3",values:[2,5]});
  const output=writeXlsxReport(archive,report),parts=xlsxParts(output),paths=[...parts.keys()].filter(path=>/^xl\/charts\/reportChart\d+\.xml$/.test(path));expect(paths).toHaveLength(2);
  for(const [index,path]of paths.entries()){
    const space=object(parseXml(new TextDecoder().decode(parts.get(path)))["c:chartSpace"]),chart=object(space["c:chart"]),plot=object(chart["c:plotArea"]);
    expect(object(space["c:style"])["@val"]).toBe("12");
    const title=object(object(object(object(object(chart["c:title"])["c:tx"])["c:rich"])["a:p"])["a:r"]);
    expect(title["a:t"]).toBe(index===0?"A":"B");expect(object(title["a:rPr"])["@b"]).toBe("1");
    const series=list(object(plot["c:barChart"])["c:ser"]).map(object);expect(series).toHaveLength(1);
    expect(text(object(series[0]["c:tx"])["c:v"])).toBe(index===0?"Total A":"Total B");
    const values=object(object(series[0]["c:val"])["c:numRef"]),cache=object(values["c:numCache"]);
    expect(text(values["c:f"])).toBe(index===0?"'A'!$B$2:$B$3":"'B'!$B$2:$B$2");
    expect(list(cache["c:pt"]).map(point=>text(object(point)["c:v"]))).toEqual(index===0?["2","5"]:["7"]);
    expect(object(cache["c:ptCount"])["@val"]).toBe(index===0?"2":"1");expect(cache["c:formatCode"]).toBe("0.00");
    const categories=object(object(object(series[0]["c:cat"])["c:strRef"])["c:strCache"]);
    expect(list(categories["c:pt"]).map(point=>text(object(point)["c:v"]))).toEqual(index===0?["East","West"]:["North"]);
    expect(object(object(chart["c:legend"])["c:legendPos"])["@val"]).toBe("b");
    expect(new TextDecoder().decode(parts.get(path))).toContain(index===0?"Amount A":"Amount B");
  }
  expect(inertCalls).toBe(0);expect(bytes).toEqual(before);expect(reportToHtml(report)).toContain("East");expect(reportToHtml(report)).toContain("<figcaption>A</figcaption>");expect(reportToHtml(report)).toContain("Total A");
});
