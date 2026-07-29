import * as XLSX from "xlsx";
import type {
  ReportTemplate, RenderedReport, TemplateCell, TemplateSheet, ReportStyle,
} from "depa-data-report-contract";
import { buildXml, list, object, parseXml, text, type XmlNode } from "./xml";
import { readStyles } from "./styles";
import { readSheetConfiguration } from "./configuration";
import { copyFormula, createReferenceProjection } from "depa-data-report-logic";
import { a1, projectDefinedNames, projectWorksheetMetadata, projectTable, renameStructuredReferences } from "./metadata";
import { safeReportLink } from "./links";
import { resolvePart,relativePart,relPathFor } from "./part-paths";
import { readSheetDrawings,writeSheetDrawings } from "./drawings";

export interface XlsxTemplateArchive {
  readonly bytes: Uint8Array;
  readonly sheetPaths: Readonly<Record<string, string>>;
  readonly parts: ReadonlyMap<string, Uint8Array>;
  readonly dimensions: Readonly<Record<string, { rows: number; cols: number }>>;
}
const decoder = new TextDecoder();
const encode = (value: string) => new TextEncoder().encode(value);

/** Bound decompression before asking the ZIP codec to allocate uncompressed parts. */
function validateZip(bytes: Uint8Array): void {
  if (bytes.length > 10 * 1024 * 1024 || bytes.length < 22) throw new Error("Template must be an XLSX ZIP of at most 10 MiB");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Invalid XLSX ZIP directory");
  const count = view.getUint16(eocd + 10, true);
  if (count > 1000 || view.getUint16(eocd + 4, true) || view.getUint16(eocd + 6, true)) throw new Error("Unsupported XLSX ZIP size or split archive");
  let offset = view.getUint32(eocd + 16, true);
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > eocd || view.getUint32(offset, true) !== 0x02014b50) throw new Error("Invalid XLSX ZIP entry");
    total += view.getUint32(offset + 24, true);
    if (total > 32 * 1024 * 1024) throw new Error("Uncompressed template exceeds 32 MiB");
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
}

export function xlsxParts(bytes: Uint8Array): Map<string, Uint8Array> {
  validateZip(bytes);
  const cfb = XLSX.CFB.read(Buffer.from(bytes), { type: "buffer" });
  const result = new Map<string, Uint8Array>();
  cfb.FullPaths.forEach((path: string, i: number) => {
    if (cfb.FileIndex[i].type === 2) {
      const name = path.replace(/^[^/]+\//, "");
      if (result.has(name) || name.includes("../")) throw new Error("Invalid duplicate/template part path");
      result.set(name, new Uint8Array(cfb.FileIndex[i].content as Uint8Array));
    }
  });
  return result;
}

function partText(parts: ReadonlyMap<string, Uint8Array>, path: string): string {
  const bytes = parts.get(path);
  if (!bytes) throw new Error(`Missing XLSX part: ${path}`);
  return decoder.decode(bytes);
}
function columnStyleIds(worksheet:XmlNode,location:string):Map<number,number>{
  const ids=new Map<number,number>();
  for(const raw of list(object(worksheet.cols).col)){
    const col=object(raw),min=Number(col["@min"]),max=Number(col["@max"]);
    if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min<1||max>16384||max<min)throw new Error(`${location}: invalid column dimensions`);
    if(col["@style"]!==undefined)for(let index=min-1;index<max;index++)ids.set(index,Number(col["@style"]));
  }
  return ids;
}
function cellStyleId(cell:XmlNode,row:XmlNode,col:number,columns:ReadonlyMap<number,number>):number{
  const rowStyle=row["@customFormat"]==="0"?undefined:row["@s"];
  const id=Number(cell["@s"]??rowStyle??columns.get(col)??0);
  if(!Number.isSafeInteger(id)||id<0)throw new Error(`Invalid style index ${id}`);
  return id;
}


