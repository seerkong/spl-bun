import type { CompiledCell, ReportInput, ReportRecord, ReportScope } from "depa-data-report-contract";

export interface ExpansionItem {
  uid: string;
  anchor: string;
  value: unknown;
  dataset?: string;
  ids?: readonly number[];
  records: readonly ReportRecord[];
  index: number;
  empty: boolean;
}
export interface ScopeRuntime {
  input: ReportInput;
  views: Map<string, Map<string, readonly ReportRecord[]>>;
  sheetObject?: Readonly<Record<string, unknown>>;
  sheetInfo?: Readonly<Record<string, unknown>>;
}

export function readField(value: unknown, path: string): unknown {
  if (path.startsWith('["') && path.endsWith('"]')) {
    const key: unknown = JSON.parse(path.slice(1, -1));
    return value && typeof value === "object" && typeof key === "string" ? (value as Record<string, unknown>)[key] : undefined;
  }
  let current = value;
  for (const name of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[name];
  }
  return current;
}

function nearest(items: readonly ExpansionItem[], dataset: string): ExpansionItem | undefined {
  for (let i = items.length - 1; i >= 0; i--) if (items[i].dataset === dataset) return items[i];
  return undefined;
}

export function datasetView(runtime: ScopeRuntime, dataset: string, rows: readonly ExpansionItem[], cols: readonly ExpansionItem[]): readonly ReportRecord[] {
  const source = runtime.input.datasets?.[dataset];
  if (!source) throw new Error(`Unknown report dataset: ${dataset}`);
  const row = nearest(rows, dataset), col = nearest(cols, dataset);
  if (!row && !col) return source;
  let cache = runtime.views.get(dataset);
  if (!cache) { cache = new Map(); runtime.views.set(dataset, cache); }
  // UIDs are internal counters; no user values are serialized into this key.
  const key = `${row?.uid ?? ""}|${col?.uid ?? ""}`;
  const cached = cache.get(key);
  if (cached) return cached;
  let ids = row?.ids ?? col?.ids ?? [];
  if (row && col) {
    const other = new Set(col.ids ?? []);
    ids = ids.filter((id) => other.has(id));
  }
  const records = Object.freeze(ids.map((id) => source[id]));
  cache.set(key, records);
  return records;
}

export function scopeFor(runtime: ScopeRuntime, rows: readonly ExpansionItem[], cols: readonly ExpansionItem[], cell?: CompiledCell): ReportScope {
  const datasets = Object.fromEntries(Object.keys(runtime.input.datasets ?? {}).map((name) => [name, datasetView(runtime, name, rows, cols)]));
  const row = rows[rows.length - 1], col = cols[cols.length - 1];
  const names = Object.keys(datasets);
  const dataset = cell?.config.ds ?? row?.dataset ?? col?.dataset ?? (!row&&!col&&names.length === 1 ? names[0] : undefined);
  const records = dataset ? datasets[dataset] : row?.records ?? col?.records ?? [];
  const own = [...rows, ...cols].find((item) => item.anchor === cell?.address);
  const rowParent = row === own ? rows[rows.length - 2] : row;
  const colParent = col === own ? cols[cols.length - 2] : col;
  const item = rows.length || cols.length
    ? records[0] ?? row?.value ?? col?.value : undefined;
  return {
    ...datasets, ...runtime.input.params, ...runtime.sheetObject, ...(item && typeof item === "object" ? item : {}),
    records, item, datasets, params: runtime.input.params ?? {}, index: own?.index ?? row?.index ?? col?.index ?? 0,
    cell: { ev: own?.value ?? row?.value ?? col?.value, rp: rowParent ? { ev: rowParent.value, index: rowParent.index } : undefined,
      cp: colParent ? { ev: colParent.value, index: colParent.index } : undefined },
    sheet: runtime.sheetInfo,
  };
}

export function immutableInput(input: ReportInput): ReportInput {
  const copy: ReportInput = structuredClone({ datasets: input.datasets ?? {}, params: input.params ?? {} });
  const seen = new WeakSet<object>();
  function freeze(value: unknown): void {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if(ArrayBuffer.isView(value))return;
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  freeze(copy);
  return copy;
}
