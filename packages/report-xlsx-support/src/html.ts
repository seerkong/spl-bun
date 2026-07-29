import * as XLSX from "xlsx";
import type { RenderedReport } from "depa-data-report-contract";
import { safeReportLink } from "./links";
import { validateImage } from "./drawings";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function formatReportValue(value:unknown,numberFormat:string):string{
  if(value==null)return "";
  if(typeof value==="number"&&!Number.isFinite(value))return Number.isNaN(value)?"#NUM!":"#DIV/0!";
  try{
    const numeric=value instanceof Date?value.getTime()/86400000+25569:value;
    return XLSX.SSF.format(numberFormat,numeric);
  }catch{return String(value);}
}

export function reportToHtml(report: RenderedReport): string {
  const tables = report.sheets.map((sheet) => {
    const images=new Map<string,string[]>();
    for(const image of sheet.images??[]){
      validateImage(image.data,`${sheet.name} image ${image.name??image.id}`);
      let width=image.anchor.widthEMU===undefined?100:image.anchor.widthEMU/9525,height=image.anchor.heightEMU===undefined?100:image.anchor.heightEMU/9525;
      if(image.anchor.to){
        width=((image.anchor.to.colOffsetEMU??0)-(image.anchor.from.colOffsetEMU??0))/9525;
        height=((image.anchor.to.rowOffsetEMU??0)-(image.anchor.from.rowOffsetEMU??0))/9525;
        for(let col=image.anchor.from.col;col<image.anchor.to.col;col++)width+=(sheet.colWidths?.[col]??8.43)*7+5;
        for(let row=image.anchor.from.row;row<image.anchor.to.row;row++)height+=(sheet.rowHeights?.[row]??15)*4/3;
      }
      const key=`${image.anchor.from.row},${image.anchor.from.col}`,values=images.get(key)??[];
      values.push(`<img alt="${escapeHtml(image.name??image.description??"")}" src="data:${image.data.mimeType};base64,${Buffer.from(image.data.bytes).toString("base64")}" width="${Math.max(1,Math.round(width))}" height="${Math.max(1,Math.round(height))}">`);images.set(key,values);
    }
    const cells = new Map(sheet.cells.map((cell) => [`${cell.row},${cell.col}`, cell]));
    const covered = new Set<string>();
    const spans = new Map<string, string>();
    for (const merge of sheet.merges) {
      spans.set(`${merge.start.row},${merge.start.col}`, ` rowspan="${merge.end.row - merge.start.row + 1}" colspan="${merge.end.col - merge.start.col + 1}"`);
      for (let r = merge.start.row; r <= merge.end.row; r++) for (let c = merge.start.col; c <= merge.end.col; c++) if (r !== merge.start.row || c !== merge.start.col) covered.add(`${r},${c}`);
    }
    const cols = sheet.colOrigins.map((source, col) => `<col${sheet.colWidths?.[col] ? ` style="width:${Math.min(1000, sheet.colWidths[col] * 7 + 5)}px"` : ""}>`).join("");
    const rows = sheet.rowOrigins.map((_, row) => {
      const td = sheet.colOrigins.map((_, col) => {
        const key = `${row},${col}`;
        if (covered.has(key)) return "";
        const cell = cells.get(key);
        let value = cell?.value;
        if (cell?.formula && cell.formulaStatus !== "calculated") value = `=${cell.formula} (Excel 重新计算${cell.formulaDiagnostic ? `: ${cell.formulaDiagnostic}` : ""})`;
        else if(cell&&Object.prototype.hasOwnProperty.call(cell,"displayValue"))value=cell.displayValue;
        else if (typeof value === "number" && !Number.isFinite(value)) value = Number.isNaN(value) ? "#NUM!" : "#DIV/0!";
        else if (cell?.numberFormat && typeof value === "number") {
          try { value = XLSX.SSF.format(cell.numberFormat, value); } catch { /* raw value remains authoritative */ }
        }
        const css = Object.entries(cell?.css ?? sheet.rowStyles?.[row]?.css ?? sheet.colStyles?.[col]?.css ?? {}).map(([k, v]) => `${k}:${v}`).join(";");
        let content=escapeHtml(value);
        if(cell?.richText&&(!Object.prototype.hasOwnProperty.call(cell,"displayValue")||cell.displayValue===cell.value))content=cell.richText.map(run=>{
          const style=Object.entries(run.css??{}).map(([key,value])=>`${key}:${value}`).join(";");
          return `<span${style?` style="${escapeHtml(style)}"`:""}>${escapeHtml(run.text)}</span>`;
        }).join("");
        const link=safeReportLink(cell?.linkUrl);
        if(link){
          const location=link.slice(1),qualified=location.includes("!")?location:`'${sheet.name.replace(/'/g,"''")}'!${location}`;
          const href=link.startsWith("#")?`#${encodeURIComponent(qualified)}`:link;
          content=`<a href="${escapeHtml(href)}" rel="noopener noreferrer">${content}</a>`;
        }
        const name=`'${sheet.name.replace(/'/g,"''")}'!${XLSX.utils.encode_cell({r:row,c:col})}`;
        return `<td id="${escapeHtml(encodeURIComponent(name))}"${sheet.hiddenCols?.[col]?" hidden":""}${spans.get(key) ?? ""}${css ? ` style="${escapeHtml(css)}"` : ""}>${content}${(images.get(key)??[]).join("")}</td>`;
      }).join("");
      const height = sheet.rowHeights?.[row];
      return `<tr${sheet.hiddenRows?.[row]?" hidden":""}${height ? ` style="height:${Math.min(1000, height)}pt"` : ""}>${td}</tr>`;
    }).join("");
    const charts=(sheet.charts??[]).map(chart=>{
      const title=chart.references.find(reference=>reference.kind==="title"),caption=title?.text??title?.values?.[0]??chart.name??"Chart";
      const series=chart.references.filter(reference=>reference.kind==="seriesData"&&!chart.hiddenSeries?.includes(reference.seriesIndex??-1));
      const body=series.flatMap(reference=>{
        const category=chart.references.find(other=>other.kind==="seriesCategory"&&other.seriesIndex===reference.seriesIndex),name=chart.references.find(other=>other.kind==="seriesName"&&other.seriesIndex===reference.seriesIndex);
        return(reference.values??[]).map((value,index)=>`<tr><td>${escapeHtml(name?.text??name?.values?.[0]??"")}</td><td>${escapeHtml(category?.values?.[index])}</td><td>${escapeHtml(value)}</td></tr>`);
      }).join("");
      return `<figure><figcaption>${escapeHtml(caption)}</figcaption><table><tbody>${body}</tbody></table></figure>`;
    }).join("");
    return `<section><h2>${escapeHtml(sheet.name)}</h2><table><colgroup>${cols}</colgroup><tbody>${rows}</tbody></table>${charts}</section>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font:14px system-ui;margin:20px;color:#172033}table{border-collapse:collapse;table-layout:fixed}td{min-width:50px;padding:5px;white-space:pre-wrap;border:1px solid #ddd}h2{font-size:16px}section{margin-bottom:28px}@media print{[hidden]{display:none!important}td{print-color-adjust:exact;-webkit-print-color-adjust:exact}section{break-after:page}section:last-child{break-after:auto}}</style></head><body>${tables}</body></html>`;
}