export function readXlsxTemplate(bytes: Uint8Array): { template: ReportTemplate; archive: XlsxTemplateArchive } {
  const parts = xlsxParts(bytes);
  const workbookXml = object(parseXml(partText(parts, "xl/workbook.xml")).workbook);
    if (!workbookXml.sheets) throw new Error("Unsupported or empty SpreadsheetML workbook namespace");
  const rels = list(object(parseXml(partText(parts, "xl/_rels/workbook.xml.rels")).Relationships).Relationship).map(object);
  const relationById = new Map(rels.map((rel) => [rel["@Id"], rel]));
  const sheetPaths: Record<string, string> = {};
  const workbook = XLSX.read(Buffer.from(bytes), { type: "buffer", cellFormula: true, cellNF: true, cellStyles: true, sheetStubs: true });
  const styles = readStyles(parts.has("xl/styles.xml") ? partText(parts, "xl/styles.xml") : undefined);
  const sharedStrings = parts.has("xl/sharedStrings.xml") ? list(object(parseXml(partText(parts,"xl/sharedStrings.xml")).sst).si) : [];
  const sheetInfo = list(object(workbookXml.sheets).sheet);
  const styleIdsFor=(name:string):Readonly<Record<string,number>>=>{
    const info=sheetInfo.map(object).find(info=>info["@name"]===name),rel=info?relationById.get(info["@r:id"]):undefined;
    if(!rel)return {};
    const xml=object(parseXml(partText(parts,resolvePart("xl/workbook.xml",text(rel["@Target"])))).worksheet);
    const columns=columnStyleIds(xml,name);
    return Object.fromEntries(list(object(xml.sheetData).row).flatMap(raw=>list(object(raw).c).map(value=>{const cell=object(value),address=text(cell["@r"]);return[address,cellStyleId(cell,object(raw),XLSX.utils.decode_cell(address).c,columns)];})));
  };
  const hasNopConfiguration = workbook.SheetNames.some(name => name === "XptWorkbookModel" || name.endsWith("-XptSheetModel"));
  const config = workbook.SheetNames.includes("XptWorkbookModel") ? readSheetConfiguration(workbook,"XptWorkbookModel","workbook",styleIdsFor("XptWorkbookModel")) : undefined;
  const palette:Record<string,ReportStyle>=Object.fromEntries(styles.map((style,styleId)=>[String(styleId),{...style,styleId}]));
  for(const [alias,index]of Object.entries(config?.namedStyles??{}))if(styles[index])palette[alias]={...styles[index],styleId:index};
  const sheets: TemplateSheet[] = sheetInfo.filter(item => {
    const name = text(object(item)["@name"]);
    return name !== "XptWorkbookModel" && !name.endsWith("-XptSheetModel");
  }).map((item) => {
    const info = object(item);
    const name = text(info["@name"]);
    const relation = relationById.get(info["@r:id"]);
    if (!relation || relation["@TargetMode"] === "External") throw new Error(`Invalid worksheet relationship: ${name}`);
    const path = resolvePart("xl/workbook.xml", text(relation["@Target"]));
    sheetPaths[name] = path;
    const worksheet = object(parseXml(partText(parts, path)).worksheet);
    if (!worksheet.sheetData) throw new Error(`${name}: missing worksheet data or unsupported SpreadsheetML namespace`);
    const sourceSheet = workbook.Sheets[name];
    if (!sourceSheet) throw new Error(`Unsupported worksheet: ${name}`);
    const cells: TemplateCell[] = [];
    const sourceRelsPath=`${path.slice(0,path.lastIndexOf("/")+1)}_rels/${path.slice(path.lastIndexOf("/")+1)}.rels`;
    const linkRelations=parts.has(sourceRelsPath)?list(object(parseXml(partText(parts,sourceRelsPath)).Relationships).Relationship).map(object):[];
    const links=new Map<string,string>();
    for(const raw of list(object(worksheet.hyperlinks).hyperlink)){
      const link=object(raw),relation=linkRelations.find(rel=>rel["@Id"]===link["@r:id"]),location=text(link["@location"]);
      const target=relation?text(relation["@Target"]):"",url=`${target}${location?`#${location}`:""}`;
      const range=XLSX.utils.decode_range(text(link["@ref"]));
      if((range.e.r-range.s.r+1)*(range.e.c-range.s.c+1)>100000)throw new Error(`${name}: hyperlink range exceeds 100000 cells`);
      for(let r=range.s.r;r<=range.e.r;r++)for(let c=range.s.c;c<=range.e.c;c++)links.set(XLSX.utils.encode_cell({r,c}),url);
    }
    const rowHeights: Record<number, number> = {};
    const hiddenRows:Record<number,boolean>={},hiddenCols:Record<number,boolean>={};
    const rowStyles:Record<number,ReportStyle>={},colStyles:Record<number,ReportStyle>={};
    const columnIds=columnStyleIds(worksheet,name);
    for(const [index,styleId]of columnIds)if(styles[styleId])colStyles[index]={...styles[styleId],styleId};
    const sharedFormulas = new Map<string,{address:string;formula:string}>();
    for (const rawRow of list(object(worksheet.sheetData).row)) for (const raw of list(object(rawRow).c)) {
      const node=object(raw),f=object(node.f);
      if(f["@t"]==="shared"&&text(f)) sharedFormulas.set(text(f["@si"]),{address:text(node["@r"]),formula:text(f)});
    }
    let rowCount = 0, colCount = 0;
    for (const rawRow of list(object(worksheet.sheetData).row)) {
      const row = object(rawRow);
      const index = Number(row["@r"]) - 1;
      const rowStyleId=Number(row["@s"]);
      if(row["@customFormat"]!=="0"&&styles[rowStyleId])rowStyles[index]={...styles[rowStyleId],styleId:rowStyleId};
      if (Number.isFinite(Number(row["@ht"]))) rowHeights[index] = Number(row["@ht"]);
      if(row["@hidden"]==="1"||row["@hidden"]==="true")hiddenRows[index]=true;
      rowCount = Math.max(rowCount, index + 1);
      for (const raw of list(row.c)) {
        const node = object(raw);
        const address = text(node["@r"]);
        const pos = XLSX.utils.decode_cell(address);
        const cell = sourceSheet[address];
        const styleId = cellStyleId(node,row,pos.c,columnIds);
        const f = object(node.f);
        let formula=cell?.f;
        if(f["@t"]==="shared"){
          const master=sharedFormulas.get(text(f["@si"]));
          if(!master)throw new Error(`${name}!${address}: missing shared formula master ${f["@si"]}`);
          const origin=XLSX.utils.decode_cell(master.address);
          formula=copyFormula(master.formula,{row:origin.r,col:origin.c},{row:pos.r,col:pos.c});
        }else if(f["@t"]&&f["@t"]!=="array"&&f["@t"]!=="normal")throw new Error(`${name}!${address}: unsupported formula representation ${f["@t"]}`);
        const array=f["@t"]==="array"?XLSX.utils.decode_range(text(f["@ref"])):undefined;
        const richNode=node["@t"]==="s"?object(sharedStrings[Number(node.v)]):object(node.is);
        const richText=list(richNode.r).map(raw=>{
          const run=object(raw),pr=object(run.rPr),css:Record<string,string>={};
          if(pr.b!==undefined&&object(pr.b)["@val"]!=="0")css["font-weight"]="bold";
          if(pr.i!==undefined&&object(pr.i)["@val"]!=="0")css["font-style"]="italic";
          if(pr.u!==undefined)css["text-decoration"]="underline";
          const color=text(object(pr.color)["@rgb"]);
          if(/^[A-F\d]{6,8}$/i.test(color))css.color=`#${color.slice(-6)}`;
          const size=Number(object(pr.sz)["@val"]);if(size>0&&size<=400)css["font-size"]=`${size}pt`;
          return{text:text(run.t),css};
        });
        cells.push({ row: pos.r, col: pos.c, value: cell?.v, formula, formulaMode: hasNopConfiguration && formula ? "report" : undefined,
          arrayFormulaRange:array?{start:{row:array.s.r,col:array.s.c},end:{row:array.e.r,col:array.e.c}}:undefined,
          richText:richText.length?richText:undefined,linkUrl:links.get(address),
          annotation: cell?.c?.map((c: { t?: string }) => c.t).join("\n"), styleId,
          numberFormat: styles[styleId]?.numberFormat ?? cell?.z, css: styles[styleId]?.css });
        rowCount = Math.max(rowCount, pos.r + 1); colCount = Math.max(colCount, pos.c + 1);
      }
    }
    // Comments may annotate otherwise absent cells.
    for (const address of Object.keys(sourceSheet).filter((key) => !key.startsWith("!"))) {
      const cell = sourceSheet[address];
      if (!cell.c?.length || cells.some((c) => XLSX.utils.encode_cell({ r: c.row, c: c.col }) === address)) continue;
      const pos = XLSX.utils.decode_cell(address);
      cells.push({ row: pos.r, col: pos.c, value: cell.v, annotation: cell.c.map((c: { t?: string }) => c.t).join("\n") });
      rowCount = Math.max(rowCount, pos.r + 1); colCount = Math.max(colCount, pos.c + 1);
    }
    for(const [address,linkUrl]of links)if(!cells.some(cell=>XLSX.utils.encode_cell({r:cell.row,c:cell.col})===address)){
      const pos=XLSX.utils.decode_cell(address);cells.push({row:pos.r,col:pos.c,linkUrl});rowCount=Math.max(rowCount,pos.r+1);colCount=Math.max(colCount,pos.c+1);
    }
    const merges = list(object(worksheet.mergeCells).mergeCell).map((m) => {
      const range = XLSX.utils.decode_range(text(object(m)["@ref"]));
      rowCount = Math.max(rowCount, range.e.r + 1); colCount = Math.max(colCount, range.e.c + 1);
      return { start: { row: range.s.r, col: range.s.c }, end: { row: range.e.r, col: range.e.c } };
    });
    const colWidths: Record<number, number> = {};
    for (const raw of list(object(worksheet.cols).col)) {
      const col = object(raw);
      const min = Number(col["@min"]), max = Number(col["@max"]);
      if (min < 1 || max > 16384 || max < min) throw new Error(`${name}: invalid column dimensions`);
      for (let i = min - 1; i < max; i++) if (col["@width"]) colWidths[i] = Number(col["@width"]);
      for(let i=min-1;i<max;i++)if(col["@hidden"]==="1"||col["@hidden"]==="true")hiddenCols[i]=true;
    }
    const drawings=readSheetDrawings(parts,path,worksheet);
    for(const image of drawings.images){rowCount=Math.max(rowCount,image.anchor.from.row+1);colCount=Math.max(colCount,image.anchor.from.col+1);}
    const configurationName = `${name}-XptSheetModel`;
    const sheetConfig = workbook.SheetNames.includes(configurationName) ? readSheetConfiguration(workbook,configurationName,"sheet") : undefined;
    return { name, sourceSheetId:name, sourceSheetName:name, config:sheetConfig, ...drawings, cells, merges, rowCount, colCount, rowHeights, colWidths,hiddenRows,hiddenCols,rowStyles,colStyles };
  });
  return { template: { sheets,config,styles:palette }, archive: { bytes: bytes.slice(), parts, sheetPaths,
    dimensions: Object.fromEntries(sheets.map((s) => [s.name, { rows: s.rowCount, cols: s.colCount }])) } };
}

