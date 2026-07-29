import * as XLSX from "xlsx";

/** A regular editable workbook: data stays external and expressions stay explicit. */
export function createTableReportTemplate(columns: readonly string[], dataset = "result"): Uint8Array {
  if (!columns.length || columns.length > 512 || new Set(columns).size !== columns.length) throw new Error("Expected 1–512 distinct template columns");
  if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(dataset)) throw new Error("Invalid template dataset name");
  const sheet = XLSX.utils.aoa_to_sheet([
    ["${title}"], [...columns], columns.map((column) => `*=${dataset}![${JSON.stringify(column)}]`),
    [`记录数：\${datasets.${dataset}.count()}`],
  ]);
  sheet.A3.c = [{ a: "report", t: `expandType=r\nexpandExpr=${dataset}` }];
  sheet["!cols"] = columns.map(() => ({ wch: 20 }));
  sheet["!rows"] = [{ hpt: 32 }, { hpt: 24 }, { hpt: 22 }, { hpt: 24 }];
  if (columns.length > 1) sheet["!merges"] = [0, 3].map((row) => ({ s: { r: row, c: 0 }, e: { r: row, c: columns.length - 1 } }));
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Report");
  const cfb = XLSX.CFB.read(XLSX.write(book, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
  const styles = `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="20"/><name val="Arial"/><color rgb="FF163D39"/></font><font><b/><sz val="11"/><name val="Arial"/><color rgb="FFFFFFFF"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF187D6F"/></patternFill></fill></fills><borders count="2"><border/><border><bottom style="thin"><color rgb="FFDCE7E4"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1"/></cellXfs></styleSheet>`;
  XLSX.CFB.utils.cfb_add(cfb, "/xl/styles.xml", Buffer.from(styles));
  const entry = XLSX.CFB.find(cfb, "/xl/worksheets/sheet1.xml");
  const xml = Buffer.from(entry.content as Uint8Array).toString().replace(/(<c r="[A-Z]+([123])")(?: s="\d+")?/g,
    (_: string, prefix: string, row: string) => `${prefix} s="${row}"`);
  XLSX.CFB.utils.cfb_add(cfb, "/xl/worksheets/sheet1.xml", Buffer.from(xml));
  return new Uint8Array(XLSX.CFB.write(cfb, { type: "buffer", fileType: "zip", compression: true }) as Uint8Array);
}
