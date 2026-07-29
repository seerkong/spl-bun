import { expect,test } from "bun:test";
import { inflateSync } from "node:zlib";
import { compileExpression } from "depa-data-expression";
import { compileReport,renderReport } from "depa-data-report-logic";
import { renderBarcode,readXlsxTemplate,writeXlsxReport,xlsxParts,reportToHtml } from "../src";
import * as XLSX from "xlsx";
function pixels(bytes:Uint8Array):Buffer{
  const buffer=Buffer.from(bytes),parts:Uint8Array[]=[];
  for(let pos=8;pos<buffer.length;){const length=buffer.readUInt32BE(pos),name=buffer.toString("ascii",pos+4,pos+8);if(name==="IDAT")parts.push(buffer.subarray(pos+8,pos+8+length));pos+=length+12;}
  return inflateSync(Buffer.concat(parts));
}
test("bounded barcode adapter emits distinct full-size QR and Code128 PNGs",()=>{
  for(const format of ["QR_CODE","CODE_128"]){
    const first=renderBarcode({content:"123459V",format,width:320,height:160}),second=renderBarcode({content:"different",format,width:320,height:160});
    expect(first.bytes.slice(0,8)).toEqual(new Uint8Array([137,80,78,71,13,10,26,10]));
    const view=new DataView(first.bytes.buffer,first.bytes.byteOffset,first.bytes.byteLength);expect([view.getUint32(16),view.getUint32(20)]).toEqual([320,160]);
    expect(first.bytes).not.toEqual(second.bytes);const raw=pixels(first.bytes);expect(raw.length).toBe((320*4+1)*160);
    expect(raw.filter(value=>value===0).length).toBeGreaterThan(160);expect(raw.filter(value=>value===255).length).toBeGreaterThan(160);
  }
  const small=renderBarcode({content:"abc",format:"QR_CODE",width:8,height:8});
  expect(new DataView(small.bytes.buffer,small.bytes.byteOffset,small.bytes.byteLength).getUint32(16)).toBe(29);
  expect(()=>renderBarcode({content:"abc",format:"QR_CODE",width:4096,height:8})).toThrow("1..2048");
});
test("QRCODE process, qr options and explicit cell image patches use the injected port and serialize",()=>{
  const book=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet([["Code"],["*=code"]]);
  sheet.A2.c=[{a:"report",t:"expandType=r\nexpandExpr=rows\nprocessExpr=QRCODE()\nqr:barcodeFormat=CODE_128\nqr:width=320\nqr:height=160"}];
  sheet["!rows"]=[{}, {hpt:100}];sheet["!cols"]=[{wch:40}];XLSX.utils.book_append_sheet(book,sheet,"Codes");
  const {template,archive}=readXlsxTemplate(new Uint8Array(XLSX.write(book,{type:"buffer",bookType:"xlsx"}))),input={template:compileReport(template),datasets:{rows:[{code:"123459V"},{code:"ABC123"},{code:""}]}};
  const runtime={evaluate:(source:string,scope:Record<string,unknown>)=>compileExpression(source).evaluate(scope),renderBarcode};
  const output=renderReport(runtime,input);expect(output.sheets[0].images).toHaveLength(2);
  expect(output.sheets[0].images?.map(image=>image.anchor.from.row)).toEqual([1,2]);
  const bytes=writeXlsxReport(archive,output),parts=xlsxParts(bytes);expect([...parts.keys()].filter(path=>path.includes("/reportImage"))).toHaveLength(2);
  expect(reportToHtml(output).match(/<img /g)).toHaveLength(2);
  expect(()=>renderReport({evaluate:runtime.evaluate},input)).toThrow("explicit runtime.renderBarcode");
  const picture=renderBarcode({content:"patch",format:"QR_CODE",width:128,height:128});
  const patched=renderReport(runtime,{template:compileReport({sheets:[{name:"Patch",rowCount:1,colCount:1,merges:[],cells:[{row:0,col:0,annotation:"processExpr={image:photo}"}]}]}),params:{photo:{bytes:[...picture.bytes],mimeType:"image/png"}}});
  expect(patched.sheets[0].images?.[0].data.bytes).toEqual(picture.bytes);
});
