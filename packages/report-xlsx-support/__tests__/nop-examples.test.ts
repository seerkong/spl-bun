import { expect, test } from "bun:test";
import { compileExpression } from "depa-data-expression";
import { compileReport, renderReport } from "depa-data-report-logic";
import * as XLSX from "xlsx";
import { formatReportValue, readXlsxTemplate, renderBarcode, reportToHtml, writeXlsxReport, xlsxParts } from "../src";

interface TableSnapshot {
  size: [number, number];
  values: Record<string, string>;
  spans: Record<string, [number, number]>;
}

for (const id of ["05", "11", "13", "14", "15", "16", "17"]) {
  test("nop-report demo " + id, async () => {
    const fixture = (file: string) => Bun.file(new URL("../../../fixtures/nop-report/" + id + "/" + file, import.meta.url));
    const bytes = await fixture("template.xlsx").bytes();
    const original = bytes.slice();
    const data = await fixture("data.json").json();
    const expected: TableSnapshot[] = await fixture("expected.json").json();
    const { template, archive } = readXlsxTemplate(bytes);
    const requests: string[][] = [];
    const report = renderReport({
      evaluate: (source, scope) => compileExpression(source).evaluate(scope),
      formatValue: formatReportValue,
      renderBarcode(request) {
        requests.push([request.format, request.content]);
        return renderBarcode(request);
      },
    }, { template: compileReport(template), ...data });
    const output = writeXlsxReport(archive, report);
    const book = XLSX.read(output, {type: "buffer"});
    expect(book.SheetNames).toEqual(id === "17" ? ["苹果", "香蕉"] : report.sheets.map(s => s.name));
    const tables: TableSnapshot[] = [];
    let address = "", value = "";
    await new HTMLRewriter().on("section", {element() {
      const sheet = report.sheets[tables.length];
      tables.push({size: [sheet.rowCount, sheet.colCount], values: {}, spans: {}});
    }}).on("td", {
      element(td) {
        const table = tables[tables.length - 1];
        address = decodeURIComponent(td.getAttribute("id")!).split("!").pop()!;
        value = "";
        const rows = Number(td.getAttribute("rowspan") ?? 1), cols = Number(td.getAttribute("colspan") ?? 1);
        if (rows > 1 || cols > 1) table.spans[address] = [rows, cols];
        td.onEndTag(() => { if (value.trim()) table.values[address] = value.trim(); });
      },
      text(chunk) {value += chunk.text;},
    }).transform(new Response(reportToHtml(report))).text();
    expect(tables).toEqual(expected);
    for (const [i,sheet] of book.SheetNames.entries()) {
      const merges = Object.fromEntries((book.Sheets[sheet]["!merges"] ?? []).map(({s,e}) =>
        [XLSX.utils.encode_cell(s), [e.r - s.r + 1, e.c - s.c + 1]]));
      expect(merges).toEqual(expected[i].spans);
    }
    const first = book.Sheets[book.SheetNames[0]];
    if (id === "05") expect(["D19", "F19", "K19", "L19"].map(k => first[k].v)).toEqual([0.25, 1, 1100, 4100]);
    if (id === "14") expect(["G2", "G3"].map(k => first[k].v)).toEqual(["123", "456"]);
    if (id === "16") expect(["I7", "I12"].map(k => first[k].v)).toEqual(["3870", "3870"]);
    if (id === "11") {
      expect(requests.sort()).toEqual([["CODE_128","123459V"], ["CODE_128","aaaaaaaaaa"], ["QR_CODE","abcdefg"], ["QR_CODE","aaaaaaaaaa"]].sort());
      expect(report.sheets[0].images).toHaveLength(4);
      expect([...xlsxParts(output).keys()].filter(p=>p.startsWith("xl/media/reportImage"))).toHaveLength(4);
    }
    expect(bytes).toEqual(original);
  });
}
