import { isDecimal } from "./scalar";
export const TYPE_DB = 1;
export const TYPE_FILE = 2;
export const TYPE_SEQUENCE = 3;
export const TYPE_TABLE = 4;
export const TYPE_CURSOR = 5;
export const TYPE_OTHER = 101;
export const TYPE_UNKNOWN = 102;

export type ExpressionValueType =
  | typeof TYPE_DB
  | typeof TYPE_FILE
  | typeof TYPE_SEQUENCE
  | typeof TYPE_TABLE
  | typeof TYPE_CURSOR
  | typeof TYPE_OTHER
  | typeof TYPE_UNKNOWN;

export interface TypedValue {
  value: unknown;
  type: ExpressionValueType;
}

export interface TypedWrapper {
  value: unknown;
  __type: ExpressionValueType;
}

export interface DbHandle extends TypedWrapper {
  __type: typeof TYPE_DB;
}

export interface FileHandle extends TypedWrapper {
  __type: typeof TYPE_FILE;
}

export interface CursorHandle extends TypedWrapper {
  __type: typeof TYPE_CURSOR;
}

export function makeTyped(value: unknown, type: ExpressionValueType = TYPE_OTHER): TypedValue {
  return { value, type };
}

export function makeDbHandle(value: unknown): DbHandle {
  return { value, __type: TYPE_DB };
}

export function makeFileHandle(value: unknown): FileHandle {
  return { value, __type: TYPE_FILE };
}

export function makeCursorHandle(value: unknown): CursorHandle {
  return { value, __type: TYPE_CURSOR };
}

export function getValueType(value: unknown): ExpressionValueType {
  if (value == null) return TYPE_OTHER;
  if (isDecimal(value)) return TYPE_OTHER;
  if (isTypedWrapper(value)) return value.__type;
  if (Array.isArray(value)) return TYPE_SEQUENCE;
  if (typeof value === "object") return TYPE_TABLE;
  return TYPE_OTHER;
}

function isTypedWrapper(value: unknown): value is TypedWrapper {
  return typeof value === "object" && value !== null && "__type" in (value as Record<string, unknown>);
}
