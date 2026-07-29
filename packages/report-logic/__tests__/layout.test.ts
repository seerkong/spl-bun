import { expect,test } from "bun:test";
import { compileExpression } from "depa-data-expression";
import { compileReport,renderReport } from "../src";
import type { ReportTemplate,TemplateCell } from "depa-data-report-contract";
const runtime={evaluate:(source:string,scope:Record<string,unknown>)=>compileExpression(source).evaluate(scope)};
const at=(report:ReturnType<typeof renderReport>,row:number,col:number)=>report.sheets[0].cells.find(cell=>cell.row===row&&cell.col===col)?.value;
function make(cells:TemplateCell[],rows=4,cols=5):ReportTemplate{return{sheets:[{name:"Layout",rowCount:rows,colCount:cols,cells,merges:[]}]};}
const anchor=(row:number,col:number,axis:"r"|"c",expr:string,more=""):TemplateCell=>({row,col,value:"*=cell.ev",annotation:`expandType=${axis}\nexpandExpr=${expr}${more?`\n${more}`:""}`});

test("inplace reuses three original slots and inserts only excess, preserving unrelated headers",()=>{
  const source=make([{row:0,col:1,value:"B"},{row:0,col:2,value:"C"},{row:0,col:3,value:"D"},anchor(1,1,"c","items","expandInplaceCount=3"),{row:1,col:4,value:"TAIL"}],3,5);
  for(const n of [2,3,4]){
    const report=renderReport(runtime,{template:compileReport(source),params:{items:Array.from({length:n},(_,i)=>i+1)}});
    expect(report.sheets[0].colCount).toBe(n===4?6:5);
    expect(Array.from({length:n},(_,i)=>at(report,1,i+1))).toEqual(Array.from({length:n},(_,i)=>i+1));
    expect(at(report,1,n===4?5:4)).toBe("TAIL");
    expect([at(report,0,1),at(report,0,2),at(report,0,3)]).toEqual(["B","C","D"]);
  }
});
test("same-parent sibling sequences share growth; fixed cells extend only when configured",()=>{
  for(const extend of [true,false]){
    const source=make([anchor(1,0,"r","left","rowParent=A0"),anchor(1,2,"r","right","rowParent=A0"),{row:1,col:4,value:"LABEL",annotation:`rowParent=A0\nrowExtendForSibling=${extend}`},{row:2,col:0,value:"END"}],3,5);
    const report=renderReport(runtime,{template:compileReport(source),params:{left:["a","b","c"],right:[10,20]}});
    expect(report.sheets[0].rowCount).toBe(5);
    expect([at(report,1,0),at(report,2,0),at(report,3,0)]).toEqual(["a","b","c"]);
    expect([at(report,1,2),at(report,2,2),at(report,3,2)]).toEqual([10,20,undefined]);
    expect(at(report,4,0)).toBe("END");
    const merge=report.sheets[0].merges.find(m=>m.start.row===1&&m.start.col===4);
    expect(merge?.end.row).toBe(extend?3:undefined);
  }
});
test("row parent in middle of a three-row body duplicates the whole body and preserves parent identity",()=>{
  const source=make([anchor(2,0,"r","items"),{row:1,col:1,value:"head ${item}",annotation:"rowParent=A3"},{row:2,col:1,value:"body ${item}"},{row:3,col:1,value:"tail ${item}",annotation:"rowParent=A3"},{row:4,col:0,value:"END"}],5,2);
  const report=renderReport(runtime,{template:compileReport(source),params:{items:["a","b"]}});
  expect(report.sheets[0].rowCount).toBe(8);
  expect([at(report,1,1),at(report,2,1),at(report,3,1),at(report,4,1),at(report,5,1),at(report,6,1),at(report,7,0)]).toEqual(["head a","body a","tail a","head b","body b","tail b","END"]);
});
test("each row expands its own document columns; later fixed columns align globally",()=>{
  const source=make([anchor(1,0,"r","devices"),anchor(1,2,"c","cell.rp.ev.docs","rowParent=A2\ncolParent=A0"),{row:1,col:4,value:"Action"},{row:2,col:0,value:"END"}],3,5);
  // Field projection on the row anchor, rather than serializing the whole record.
  source.sheets[0].cells[0].value="*=name";
  const report=renderReport(runtime,{template:compileReport(source),params:{devices:[{name:"X",docs:["p","q"]},{name:"Y",docs:["z"]}]}});
  expect(report.sheets[0].colCount).toBe(6);
  expect([at(report,1,0),at(report,2,0)]).toEqual(["X","Y"]);
  expect([at(report,1,2),at(report,1,3),at(report,2,2),at(report,2,3)]).toEqual(["p","q","z",undefined]);
  expect([at(report,1,5),at(report,2,5)]).toEqual(["Action","Action"]);
});
test("column-local row expansion is symmetric",()=>{
  const source=make([anchor(0,1,"c","groups"),anchor(2,1,"r","cell.cp.ev.items","colParent=B1\nrowParent=A0"),{row:3,col:1,value:"TAIL"}],4,2);
  source.sheets[0].cells[0].value="*=cell.ev.name";
  const report=renderReport(runtime,{template:compileReport(source),params:{groups:[{name:"X",items:["p","q"]},{name:"Y",items:["z"]}]}});
  expect([report.sheets[0].rowCount,report.sheets[0].colCount]).toEqual([5,3]);
  expect([at(report,2,1),at(report,3,1),at(report,2,2),at(report,3,2)]).toEqual(["p","q","z",undefined]);
  expect([at(report,4,1),at(report,4,2)]).toEqual(["TAIL","TAIL"]);
});
test("alternating row-column-row dependencies retain each parent domain",()=>{
  const source=make([anchor(1,0,"r","devices"),anchor(1,2,"c","cell.rp.ev.docs","rowParent=A2\ncolParent=A0"),anchor(2,2,"r","cell.cp.ev.items","rowParent=C2\ncolParent=C2"),{row:3,col:0,value:"END"}],4,3);
  source.sheets[0].cells[0].value="*=name";source.sheets[0].cells[1].value="*=cell.ev.name";
  const report=renderReport(runtime,{template:compileReport(source),params:{devices:[{name:"X",docs:[{name:"p",items:[1,2]},{name:"q",items:[3]}]},{name:"Y",docs:[{name:"z",items:[4,5,6]}]}]}});
  const names=report.sheets[0].cells.filter(c=>c.origin==="A2").map(c=>c.value);
  expect(names).toEqual(["X","Y"]);
  expect(report.sheets[0].cells.filter(c=>c.origin==="C2").map(c=>c.value)).toEqual(["p","q","z"]);
  expect(report.sheets[0].cells.filter(c=>c.origin==="C3").map(c=>c.value)).toEqual([1,3,2,4,5,6]);
});
