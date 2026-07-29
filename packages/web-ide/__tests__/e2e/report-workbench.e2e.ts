import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { runScript } from "./helpers";

test("upload, compute, render, download and invalidate the report", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("table-file").setInputFiles({ name: "orders.csv", mimeType: "text/csv", buffer: Buffer.from('id,name,note,qty\n001,"Alice, A",<b>A</b>,2\n002,Bob,b,3') });
  await expect(page.getByTestId("import-status")).toContainText("2 行");
  await page.locator(".kon-editor").fill('(spl_derive :{in = input cols = {amount = "qty * 10"}})');
  await runScript(page);
  const templateDownload = page.waitForEvent("download");
  await page.getByTestId("download-template").click();
  const template = await templateDownload;
  await page.getByTestId("template-file").setInputFiles({ name: "orders.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: await readFile((await template.path())!) });
  await page.getByTestId("report-params").fill('{"title":"Orders"}');
  await page.getByTestId("render-report").click();
  await expect(page.getByTestId("report-status")).toContainText("渲染完成");
  const frame = page.frameLocator('[data-testid="report-preview"]');
  await expect(frame.getByText("Alice, A", { exact: true })).toBeVisible();
  await expect(frame.getByText("<b>A</b>", { exact: true })).toBeVisible();
  await expect(frame.locator("b")).toHaveCount(0);
  const reportDownload = page.waitForEvent("download");
  await page.getByTestId("download-report").click();
  const output = await reportDownload;
  const sheet = XLSX.read(await readFile((await output.path())!), { type: "buffer" }).Sheets.Report;
  expect(sheet.A3.v).toBe("001"); expect(sheet.E3.v).toBe(20); expect(sheet.E4.v).toBe(30);
  await page.locator(".kon-editor").fill('(spl_select :{in = input})');
  await expect(page.getByTestId("report-preview")).toHaveCount(0);
  await expect(page.getByTestId("download-report")).toHaveCount(0);
  await expect(page.getByTestId("render-report")).toBeDisabled();
});

test("literal dotted columns survive preview and a narrow viewport does not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByTestId("table-file").setInputFiles({ name: "data.json", mimeType: "application/json", buffer: Buffer.from('[{"net.amount":12,"name":"A"}]') });
  await expect(page.getByTestId("import-status")).toContainText("1 行");
  await expect(page.locator(".data-grid tbody td.data-cell").first()).toHaveText("12");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("editing while a request is pending prevents stale results from becoming current", async ({ page }) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let first = true;
  await page.route("**/api/execute-kon", async (route) => {
    if (first) { first = false; await gate; await route.fulfill({ json: { status: "ok", result: 1 } }).catch(() => {}); }
    else await route.fulfill({ json: { status: "ok", result: 2 } });
  });
  await page.goto("/");
  await page.locator(".kon-editor").fill('(spl_eval :{expr = "1"})');
  await page.locator(".run-btn").click();
  await expect.poll(() => first).toBe(false);
  await page.locator(".kon-editor").fill('(spl_eval :{expr = "2"})');
  await runScript(page);
  release();
  await expect(page.locator(".data-grid tbody td.data-cell").first()).toHaveText("2");
});

test("dynamic sheets combine deletion, formula caches, display/export roles and decoded QR images",async({page})=>{
  await page.goto("/");
  await page.getByTestId("table-file").setInputFiles({name:"seed.csv",mimeType:"text/csv",buffer:Buffer.from("qty\n999")});
  await expect(page.getByTestId("import-status")).toContainText("1 行");
  await page.locator(".kon-editor").fill('(spl_select :{in = input where = "true"})');await runScript(page);
  const book=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet([["*=entity.name",null,"QR"],["*=qty","*=qty","*=code"],["END"]]);
  sheet.A2.c=[{a:"report",t:"expandType=r\nexpandExpr=entity.rows\nrowTestExpr=qty>0"}];
  sheet.B1={t:"n",f:"SUM(A2)"};sheet.B2.z="0.00";sheet.B2.c=[{a:"report",t:'formatExpr="￥"+cell.formattedValue\nexportFormattedValue=true'}];
  sheet.C2.c=[{a:"report",t:"processExpr=QRCODE()\nqr:width=128\nqr:height=128"}];sheet["!rows"]=[{},{hpt:96}];sheet["!cols"]=[{wch:12},{wch:14},{wpx:128}];
  XLSX.utils.book_append_sheet(book,sheet,"Data");
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([["构建循环变量","data"],["循环变量名","entity"],["表单名称表达式","entity.name"]]),"Data-XptSheetModel");
  await page.getByTestId("template-file").setInputFiles({name:"dynamic.xlsx",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",buffer:XLSX.write(book,{type:"buffer",bookType:"xlsx"})});
  await page.getByTestId("report-params").fill(JSON.stringify({data:[{name:"苹果",rows:[{qty:0,code:"discard"},{qty:2,code:"a2"},{qty:3,code:"a3"}]},{name:"香蕉",rows:[{qty:7,code:"b7"}]}]}));
  await page.getByTestId("render-report").click();await expect(page.getByTestId("report-status")).toContainText("渲染完成");
  const frame=page.frameLocator('[data-testid="report-preview"]');
  await expect(frame.getByRole("heading",{name:"苹果",exact:true})).toBeVisible();await expect(frame.getByRole("heading",{name:"香蕉",exact:true})).toBeVisible();
  await expect(frame.getByText("￥2.00",{exact:true})).toBeVisible();await expect(frame.getByText("￥7.00",{exact:true})).toBeVisible();
  await expect(frame.locator("img")).toHaveCount(3);
  await expect.poll(()=>frame.locator("img").evaluateAll(images=>images.map(image=>(image as HTMLImageElement).naturalWidth))).toEqual([128,128,128]);
  const pending=page.waitForEvent("download");await page.getByTestId("download-report").click();
  const download=await pending,output=XLSX.read(await readFile((await download.path())!),{type:"buffer"});
  expect(output.SheetNames).toEqual(["苹果","香蕉"]);
  expect([output.Sheets.苹果.A2.v,output.Sheets.苹果.A3.v,output.Sheets.苹果.A4.v]).toEqual([2,3,"END"]);
  expect([output.Sheets.苹果.B1.v,output.Sheets.苹果.B1.f,output.Sheets.苹果.B2.v,output.Sheets.香蕉.B1.v]).toEqual([5,"SUM(A2:A3)","￥2.00",7]);
});
