import type { ReportConfig, SheetConfig } from "depa-data-report-contract";
import * as XLSX from "xlsx";

const fields: Readonly<Record<string,string>> = {
  构建循环变量:"beginLoop", 循环变量名:"loopVarName", 循环索引名:"loopIndexName", 循环集合名:"loopItemsName",
  条件表达式:"testExpr", 表单名称表达式:"sheetNameExpr", sheetVarName:"sheetVarName",
  beginLoop:"beginLoop", loopVarName:"loopVarName", loopIndexName:"loopIndexName", loopItemsName:"loopItemsName",
  testExpr:"testExpr", sheetNameExpr:"sheetNameExpr",
};
const scripts = new Set(["展开前","展开后","后处理脚本","beforeExpand","afterExpand","endLoop"]);

/** Config sheets are declarations, never an instruction to execute Java or XLang. */
export function readSheetConfiguration(workbook: XLSX.WorkBook, name: string, kind: "workbook" | "sheet", styleIds:Readonly<Record<string,number>>={}): SheetConfig & ReportConfig {
  const sheet = workbook.Sheets[name];
  const result: Record<string,unknown> = { location:name };
  if (!sheet) return result;
  for (let row = 1; row <= 1000; row++) {
    const key = String(sheet[`A${row}`]?.v ?? "").trim();
    const value = sheet[`B${row}`]?.v;
    if(key==="命名样式"){
      const headers=Array.from({length:12},(_,col)=>String(sheet[`${XLSX.utils.encode_col(col)}${row+1}`]?.v??""));
      const idColumn=headers.indexOf("样式ID"),styleColumn=headers.indexOf("样式");
      if(idColumn<0||styleColumn<0)throw new Error(`${name}!A${row}: named styles need 样式ID and 样式 headers`);
      const aliases:Record<string,number>={};row+=2;
      while(row<=1000){
        const id=sheet[`${XLSX.utils.encode_col(idColumn)}${row}`]?.v;
        if(id==null||id==="")break;
        aliases[String(id)]=styleIds[`${XLSX.utils.encode_col(styleColumn)}${row}`]??0;row++;
      }
      result.namedStyles=aliases;row--;continue;
    }
    if (!key || value == null || value === "") continue;
    if(["删除隐藏单元","removeHiddenCell","exportFormattedValue"].includes(key)){
      const field=key==="删除隐藏单元"?"removeHiddenCell":key;
      if(value!==true&&value!==false&&!/^(true|false|0|1)$/.test(String(value)))throw new Error(`${name}!B${row}: ${key} must be boolean`);
      result[field]=value===true||value===1||value==="true"||value==="1";continue;
    }
    const field = fields[key];
    if (field) {
      if (kind === "workbook" && (field === "sheetVarName" || field === "sheetNameExpr")) throw new Error(`${name}!B${row}: ${key} is a sheet configuration`);
      if (result[field] !== undefined) throw new Error(`${name}!A${row}: duplicate configuration ${field}`);
      result[field] = String(value).trim();
    } else if (scripts.has(key)) {
      throw new Error(`${name}!B${row}: ${key} initialization script is not executable; compute data with Kon/SPL and pass datasets/params explicitly, then remove this script`);
    } else if (!["dump","名称","name","说明","description","输出调试文件","调试文件输出目录","dumpDir"].includes(key)) {
      throw new Error(`${name}!A${row}: unsupported report configuration ${key}`);
    }
  }
  return result;
}
