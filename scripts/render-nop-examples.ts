import { copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExecutionRuntime, runIsolated } from "../packages/web-server/src/execution";
import type { ReportRenderResponse } from "../packages/web-shared/src";

const cases = [
  ["05", "跨年财务分析"], ["11", "套打条码与二维码"], ["13", "设备应急预案横向展开"],
  ["14", "设备应急预案纵向展开"], ["15", "医院药房库存矩阵"], ["16", "双数据源销售汇总"],
  ["17", "动态工作表与动态属性列"],
];
const output = await mkdtemp(join(process.argv[2] ?? tmpdir(), "spl-nop-reports-"));
const runtime = createExecutionRuntime();
const rows: string[] = [];
for (const [id, title] of cases) {
  const source = join(import.meta.dir, "../fixtures/nop-report", id);
  const input = join(output, id, "输入"), result = join(output, id, "输出");
  await mkdir(input, {recursive: true});
  await mkdir(result, {recursive: true});
  await copyFile(join(source, "template.xlsx"), join(input, "模板.xlsx"));
  await copyFile(join(source, "data.json"), join(input, "数据.json"));
  const bytes = await readFile(join(input, "模板.xlsx"));
  const data = JSON.parse(await readFile(join(input, "数据.json"), "utf8"));
  const response = await runIsolated<ReportRenderResponse>(runtime, { job: {kind: "report", bytes, data} });
  if (!response.html || !response.xlsxBase64) throw new Error(response.error ?? "Missing report output: " + id);
  await writeFile(join(result, "预览.html"), response.html);
  await writeFile(join(result, "报表.xlsx"), Buffer.from(response.xlsxBase64, "base64"));
  rows.push(`<tr><th>${id} · ${title}</th><td><a href="${id}/输出/预览.html">预览</a></td><td><a href="${id}/输出/报表.xlsx">报表 Excel</a></td><td><a href="${id}/输入/模板.xlsx">模板 Excel</a></td><td><a href="${id}/输入/数据.json">输入数据</a></td></tr>`);
}
await writeFile(join(output, "index.html"), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>nop-report 复杂报表</title><style>body{font:16px/1.6 system-ui;color:#173e40;max-width:920px;margin:40px auto;padding:0 16px}table{border-collapse:collapse}th,td{text-align:left;padding:12px;border-bottom:1px solid #ccd9d8}a{color:#17605d}</style><h1>nop-report 复杂报表</h1><table>${rows.join("")}</table></html>`);
console.log(join(output, "index.html"));
