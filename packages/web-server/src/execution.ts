import { Worker } from "node:worker_threads";
import type { RunSplKonConfig } from "depa-data-kon-spl-dsl";
import type { ReportInput } from "depa-data-report-contract";

export type ExecutionJob =
  | { kind: "kon"; source: string; config: RunSplKonConfig }
  | { kind: "import"; bytes: Uint8Array; filename: string; sheet?: string }
  | { kind: "report"; bytes: Uint8Array; data: ReportInput }
  | { kind: "example"; columns: string[] };

export interface ExecutionRuntime { workers: Set<Worker>; maxWorkers: number }
export interface ExecutionConfig { timeoutMs?: number }
type WorkerMessage = { type: "ready" } | { type: "result"; ok: true; value: unknown } | { type: "result"; ok: false; error: string };

export function createExecutionRuntime(maxWorkers = 4): ExecutionRuntime { return { workers: new Set(), maxWorkers }; }

export function runIsolated<T>(runtime: ExecutionRuntime, input: { job: ExecutionJob; signal?: AbortSignal }, config: ExecutionConfig = {}): Promise<T> {
  const timeoutMs = config.timeoutMs ?? 10000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) return Promise.reject(new Error("Execution timeout must be 1–60000 ms"));
  if (input.signal?.aborted) return Promise.reject(new Error("Execution cancelled"));
  if (runtime.workers.size >= runtime.maxWorkers) return Promise.reject(new Error("Execution capacity reached; retry shortly"));
  const worker = new Worker(new URL(import.meta.url.endsWith(".ts") ? "./execution-worker.ts" : "./execution-worker.js", import.meta.url), { workerData: input.job });
  runtime.workers.add(worker);
  return new Promise<T>((resolve, reject) => {
    let finished = false;
    let timer = setTimeout(() => finish(new Error("Execution worker startup timed out")), 10000);
    function finish(error?: Error, value?: unknown): void {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", cancel);
      worker.removeAllListeners();
      runtime.workers.delete(worker);
      worker.terminate().then(() => error ? reject(error) : resolve(value as T), reject);
    }
    function cancel(): void { finish(new Error("Execution cancelled")); }
    input.signal?.addEventListener("abort", cancel, { once: true });
    worker.on("message", (message: WorkerMessage) => {
      if (message.type === "ready") {
        clearTimeout(timer);
        timer = setTimeout(() => finish(new Error(`Execution timed out after ${timeoutMs} ms`)), timeoutMs);
      } else if (message.ok) finish(undefined, message.value);
      else finish(new Error(message.error));
    });
    worker.once("error", (error: unknown) => finish(error instanceof Error ? error : new Error(String(error))));
    worker.once("exit", (code) => { if (!finished) finish(new Error(`Execution worker exited before its result (${code})`)); });
  });
}

export function validateTables(tables: unknown): asserts tables is NonNullable<RunSplKonConfig["tables"]> {
  if (!tables || typeof tables !== "object" || Array.isArray(tables)) throw new Error("tables must be a map of named tables");
  if (Object.keys(tables).length > 16) throw new Error("Too many input tables");
  let cells = 0;
  for (const [name, value] of Object.entries(tables)) {
    if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(name)) throw new Error(`Invalid table name: ${name}`);
    const table = value as { columns?: unknown; rows?: unknown } | null;
    if (!table || !Array.isArray(table.columns) || !table.columns.every((v) => typeof v === "string") || new Set(table.columns).size !== table.columns.length
      || !Array.isArray(table.rows) || table.rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) throw new Error(`Invalid table: ${name}`);
    cells += table.columns.length * table.rows.length;
    if (table.rows.length > 20000 || table.columns.length > 512 || cells > 100000) throw new Error("Input table row/column/cell limit exceeded");
  }
}

export function validateReportData(data: unknown): asserts data is ReportInput {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Report data must be an object");
  const value = data as ReportInput;
  if (value.params !== undefined && (value.params === null || typeof value.params !== "object" || Array.isArray(value.params))) throw new Error("Report params must be an object");
  if (!value.datasets || typeof value.datasets !== "object" || Array.isArray(value.datasets)) throw new Error("Report datasets must be a map");
  let count = 0;
  if (Object.keys(value.datasets).length > 16) throw new Error("Too many report datasets");
  for (const rows of Object.values(value.datasets)) {
    if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) throw new Error("Report dataset must contain records");
    count += rows.length;
    if (count > 20000) throw new Error("Report dataset row limit exceeded");
  }
}
