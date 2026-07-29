// ============================================================================
// API Routes
// ============================================================================

export const apiRoutes = {
  executeKon: "/api/execute-kon",
  health: "/api/health",
  importTable: "/api/import-table",
  renderReport: "/api/render-report",
  reportTemplate: "/api/report-template",
} as const;

/**
 * Query result data with columns and rows
 */
export interface QueryResultData {
  columns: string[];
  rows: Record<string, unknown>[];
}

// ============================================================================
// Execute Kon API Types (/api/execute-kon)
// ============================================================================

/**
 * Request payload for /api/execute-kon: a Kon script plus optional
 * initial scope for spl_eval.
 */
export interface KonExecuteRequest {
  source: string;
  scope?: Record<string, unknown>;
  tables?: Record<string, QueryResultData>;
}

export interface TableImportResponse {
  status: "ok" | "error";
  data?: QueryResultData;
  sheetNames?: string[];
  selectedSheet?: string;
  error?: string;
}

export interface ReportRenderResponse {
  status: "ok" | "error";
  html?: string;
  xlsxBase64?: string;
  sheets?: Array<{ name: string; rows: number; columns: number }>;
  error?: string;
}

/**
 * Response payload for /api/execute-kon.
 * - data: present when the script's final value normalizes to a table
 *   (toQueryResult semantics).
 * - result: the raw final value when it is not tabular.
 */
export type KonExecuteResponse =
  | { status: "ok"; data?: QueryResultData; result?: unknown }
  | { status: "error"; error: string };