export function writeXlsxReport(archive: XlsxTemplateArchive, report: RenderedReport): Uint8Array {
  if (!report.sheets.length) throw new Error("XLSX report must contain at least one worksheet; keep a fixed cover for empty loops");
  const cfb = XLSX.CFB.read(Buffer.from(archive.bytes), { type: "buffer" });
  const originalWorkbook = XLSX.read(Buffer.from(archive.bytes), { type: "buffer" });
  const projection = createReferenceProjection(report);
  const write = (name: string, node: XmlNode) => XLSX.CFB.utils.cfb_add(cfb, `/${name}`, Buffer.from(encode(buildXml(node))));
  const removeParts = new Set<string>(["xl/calcChain.xml"]);
  const wbDoc = parseXml(partText(archive.parts, "xl/workbook.xml"));
  const wb = object(wbDoc.workbook);
  const sourceInfos = new Map(list(object(wb.sheets).sheet).map(item => [text(object(item)["@name"]),object(item)]));
  const wbRels = parseXml(partText(archive.parts, "xl/_rels/workbook.xml.rels"));
  const relationships = object(wbRels.Relationships);
  const oldRelations = list(relationships.Relationship).map(object);
  const usedIds = new Set(oldRelations.map(rel => text(rel["@Id"])));
  const usedPaths = new Set<string>();
  let partIndex = 0;
  const plans = report.sheets.map((sheet,index) => {
    const sourceId = sheet.sourceSheetId ?? sheet.name;
    const sourcePath = archive.sheetPaths[sourceId];
    if (!sourcePath) throw new Error(`No source worksheet for ${sheet.name} (source ${sourceId})`);
    let path = sourcePath;
    if (usedPaths.has(path)) do { path = `xl/worksheets/reportSheet${++partIndex}.xml`; } while (archive.parts.has(path) || usedPaths.has(path));
    usedPaths.add(path);
    let relationId = `rIdReportSheet${index+1}`;
    while (usedIds.has(relationId)) relationId += "_";
    usedIds.add(relationId);
    return { sheet,sourceId,sourcePath,path,relationId,index };
  });
  const tablePaths=new Set<string>(),tableNames=new Set<string>(),addedTypes=new Map<string,string>();
  let tableIndex=0,tableId=0;
  const allocated=new Set(archive.parts.keys()),mediaSequence={drawing:0,image:0,chart:0};
  const allocateMedia=(kind:"drawing"|"image"|"chart",extension:string):string=>{
    const folders={drawing:"drawings",image:"media",chart:"charts"};
    let path:string;do{path=`xl/${folders[kind]}/report${kind[0].toUpperCase()+kind.slice(1)}${++mediaSequence[kind]}.${extension}`;}while(allocated.has(path));allocated.add(path);return path;
  };
  for(const path of archive.parts.keys())if(/^xl\/tables\/[^/]+\.xml$/.test(path)){removeParts.add(path);removeParts.add(relPathFor(path));}
  for (const rel of oldRelations.filter(rel => text(rel["@Type"]).endsWith("/worksheet"))) {
    const path = resolvePart("xl/workbook.xml",text(rel["@Target"]));
    if (!usedPaths.has(path)) { removeParts.add(path); removeParts.add(relPathFor(path)); }
  }
  for (const { sheet,sourceId,sourcePath,path } of plans) {
    const document = parseXml(partText(archive.parts, sourcePath));
    const worksheet = object(document.worksheet);
    const dimensions = archive.dimensions[sourceId];
    const dynamic = sheet.rowOrigins.length !== dimensions.rows || sheet.colOrigins.length !== dimensions.cols
      || sheet.rowOrigins.some((row, i) => row !== i) || sheet.colOrigins.some((col, i) => col !== i);
    const originalRows = list(object(worksheet.sheetData).row).map(object);
    const sourceCells = new Map<string, XmlNode>();
    for (const row of originalRows) for (const raw of list(row.c)) sourceCells.set(text(object(raw)["@r"]), object(raw));
    const sourceRowMap = new Map(originalRows.map((row) => [Number(row["@r"]) - 1, row]));
    if (dynamic) for (const feature of ["extLst"]) {
      if (worksheet[feature] !== undefined) throw new Error(`${sheet.name}: ${path}/${feature} requires a relocation adapter`);
    }
    projectWorksheetMetadata(worksheet,sheet,projection);
    const outputRows: XmlNode[] = sheet.rowOrigins.map((origin, row) => {
      const old = sourceRowMap.get(origin) ?? {};
      const attrs = Object.fromEntries(Object.entries(old).filter(([key]) => key.startsWith("@") && key !== "@spans"));
      delete attrs["@hidden"];
      if(sheet.rowStyles?.[row]){attrs["@s"]=String(sheet.rowStyles[row].styleId);attrs["@customFormat"]="1";}
      if(sheet.hiddenRows?.[row])attrs["@hidden"]="1";
      return { ...attrs, "@r": String(row + 1), c: [] };
    });
    for (const cell of [...sheet.cells].sort((a, b) => a.row - b.row || a.col - b.col)) {
      const ref = XLSX.utils.encode_cell({ r: cell.row, c: cell.col });
      const source = sourceCells.get(cell.origin);
      let output: XmlNode = { "@r": ref, ...(cell.styleId !== undefined ? { "@s": String(cell.styleId) } : {}) };
      const explicitExport=Object.prototype.hasOwnProperty.call(cell,"exportValue");
      const value=explicitExport?cell.exportValue:cell.value;
      if (cell.formula&&!explicitExport) output.f = cell.arrayFormulaRange ? {"@t":"array","@ref":a1(cell.arrayFormulaRange),"#text":cell.formula} : cell.formula;
      if (value !== null && value !== undefined) {
        if (typeof value === "number" || value instanceof Date) {
          const n = value instanceof Date ? value.getTime() / 86400000 + 25569 : value;
          if (!Number.isFinite(n)) {
            if (cell.formulaStatus !== "calculated") throw new Error(`${sheet.name}!${ref}: non-finite cell value`);
            output["@t"] = "e"; output.v = Number.isNaN(n) ? "#NUM!" : "#DIV/0!";
          } else output.v = String(n);
        } else if (typeof value === "boolean") { output["@t"] = "b"; output.v = value ? "1" : "0"; }
        else if (typeof value === "string"||typeof value==="bigint") {
          if (output.f) { output["@t"] = "str"; output.v = String(value); }
          else { output["@t"] = "inlineStr"; output.is = { t: { "@xml:space": "preserve", "#text": String(value) } }; }
        } else throw new Error(`${sheet.name}!${ref}: report value must be a scalar`);
      }
      // Keep untouched rich strings and shared-string references verbatim in structure.
      if (source && !cell.formula && !explicitExport && ["s","inlineStr"].includes(text(source["@t"])) && originalWorkbook.Sheets[sourceId]?.[cell.origin]?.v === value) {
        output = { ...structuredClone(source), "@r": ref };
        if(cell.styleId!==undefined)output["@s"]=String(cell.styleId);
      }
      (outputRows[cell.row].c as XmlNode[]).push(output);
    }
    worksheet.sheetData = { row: outputRows };
    worksheet.dimension = { "@ref": sheet.rowCount && sheet.colCount ? `A1:${XLSX.utils.encode_cell({ r: sheet.rowCount - 1, c: sheet.colCount - 1 })}` : "A1" };
    delete worksheet.mergeCells;
    if (sheet.merges.length) worksheet.mergeCells = { "@count": String(sheet.merges.length), mergeCell: sheet.merges.map((m) => ({ "@ref": XLSX.utils.encode_range({ s: { r: m.start.row, c: m.start.col }, e: { r: m.end.row, c: m.end.col } }) })) };
    if (worksheet.cols||Object.keys(sheet.hiddenCols??{}).length||Object.keys(sheet.colStyles??{}).length) {
      const originals = list(object(worksheet.cols).col).map(object);
      worksheet.cols = { col: sheet.colOrigins.map((origin, col) => {
        const old = originals.find((c) => Number(c["@min"]) <= origin + 1 && Number(c["@max"]) >= origin + 1) ?? {};
        const entry:XmlNode={ ...old, "@min": String(col + 1), "@max": String(col + 1) };
        if(sheet.colStyles?.[col])entry["@style"]=String(sheet.colStyles[col].styleId);
        delete entry["@hidden"];
        if(sheet.hiddenCols?.[col])entry["@hidden"]="1";
        return entry;
      }) };
    }
    const relPath = relPathFor(path), sourceRelPath = relPathFor(sourcePath);
    {
      const doc = archive.parts.has(sourceRelPath) ? parseXml(partText(archive.parts, sourceRelPath)) : {Relationships:{"@xmlns":"http://schemas.openxmlformats.org/package/2006/relationships"}};
      const relationships = object(doc.Relationships);
      const rels = list(relationships.Relationship).map(object);
      const tableRenames=new Map<string,string>();
      for(const relation of rels.filter(rel=>text(rel["@Type"]).endsWith("/table"))){
        const sourceTablePath=resolvePart(sourcePath,text(relation["@Target"]));
        let tablePath=sourceTablePath;
        while(tablePaths.has(tablePath)){tablePath=`xl/tables/reportTable${++tableIndex}.xml`;if(archive.parts.has(tablePath))tablePaths.add(tablePath);}
        tablePaths.add(tablePath);removeParts.delete(tablePath);
        const tableDoc=parseXml(partText(archive.parts,sourceTablePath)),table=object(tableDoc.table),oldName=text(table["@displayName"]??table["@name"]);
        let name=oldName||"ReportTable",suffix=1;while(tableNames.has(name.toLowerCase()))name=`${oldName||"ReportTable"}_${++suffix}`;
        tableNames.add(name.toLowerCase());tableRenames.set(oldName,name);
        projectTable(table,sheet,projection,++tableId,name);
        relation["@Target"]=relativePart(path,tablePath);
        write(tablePath,tableDoc);addedTypes.set(tablePath,"application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml");
        const sourceTableRels=relPathFor(sourceTablePath);
        if(archive.parts.has(sourceTableRels)){
          const tableRelDoc=parseXml(partText(archive.parts,sourceTableRels));
          for(const raw of list(object(tableRelDoc.Relationships).Relationship)){
            const rel=object(raw);if(rel["@TargetMode"]!=="External")rel["@Target"]=relativePart(tablePath,resolvePart(sourceTablePath,text(rel["@Target"])));
          }
          const tableRels=relPathFor(tablePath);removeParts.delete(tableRels);write(tableRels,tableRelDoc);
        }
      }
      for(const row of outputRows)for(const raw of list(row.c)){
        const cell=object(raw);if(cell.f===undefined)continue;
        if(typeof cell.f==="string")cell.f=renameStructuredReferences(cell.f,tableRenames);
        else object(cell.f)["#text"]=renameStructuredReferences(text(cell.f),tableRenames);
      }
      const comments = rels.filter((rel) => /\/(comments|vmlDrawing)$/.test(text(rel["@Type"])));
      if (comments.length) {
        for (const rel of comments) removeParts.add(resolvePart(sourcePath, text(rel["@Target"])));
        relationships.Relationship = rels.filter((rel) => !comments.includes(rel));
        delete worksheet.legacyDrawing;
      }
      relationships.Relationship=list(relationships.Relationship).filter(raw=>!text(object(raw)["@Type"]).endsWith("/hyperlink"));
      const ids=new Set(list(relationships.Relationship).map(raw=>text(object(raw)["@Id"])));
      const links:XmlNode[]=[];
      for(const cell of sheet.cells){
        const target=safeReportLink(cell.linkUrl);if(!target)continue;
        const link:XmlNode={"@ref":XLSX.utils.encode_cell({r:cell.row,c:cell.col})};
        if(target.startsWith("#"))link["@location"]=target.slice(1);
        else{
          let id=`rIdReportLink${links.length+1}`;while(ids.has(id))id+="_";ids.add(id);
          link["@r:id"]=id;
          (relationships.Relationship as XmlNode[]).push({"@Id":id,"@Type":"http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink","@Target":target,"@TargetMode":"External"});
        }
        links.push(link);
      }
      delete worksheet.hyperlinks;
      if(links.length)worksheet.hyperlinks={hyperlink:links};
      const outputRelationships=list(relationships.Relationship).map(object);
      writeSheetDrawings({parts:archive.parts,sourceSheetPath:sourcePath,sheetPath:path,worksheet,sheet,relationships:outputRelationships,allocate:allocateMedia,write,
        writeBytes(name,bytes){XLSX.CFB.utils.cfb_add(cfb,`/${name}`,Buffer.from(bytes));},contentType(name,type){addedTypes.set(name,type);},removePart(name){removeParts.add(name);}});
      relationships.Relationship=outputRelationships;
      write(relPath, doc);
    }
    // OOXML child order is significant, even though many readers tolerate violations.
    const order = ["sheetPr", "dimension", "sheetViews", "sheetFormatPr", "cols", "sheetData", "sheetCalcPr", "sheetProtection", "protectedRanges", "scenarios", "autoFilter", "sortState", "dataConsolidate", "customSheetViews", "mergeCells", "phoneticPr", "conditionalFormatting", "dataValidations", "hyperlinks", "printOptions", "pageMargins", "pageSetup", "headerFooter", "rowBreaks", "colBreaks", "customProperties", "cellWatches", "ignoredErrors", "smartTags", "drawing", "legacyDrawing", "legacyDrawingHF", "picture", "oleObjects", "controls", "webPublishItems", "tableParts", "extLst"];
    document.worksheet = Object.fromEntries(Object.entries(worksheet).sort(([a], [b]) => {
      const rank = (key: string) => key.startsWith("@") ? -1 : order.includes(key) ? order.indexOf(key) : order.length;
      return rank(a) - rank(b);
    }));
    write(path, document);
  }
  projectDefinedNames(wb,plans,[...sourceInfos.keys()],projection);
  wb.sheets = { sheet:plans.map(plan => ({ ...sourceInfos.get(plan.sourceId), "@name":plan.sheet.name,"@sheetId":String(plan.index+1),"@r:id":plan.relationId })) };
  const bookViews = object(wb.bookViews);
  if (bookViews.workbookView) for (const raw of list(bookViews.workbookView)) { const view=object(raw); view["@activeTab"]="0"; view["@firstSheet"]="0"; }
  wb.calcPr = { "@calcMode": "auto", "@fullCalcOnLoad": "1", "@forceFullCalc": "1" };
  write("xl/workbook.xml", wbDoc);
  relationships.Relationship = [
    ...oldRelations.filter(rel => !/\/(?:worksheet|calcChain)$/.test(text(rel["@Type"]))),
    ...plans.map(plan => ({ "@Id":plan.relationId,"@Type":"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet","@Target":plan.path.slice(3) })),
  ];
  write("xl/_rels/workbook.xml.rels", wbRels);
  const types = parseXml(partText(archive.parts, "[Content_Types].xml"));
  const typeRoot = object(types.Types);
  typeRoot.Override = list(typeRoot.Override).filter((entry) => !removeParts.has(text(object(entry)["@PartName"]).replace(/^\//, "")));
  const knownTypes = new Set(list(typeRoot.Override).map(entry => text(object(entry)["@PartName"])));
  for (const plan of plans) if (!knownTypes.has(`/${plan.path}`)) (typeRoot.Override as XmlNode[]).push({ "@PartName":`/${plan.path}`,"@ContentType":"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" });
  for(const [path,contentType]of addedTypes)if(!knownTypes.has(`/${path}`))(typeRoot.Override as XmlNode[]).push({"@PartName":`/${path}`,"@ContentType":contentType});
  write("[Content_Types].xml", types);
  for (const part of removeParts) if (archive.parts.has(part)) XLSX.CFB.utils.cfb_del(cfb, `/${part}`);
  return new Uint8Array(XLSX.CFB.write(cfb, { type: "buffer", fileType: "zip", compression: true }) as Uint8Array);
}
