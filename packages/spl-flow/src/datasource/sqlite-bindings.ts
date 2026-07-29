import type { SQLQueryBindings } from "bun:sqlite";

// Bun's sqlite binding types are strict. We accept unknowns from callers and
// coerce/validate into the supported binding shapes.

export type SqliteBindingValue = string | bigint | NodeJS.TypedArray | number | boolean | null;
export type SqliteNamedBindings = Record<string, SqliteBindingValue>;

function isTypedArray(value: unknown): value is NodeJS.TypedArray {
  return ArrayBuffer.isView(value) && !(value instanceof DataView);
}

export function coerceSqliteBindingValue(value: unknown): SqliteBindingValue {
  // sqlite does not support undefined; treat it as NULL.
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint") return value;
  if (isTypedArray(value)) return value;

  throw new Error(`Unsupported SQL binding value: ${Object.prototype.toString.call(value)}`);
}

export function coerceSqliteBinding(value: unknown): SQLQueryBindings {
  // Named bindings: { $id: 1 } style.
  if (typeof value === "object" && value !== null && !Array.isArray(value) && !isTypedArray(value)) {
    const record = value as Record<string, unknown>;
    const out: SqliteNamedBindings = {};
    for (const [key, v] of Object.entries(record)) {
      out[key] = coerceSqliteBindingValue(v);
    }
    return out;
  }

  return coerceSqliteBindingValue(value);
}

export function normalizeSqliteParams(params?: readonly unknown[]): SQLQueryBindings[] | undefined {
  if (!params || params.length === 0) return undefined;
  return params.map(coerceSqliteBinding);
}
