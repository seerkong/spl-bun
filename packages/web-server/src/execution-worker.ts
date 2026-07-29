import { parentPort, workerData } from "node:worker_threads";
import { runSplKon, toQueryResult } from "depa-data-kon-spl-dsl";
import { importTable } from "depa-data-spl-flow";
import { compileExpression } from "depa-data-expression";
import { compileReport, renderReport } from "depa-data-report-logic";
import { createTableReportTemplate, readXlsxTemplate, writeXlsxReport, reportToHtml, formatReportValue, renderBarcode } from "depa-data-report-xlsx-support";
import { validateReportData, validateTables, type ExecutionJob } from "./execution";

function execute(job: ExecutionJob): unknown {
  if (job.kind === "kon") {
    if (job.config.tables) validateTables(job.config.tables);
    const { value } = runSplKon(job.source, job.config);
    const data = toQueryResult(value);
    return data ? { status: "ok", data } : { status: "ok", result: value };
  }
  if (job.kind === "import") {
    const { columns, rows, sheetNames, selectedSheet } = importTable(job.bytes, job.filename, { sheet: job.sheet });
    return { status: "ok", data: { columns, rows }, sheetNames, selectedSheet };
  }
  if (job.kind === "example") return { base64: Buffer.from(createTableReportTemplate(job.columns)).toString("base64") };
  validateReportData(job.data);
  const { template, archive } = readXlsxTemplate(job.bytes);
  const expressions = new Map<string, ReturnType<typeof compileExpression>>();
  const rendered = renderReport({ formatValue:formatReportValue,renderBarcode,evaluate(source, scope) {
    let compiled = expressions.get(source);
    if (!compiled) { compiled = compileExpression(source); expressions.set(source, compiled); }
    return compiled.evaluate(scope);
  } }, { template: compileReport(template), ...job.data });
  const xlsx = writeXlsxReport(archive, rendered);
  return { status: "ok", html: reportToHtml(rendered), xlsxBase64: Buffer.from(xlsx).toString("base64"),
    sheets: rendered.sheets.map((sheet) => ({ name: sheet.name, rows: sheet.rowCount, columns: sheet.colCount })) };
}

if (parentPort) {
  parentPort.postMessage({ type: "ready" });
  try {
    const value = execute(workerData as ExecutionJob);
    const json = JSON.stringify(value, (_key, v: unknown) => typeof v === "bigint" ? v.toString() : v);
    if (Buffer.byteLength(json) > 20 * 1024 * 1024) throw new Error("Execution output exceeds 20 MiB");
    parentPort.postMessage({ type: "result", ok: true, value: JSON.parse(json) });
  } catch (error) {
    parentPort.postMessage({ type: "result", ok: false, error: error instanceof Error ? error.message : String(error) });
  }
  parentPort.close();
}
