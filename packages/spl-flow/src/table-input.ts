import { parseJsonPreservingNumbers, stringifySplJson } from "depa-data-expression";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

export interface TableData { columns: string[]; rows: Record<string, unknown>[] }
export interface CsvParseOptions { delimiter?: string; hasHeader?: boolean; inferTypes?: boolean }
export interface TableImportOptions {
  sheet?: string;
  maxRows?: number;
  maxColumns?: number;
  maxCells?: number;
}
export interface ImportedTable extends TableData { sheetNames?: string[]; selectedSheet?: string }

export function csvValue(value: string): unknown {
  if (!/^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)) return value;
  const n = Number(value);
  if (!Number.isFinite(n) || Number.isInteger(n) && !Number.isSafeInteger(n)) return value;
  return n;
}

function fromMatrix(matrix: readonly unknown[][], hasHeader: boolean, inferTypes: boolean): TableData {
  if (!matrix.length) return { columns: [], rows: [] };
  const columns = hasHeader
    ? matrix[0].map((v, i) => String(v ?? "").trim() || `col${i + 1}`)
    : matrix[0].map((_, i) => `col${i + 1}`);
  if (new Set(columns).size !== columns.length) throw new Error("Duplicate table column headers");
  const rows = matrix.slice(hasHeader ? 1 : 0).map((record) => {
    if (record.length > columns.length) throw new Error("Table row has more fields than its header");
    return Object.fromEntries(columns.map((column, i) => {
      let value: unknown = record[i] ?? null;
      if (value instanceof Date) value = value.toISOString();
      if (inferTypes && typeof value === "string") value = csvValue(value);
      return [column, value];
    }));
  });
  return { columns, rows };
}

/** One CSV authority for flow, Kon and uploads. Quoted spaces/newlines are data. */
export function parseCsvTable(content: string, options: CsvParseOptions = {}): TableData {
  const matrix = parse(content, { bom: true, delimiter: options.delimiter ?? ",", trim: true,
    skip_empty_lines: true, max_record_size: 1024 * 1024 }) as string[][];
  return fromMatrix(matrix, options.hasHeader !== false, options.inferTypes !== false);
}

export function tableFromRecords(value: unknown): TableData {
  const records = Array.isArray(value) ? value : [value];
  const rows = records.map((record): Record<string, unknown> => {
    if (Array.isArray(record)) throw new Error("JSON table rows must be records, not arrays");
    return record !== null && typeof record === "object" ? record as Record<string, unknown> : { value: record };
  });
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return { columns, rows: rows.map((row) => Object.fromEntries(columns.map((key) => [key, row[key] ?? null]))) };
}

/** Decode uploaded bytes; callers own file IO and request lifecycle. */
export function importTable(bytes: Uint8Array, filename: string, options: TableImportOptions = {}): ImportedTable {
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("Data file exceeds 5 MiB");
  const ext = filename.toLowerCase().split(".").pop();
  let data: ImportedTable;
  if (ext === "csv" || ext === "tsv") {
    data = parseCsvTable(new TextDecoder("utf-8", { fatal: true }).decode(bytes), { delimiter: ext === "tsv" ? "\t" : "," });
  } else if (ext === "json") {
    data = tableFromRecords(parseJsonPreservingNumbers(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  } else if (ext === "xlsx" || ext === "xls") {
    const workbook = XLSX.read(bytes, { type: "array", cellDates: true, sheetRows: (options.maxRows ?? 20000) + 2 });
    const selectedSheet = options.sheet || workbook.SheetNames[0];
    if (!selectedSheet || !workbook.SheetNames.includes(selectedSheet)) throw new Error(`Unknown Excel sheet: ${selectedSheet}`);
    const sheet = workbook.Sheets[selectedSheet];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null, blankrows: false });
    data = { ...fromMatrix(matrix, true, false), sheetNames: workbook.SheetNames, selectedSheet };
  } else throw new Error("Expected a CSV, TSV, JSON, XLSX or XLS data file");
  if (data.rows.length > (options.maxRows ?? 20000) || data.columns.length > (options.maxColumns ?? 512)
    || data.rows.length * data.columns.length > (options.maxCells ?? 100000)) throw new Error("Imported table exceeds row/column/cell limits");
  return data;
}
