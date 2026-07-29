/**
 * SPL IDE Backend Server
 *
 * This server:
 * 1. Initializes a demo SQLite database
 * 2. Handles DSL expression execution from frontend
 * 3. Returns query results with column headers
 */
import { Elysia } from "elysia";
import cors from "@elysiajs/cors";
import { Database } from "bun:sqlite";
import { readFileSync, existsSync, mkdirSync, rmSync } from "fs";
import { join, dirname, isAbsolute, resolve as resolvePath } from "path";
import { fileURLToPath } from "url";
import {
  apiRoutes,
  type KonExecuteRequest,
  type KonExecuteResponse,
} from "depa-data-web-shared";

import type { SplDataSourceConfig } from "depa-data-kon-spl-dsl";
import type { TableImportResponse, ReportRenderResponse } from "depa-data-web-shared";
import { createExecutionRuntime, runIsolated, validateTables, validateReportData } from "./execution";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_WORKSPACE_ROOT = join(__dirname, "..");
const DEFAULT_DB_PATH = join(__dirname, "../data/demo.db");
const DEFAULT_INIT_SQL_PATH = join(__dirname, "../data/demo-init.sql");
const DEFAULT_EXTENSION_SQL_PATH = join(__dirname, "../data/demo-extension.sql");

const SALES_CSV_PATH = join(__dirname, "../data/sales.csv");
const PRODUCTS_CSV_PATH = join(__dirname, "../data/products.csv");
const CONFIG_JSON_PATH = join(__dirname, "../data/config.json");
const USERS_JSON_PATH = join(__dirname, "../data/users.json");

function parseEnvBool(value: string | undefined): boolean {
  if (!value) return false;
  return value === "1" || value.toLowerCase() === "true";
}

function resolveMaybeRelativePath(input: string): string {
  // Used for resolving workspaceRoot only.
  return isAbsolute(input) ? input : resolvePath(process.cwd(), input);
}

function removeSqliteDbFiles(dbPath: string) {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const p = `${dbPath}${suffix}`;
    if (!existsSync(p)) continue;
    try {
      rmSync(p, { force: true });
    } catch {
      // Best effort cleanup; startup will fail later if the file is truly locked.
    }
  }
}

type InitDatabaseOptions = {
  dbPath: string;
  initSqlPath: string;
  extensionSqlPath: string;
  resetDb: boolean;
};

/**
 * Initialize the demo SQLite database.
 *
 * - Base schema/data comes from demo-init.sql.
 * - Web-IDE extension tables come from demo-extension.sql (idempotent).
 */
function initDatabase(opts: InitDatabaseOptions): Database {
  const dbPath = opts.dbPath;
  const initSqlPath = opts.initSqlPath;
  const extensionSqlPath = opts.extensionSqlPath;

  const isMemoryDb = dbPath === ":memory:";

  if (!isMemoryDb) {
    const dataDir = dirname(dbPath);
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
  }

  if (opts.resetDb && !isMemoryDb) {
    removeSqliteDbFiles(dbPath);
  }

  const dbExists = !isMemoryDb && existsSync(dbPath);
  const db = new Database(dbPath);

  if (dbExists && !opts.resetDb) {
    console.log(`[Server] Using existing demo.db at ${dbPath}`);
  } else {
    console.log(`[Server] Created new demo.db at ${dbPath}`);
    if (existsSync(initSqlPath)) {
      const initSql = readFileSync(initSqlPath, "utf-8");
      db.exec(initSql);
      console.log("[Server] Initialized database from demo-init.sql");
    } else {
      console.warn("[Server] Warning: demo-init.sql not found. Run 'bun run convert-demo' to generate it.");
    }
  }

  // Always ensure extension tables are present.
  if (existsSync(extensionSqlPath)) {
    const extensionSql = readFileSync(extensionSqlPath, "utf-8");
    db.exec(extensionSql);
  } else {
    console.warn(`[Server] Warning: demo-extension.sql not found at ${extensionSqlPath}`);
  }

  return db;
}

export type CreateAppOptions = {
  dbPath?: string;
  initSqlPath?: string;
  extensionSqlPath?: string;
  workspaceRoot?: string;
  resetDb?: boolean;
  executionTimeoutMs?: number;
};

