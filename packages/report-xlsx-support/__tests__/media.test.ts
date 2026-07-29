import { expect,test } from "bun:test";
import * as XLSX from "xlsx";
import { deflateSync } from "node:zlib";
import { compileExpression } from "depa-data-expression";
import { compileReport,renderReport } from "depa-data-report-logic";
import { readXlsxTemplate,writeXlsxReport,xlsxParts,reportToHtml } from "../src";
import { list,object,parseXml,text } from "../src/xml";
const runtime={evaluate:(source:string,scope:Record<string,unknown>)=>compileExpression(source).evaluate(scope)};
export function pngPixel(red:number):Uint8Array{
  function chunk(type:string,data:Uint8Array):Buffer{
    const content=Buffer.concat([Buffer.from(type),data]);let crc=0xffffffff;
    for(const byte of content){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    const head=Buffer.alloc(4),tail=Buffer.alloc(4);head.writeUInt32BE(data.length);tail.writeUInt32BE((crc^0xffffffff)>>>0);
    return Buffer.concat([head,content,tail]);
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(1,0);header.writeUInt32BE(1,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",header),chunk("IDAT",deflateSync(Buffer.from([0,red,0,0,255]))),chunk("IEND",new Uint8Array())]);
}
function templateBytes():Uint8Array{
  const book=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet([["Item","Photo"],["*=name",""]]);
  sheet.A2.c=[{a:"report",t:"expandType=r\nexpandExpr=entity.rows"}];XLSX.utils.book_append_sheet(book,sheet,"Template");
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([["构建循环变量","data"],["循环变量名","entity"],["表单名称表达式","entity.name"]]),"Template-XptSheetModel");
  const cfb=XLSX.CFB.read(XLSX.write(book,{type:"buffer",bookType:"xlsx"}),{type:"buffer"});
  function add(path:string,value:string|Uint8Array):void{XLSX.CFB.utils.cfb_add(cfb,`/${path}`,Buffer.from(value));}
  function change(path:string,fn:(source:string)=>string):void{add(path,fn(Buffer.from(XLSX.CFB.find(cfb,`/${path}`).content as Uint8Array).toString()));}
  change("xl/worksheets/sheet1.xml",s=>s.replace('</worksheet>','<drawing r:id="rIdPicture"/></worksheet>'));
  change("xl/worksheets/_rels/sheet1.xml.rels",s=>s.replace('</Relationships>','<Relationship Id="rIdPicture" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>'));
  add("xl/drawings/drawing1.xml",'<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:oneCellAnchor><xdr:from><xdr:col>1</xdr:col><xdr:colOff>9525</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>19050</xdr:rowOff></xdr:from><xdr:ext cx="381000" cy="285750"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Photo" descr="logo----&#10;testExpr=show&#10;dataExpr=photo"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rIdImage"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>');
  add("xl/drawings/_rels/drawing1.xml.rels",'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>');
  add("xl/media/image1.png",pngPixel(0));
  change("[Content_Types].xml",s=>s.replace('</Types>','<Default Extension="png" ContentType="image/png"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>'));
  return new Uint8Array(XLSX.CFB.write(cfb,{type:"buffer",fileType:"zip"})as Uint8Array);
}

test("two sheets by two records produce four independent image anchors, byte replacements and matching HTML",()=>{
  const bytes=templateBytes(),before=bytes.slice(),red=pngPixel(255),dark=pngPixel(80);
  const {template,archive}=readXlsxTemplate(bytes);
  expect(template.sheets[0].images?.[0]).toMatchObject({testExpr:"show",dataExpr:"photo",description:"logo"});
  const rows=[{name:"a",show:true,photo:{bytes:red,mimeType:"image/png"}},{name:"b",show:true,photo:{bytes:dark,mimeType:"image/png"}}];
  const report=renderReport(runtime,{template:compileReport(template),params:{data:[{name:"A",rows},{name:"B",rows}]}});
  expect(report.sheets.map(sheet=>sheet.images?.map(image=>[image.anchor.from.row,image.anchor.from.col,image.anchor.from.rowOffsetEMU,image.anchor.widthEMU,image.anchor.heightEMU]))).toEqual([[[1,1,19050,381000,285750],[2,1,19050,381000,285750]],[[1,1,19050,381000,285750],[2,1,19050,381000,285750]]]);
  const output=writeXlsxReport(archive,report),parts=xlsxParts(output);
  const drawings=[...parts.keys()].filter(path=>/^xl\/drawings\/reportDrawing\d+\.xml$/.test(path));expect(drawings).toHaveLength(2);
  for(const path of drawings){
    const root=object(parseXml(new TextDecoder().decode(parts.get(path)))["xdr:wsDr"]);
    const anchors=list(root["xdr:oneCellAnchor"]).map(object);expect(anchors).toHaveLength(2);
    expect(anchors.map(anchor=>text(object(anchor["xdr:from"])["xdr:row"]))).toEqual(["1","2"]);
  }
  const media=[...parts.keys()].filter(path=>/^xl\/media\/reportImage\d+\.png$/.test(path));expect(media).toHaveLength(4);
  expect(media.map(path=>parts.get(path))).toEqual([red,dark,red,dark]);
  expect(reportToHtml(report).match(/<img /g)).toHaveLength(4);expect(reportToHtml(report)).toContain('width="40" height="30"');
  expect(bytes).toEqual(before);expect(rows[0].photo.bytes).toEqual(red);
  const filtered=renderReport(runtime,{template:compileReport(template),params:{data:[{name:"F",rows:[{...rows[0],show:false},{...rows[1],photo:null}]}]}});
  expect(filtered.sheets[0].images).toEqual([]);expect(reportToHtml(filtered)).not.toContain("<img ");
  expect(()=>renderReport(runtime,{template:compileReport(template),params:{data:[{name:"A",rows}]}},{maxMediaItems:1})).toThrow("media item limit");
  const bad=renderReport(runtime,{template:compileReport(template),params:{data:[{name:"Bad",rows:[{name:"broken",show:true,photo:{bytes:[1,2,3],mimeType:"image/png"}}]}]}});
  expect(()=>writeXlsxReport(archive,bad)).toThrow("Bad image Photo: invalid");
});
