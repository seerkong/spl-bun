import { afterAll, describe, expect, test } from "bun:test";
import { createApp } from "../src/server";
import { apiRoutes } from "depa-data-web-shared";
import { readXlsxTemplate } from "depa-data-report-xlsx-support";
import { importTable } from "depa-data-spl-flow";
import * as XLSX from "xlsx";

const server = createApp({ dbPath: ":memory:", executionTimeoutMs: 500 });
afterAll(() => server.dispose());
const request = (path: string, init?: RequestInit) => server.app.handle(new Request(`http://localhost${path}`, init));

describe("table/report HTTP workbench", () => {
  test("report worker provides the explicit barcode port and returns current PNG media",async()=>{
    const workbook=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet([["Code"],["*=code"]]);
    sheet.A2.c=[{a:"report",t:"expandType=r\nexpandExpr=rows\nprocessExpr=QRCODE()\nqr:width=160\nqr:height=160"}];
    XLSX.utils.book_append_sheet(workbook,sheet,"Codes");
    const body=new FormData();body.set("template",new File([XLSX.write(workbook,{type:"buffer",bookType:"xlsx"})],"codes.xlsx"));
    body.set("datasets",JSON.stringify({rows:[{code:"123459V"},{code:"ABC123"},{code:""}]}));
    const response=await request(apiRoutes.renderReport,{method:"POST",body}),result=await response.json();
    expect(response.status,result.error).toBe(200);expect(result.html.match(/<img /g)).toHaveLength(2);
    expect(result.html).toContain("data:image/png;base64,");expect(result.xlsxBase64.length).toBeGreaterThan(1000);
  });
  test("dynamic sheets and report formulas render through the real worker and HTTP contract", async () => {
    const workbook=XLSX.utils.book_new();
    const sheet=XLSX.utils.aoa_to_sheet([["*=entity.name",null],["*=qty",null]]);
    sheet.A2.c=[{a:"report",t:"expandType=r\nexpandExpr=entity.rows"}];
    sheet.B1={t:"n",f:"SUM(A2)"};
    XLSX.utils.book_append_sheet(workbook,sheet,"Data");
    XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([["构建循环变量","data"],["循环变量名","entity"],["表单名称表达式","entity.name"]]),"Data-XptSheetModel");
    const bytes=new Uint8Array(XLSX.write(workbook,{type:"buffer",bookType:"xlsx"}));
    const body=new FormData(); body.set("template",new File([bytes],"dynamic.xlsx")); body.set("datasets","{}");
    body.set("params",JSON.stringify({data:[{name:"苹果",rows:[{qty:2},{qty:3}]},{name:"香蕉",rows:[{qty:7}]}]}));
    const response=await request(apiRoutes.renderReport,{method:"POST",body});
    const result=await response.json(); expect(response.status,result.error).toBe(200);
    expect(result.sheets.map((s:{name:string})=>s.name)).toEqual(["苹果","香蕉"]);
    const output=XLSX.read(Buffer.from(result.xlsxBase64,"base64"),{type:"buffer"});
    expect(output.Sheets.苹果.B1.v).toBe(5); expect(output.Sheets.香蕉.B1.v).toBe(7);
    expect(output.Sheets.苹果.B1.f).toBe("SUM(A2:A3)");
    expect(result.html).toContain("<h2>苹果</h2>"); expect(result.html).toContain(">7</td>");
  });
  test("CSV upload -> named Kon table -> template bytes -> HTML + XLSX download", async () => {
    const form = new FormData();
    form.set("file", new File(['id,name,note,qty\n001,"A,B","two\nlines",2\n002,Bob,b,3'], "orders.csv"));
    const uploaded = await (await request(apiRoutes.importTable, { method: "POST", body: form })).json();
    expect(uploaded).toMatchObject({ status: "ok", data: { columns: ["id", "name", "note", "qty"] } });
    expect(uploaded.data.rows[0]).toMatchObject({ id: "001", name: "A,B", note: "two\nlines", qty: 2 });
    const executed = await (await request(apiRoutes.executeKon, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      source: '(spl_derive :{in = input cols = {amount = "qty * 10"}})', tables: { input: uploaded.data },
    }) })).json();
    expect(executed.data.rows.map((row: { amount: number }) => row.amount)).toEqual([20, 30]);
    const template = new Uint8Array(await (await request(`${apiRoutes.reportTemplate}?columns=${encodeURIComponent(JSON.stringify(executed.data.columns))}`)).arrayBuffer());
    expect(readXlsxTemplate(template).template.sheets[0].name).toBe("Report");
    const render = new FormData(); render.set("template", new File([template], "orders.xlsx"));
    render.set("datasets", JSON.stringify({ result: executed.data.rows })); render.set("params", JSON.stringify({ title: "Orders <2026>" }));
    const response = await request(apiRoutes.renderReport, { method: "POST", body: render });
    const output = await response.json();
    expect(response.status, output.error).toBe(200);
    expect(output.status).toBe("ok"); expect(output.html).toContain("Orders &lt;2026&gt;"); expect(output.html).toContain("A,B");
    const bytes = new Uint8Array(Buffer.from(output.xlsxBase64, "base64"));
    const rows = importTable(bytes, "report.xlsx").rows;
    expect(rows.some((row) => Object.values(row).includes(20))).toBe(true);
    expect(output.sheets[0]).toMatchObject({ name: "Report", rows: 5, columns: 5 });
  });
  test("rejects missing/broken input and does not retain a previous request's dataset", async () => {
    const broken = new FormData(); broken.set("file", new File(['a,b\n"oops,2'], "bad.csv"));
    const response = await request(apiRoutes.importTable, { method: "POST", body: broken });
    expect(response.status).toBe(400); expect((await response.json()).status).toBe("error");
    const report = await request(apiRoutes.renderReport, { method: "POST", body: new FormData() });
    expect(report.status).toBe(422); expect((await report.json()).error).toContain("template");
    const noInput = await (await request(apiRoutes.executeKon, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: '(spl_select :{in = input})' }) })).json();
    expect(noInput.status).toBe("error"); expect(noInput.error).toContain("input");
  });
  test("HTTP loop timeout leaves health and the next computation usable", async () => {
    const loop = await (await request(apiRoutes.executeKon, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: '(spl_flow :{cells = [{row = 1 col = A expr = "goto A1"}]})' }) })).json();
    expect(loop.error).toContain("timed out");
    expect((await request(apiRoutes.health)).status).toBe(200);
    const next = await (await request(apiRoutes.executeKon, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: '(spl_eval :{expr = "42"})' }) })).json();
    expect(next).toMatchObject({ status: "ok", result: 42 });
  });
});