export function createApp(options: CreateAppOptions = {}) {
  const workspaceRoot = resolveMaybeRelativePath(options.workspaceRoot ?? process.env.SPL_WORKSPACE_ROOT ?? DEFAULT_WORKSPACE_ROOT);

  const resolveInWorkspace = (input: string) => (isAbsolute(input) ? input : resolvePath(workspaceRoot, input));

  const outDir = join(workspaceRoot, "data", "out");
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const dbPathInput = options.dbPath ?? process.env.SPL_DEMO_DB_PATH ?? DEFAULT_DB_PATH;
  const initSqlPathInput = options.initSqlPath ?? process.env.SPL_DEMO_INIT_SQL_PATH ?? DEFAULT_INIT_SQL_PATH;
  const extensionSqlPathInput = options.extensionSqlPath ?? process.env.SPL_DEMO_EXTENSION_SQL_PATH ?? DEFAULT_EXTENSION_SQL_PATH;
  const resetDb = options.resetDb ?? parseEnvBool(process.env.SPL_DEMO_DB_RESET);

  const dbPath = dbPathInput === ":memory:" ? dbPathInput : resolveInWorkspace(dbPathInput);
  const initSqlPath = resolveInWorkspace(initSqlPathInput);
  const extensionSqlPath = resolveInWorkspace(extensionSqlPathInput);

  const db = initDatabase({ dbPath, initSqlPath, extensionSqlPath, resetDb });

  const dataSourceConfigs: SplDataSourceConfig[] = [
    { type: "sqlite", name: "demo", path: dbPath },
    { type: "csv", name: "sales", path: SALES_CSV_PATH, hasHeader: true },
    { type: "csv", name: "products", path: PRODUCTS_CSV_PATH, hasHeader: true },
    { type: "json", name: "config", path: CONFIG_JSON_PATH },
    { type: "json", name: "users", path: USERS_JSON_PATH },
  ];

  const execution = createExecutionRuntime();
  const executionConfig = { timeoutMs: options.executionTimeoutMs ?? Number(process.env.SPL_EXECUTION_TIMEOUT_MS ?? 10000) };
  const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
  const maxPayload = (value: unknown) => {
    if (Buffer.byteLength(JSON.stringify(value)) > 5 * 1024 * 1024) throw new Error("Execution input exceeds 5 MiB");
  };
  const formBody = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
  const inputFile = (form: Record<string, unknown>, key: string, maxSize: number): File => {
    const file = form[key];
    if (!(file instanceof File)) throw new Error(`Missing file: ${key}`);
    if (file.size > maxSize) throw new Error(`File ${key} exceeds ${maxSize / 1024 / 1024} MiB`);
    return file;
  };

  const app = new Elysia({ serve: { maxRequestBodySize: 16 * 1024 * 1024 } })
    .use(
      cors({
        origin: "*",
      })
    )
    .get(apiRoutes.health, () => ({ status: "ok" }))
    .post(apiRoutes.executeKon, async ({ body, request }): Promise<KonExecuteResponse> => {
      const payload = body as KonExecuteRequest | null | undefined;
      const source = payload?.source;
      if (typeof source !== "string" || source.length === 0) {
        return { status: "error", error: "Missing 'source': expected a non-empty Kon script string" };
      }
      const scope =
        payload?.scope && typeof payload.scope === "object" && !Array.isArray(payload.scope)
          ? (payload.scope as Record<string, unknown>)
          : undefined;

      try {
        maxPayload(payload);
        if (payload?.tables !== undefined) validateTables(payload.tables);
        return await runIsolated<KonExecuteResponse>(execution, { job: { kind: "kon", source,
          config: { workspaceRoot, scope, tables: payload?.tables, dataSources: dataSourceConfigs } }, signal: request.signal }, executionConfig);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { status: "error", error: message };
      }
    })
    .post(apiRoutes.importTable, async ({ body, request, set }): Promise<TableImportResponse> => {
      try {
        const form = formBody(body);
        const file = inputFile(form, "file", 5 * 1024 * 1024);
        return await runIsolated<TableImportResponse>(execution, { job: { kind: "import", filename: file.name,
          bytes: new Uint8Array(await file.arrayBuffer()), sheet: typeof form.sheet === "string" ? form.sheet : undefined }, signal: request.signal }, executionConfig);
      } catch (error) { set.status = 400; return { status: "error", error: errorMessage(error) }; }
    })
    .post(apiRoutes.renderReport, async ({ body, request, set }): Promise<ReportRenderResponse> => {
      try {
        const form = formBody(body);
        const file = inputFile(form, "template", 10 * 1024 * 1024);
        if (form.datasets === undefined) throw new Error("Missing report datasets JSON");
        const data = {
          datasets: typeof form.datasets === "string" ? JSON.parse(form.datasets) : form.datasets,
          params: typeof form.params === "string" ? JSON.parse(form.params) : form.params ?? {},
        };
        maxPayload(data);
        validateReportData(data);
        return await runIsolated<ReportRenderResponse>(execution, { job: { kind: "report", bytes: new Uint8Array(await file.arrayBuffer()), data }, signal: request.signal }, executionConfig);
      } catch (error) { set.status = 422; return { status: "error", error: errorMessage(error) }; }
    })
    .get(apiRoutes.reportTemplate, async ({ query, request, set }) => {
      try {
        const columns: unknown = JSON.parse(query.columns ?? '["name","qty"]');
        if (!Array.isArray(columns) || !columns.every((column) => typeof column === "string")) throw new Error("Template columns must be a JSON array of names");
        const result = await runIsolated<{ base64: string }>(execution, { job: { kind: "example", columns }, signal: request.signal }, executionConfig);
        return new Response(Buffer.from(result.base64, "base64"), { headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="table-report-template.xlsx"',
        } });
      } catch (error) { set.status = 400; return { status: "error", error: errorMessage(error) }; }
    });

  return {
    app,
    db,
    dispose: () => {
      for (const worker of execution.workers) void worker.terminate();
      execution.workers.clear();
      try {
        db.close();
      } catch {
        // Best effort.
      }
    },
  };
}

if (import.meta.main) {
  const { app } = createApp();
  const PORT = Number(process.env.PORT ?? 4176);
  app.listen(PORT);
  console.log(`[Server] SPL IDE backend listening on http://localhost:${PORT}`);
}
