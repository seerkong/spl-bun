import {splFormat,splString,splNumber} from "./formatting";
import { splParse } from './parse-conversion';
import { asDate, calendarElapse, calendarInterval } from "./calendar";
import { parseJsonPreservingNumbers, stringifySplJson } from "./json";
import { makeDbHandle } from "./types";
import { isNullish, truthy } from "./utils";
import { aggregateValues } from "./aggregation";
import { unionArguments } from "./sequence";
import { decimal, long, parsedNumber } from "./scalar";

export type FunctionRegistry = Record<string, (...args: unknown[]) => unknown>;

function toNumber(value: unknown): number {
  if (isNullish(value)) {
    return NaN;
  }
  if (typeof value === "number") {
    return value;
  }
  const n = Number(value);
  return n;
}

const toDate = asDate;

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function normalizeOffDays(offDays: unknown): { holidays: Set<string>; workdays: Set<string> } {
  const holidays = new Set<string>();
  const workdays = new Set<string>();
  if (!Array.isArray(offDays)) return { holidays, workdays };
  for (const entry of offDays) {
    const d = toDate(entry);
    if (!d) continue;
    const key = localDateKey(d);
    if (isWeekend(d)) {
      workdays.add(key);
    } else {
      holidays.add(key);
    }
  }
  return { holidays, workdays };
}

function isWorkday(date: Date, off: { holidays: Set<string>; workdays: Set<string> }): boolean {
  const key = localDateKey(date);
  if (off.workdays.has(key)) return true;
  if (off.holidays.has(key)) return false;
  return !isWeekend(date);
}

function integerArgs(...args: unknown[]): number[] {
  const out: number[] = [];
  for (const arg of args) {
    if (Array.isArray(arg)) {
      for (const item of arg) {
        const n = toNumber(item);
        if (!Number.isFinite(n)) continue;
        out.push(Math.trunc(n));
      }
      continue;
    }
    const n = toNumber(arg);
    if (!Number.isFinite(n)) continue;
    out.push(Math.trunc(n));
  }
  return out;
}

function gcdInt(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

function lcmInt(a: number, b: number): number {
  const x = Math.trunc(a);
  const y = Math.trunc(b);
  if (x === 0 || y === 0) return 0;
  return Math.abs((x / gcdInt(x, y)) * y);
}

function compileMapper(expr: string): (item: unknown) => unknown {
  const { compileExpression } = require("./evaluator") as typeof import("./evaluator");
  const compiled = compileExpression(expr);
  return (item: unknown) => {
    if (item && typeof item === "object") {
      return compiled.evaluate({ ...(item as Record<string, unknown>) });
    }
    return compiled.evaluate({ _: item });
  };
}

function parseOptions(options: unknown): Set<string> {
  if (typeof options !== "string") return new Set();
  return new Set(options.toLowerCase().split(""));
}

function escapeRegExpChar(value: string): string {
  // Escape characters that have special meaning in JS regex.
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function compileLikePattern(pattern: string, options: Set<string>): RegExp {
  const sql = options.has("s");
  const ignoreCase = options.has("c") && !sql;
  const wildAny = sql ? "%" : "*";
  const wildOne = sql ? "_" : "?";

  let source = "^";
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === "\\") {
      const next = i + 1 < pattern.length ? pattern[i + 1] : "";
      if (next && (next === "*" || next === "?" || next === "%" || next === "_")) {
        source += escapeRegExpChar(next);
        i += 1;
        continue;
      }
      // Only wildcard chars are escapable per spec; treat a bare '\\' as a literal.
      source += "\\\\";
      continue;
    }
    if (ch === wildAny) {
      source += ".*";
      continue;
    }
    if (ch === wildOne) {
      source += ".";
      continue;
    }
    source += escapeRegExpChar(ch);
  }
  source += "$";
  return new RegExp(source, ignoreCase ? "i" : "");
}

const REGEX_OPTIONS = /^[acupw]+$/i;

function isRegexOptionsString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && REGEX_OPTIONS.test(value);
}

const AGE_OPTIONS = /^[ym]+$/i;

function isAgeOptionsString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && AGE_OPTIONS.test(value);
}

function compileRegexPattern(pattern: string, options: Set<string>, global: boolean): RegExp {
  const flags = new Set<string>();
  if (options.has("c")) flags.add("i");
  if (options.has("u")) flags.add("u");
  if (global) flags.add("g");

  const source = options.has("w") ? `^(?:${pattern})$` : pattern;
  return new RegExp(source, Array.from(flags).join(""));
}

function jsonParse(value: unknown, options?: unknown): unknown {
  if (typeof value !== "string") return value;
  const opts = parseOptions(options);
  if (opts.has("v")) {
    const { compileExpression } = require("./evaluator") as typeof import("./evaluator");
    return compileExpression(value).evaluate({});
  }
  try {
    return parseJsonPreservingNumbers(value);
  } catch {
    return null;
  }
}

function jsonStringify(value: unknown): string | null {
  try {
    return stringifySplJson(value) ?? null;
  } catch {
    return null;
  }
}

function jsonCompat(value: unknown, options?: unknown): unknown {
  if (typeof value === "string") {
    return jsonParse(value, options);
  }
  if (Array.isArray(value)) {
    return jsonStringify(value);
  }
  if (value && typeof value === "object") {
    return jsonStringify(value);
  }
  return value;
}

function countValues(...args: unknown[]): number {
  const values = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
  return Number(aggregateValues("count", values));
}

function icountValues(values: unknown[]): number {
  return Number(aggregateValues("icount", values));
}

export const builtins: FunctionRegistry = {
  union:(...args:unknown[])=>unionArguments(args),
  abs: (v: unknown) => Math.abs(toNumber(v)),
  pow: (a: unknown, b: unknown) => Math.pow(toNumber(a), toNumber(b)),
  sqrt: (v: unknown) => Math.sqrt(toNumber(v)),
  sin: (v: unknown) => Math.sin(toNumber(v)),
  cos: (v: unknown) => Math.cos(toNumber(v)),
  tan: (v: unknown) => Math.tan(toNumber(v)),
  exp: (v: unknown) => Math.exp(toNumber(v)),
  log: (v: unknown) => Math.log(toNumber(v)),
  log10: (v: unknown) => Math.log10(toNumber(v)),
  ln: (v: unknown) => Math.log(toNumber(v)),
  ceil: (v: unknown) => Math.ceil(toNumber(v)),
  floor: (v: unknown) => Math.floor(toNumber(v)),
  round: (v: unknown, digits?: unknown) => {
    const val = toNumber(v);
    const d = Number(digits) || 0;
    if (d === 0) return Math.round(val);
    const factor = Math.pow(10, d);
    return Math.round(val * factor) / factor;
  },
  sign: (v: unknown) => {
    if (isNullish(v)) return null;
    const num = toNumber(v);
    if (!Number.isFinite(num)) return null;
    if (num === 0) return 0;
    return num > 0 ? 1 : -1;
  },
  gcd: (...args: unknown[]) => {
    const values = integerArgs(...args);
    if (values.length === 0) return 0;
    if (values.some((v) => v < 0)) return 0;
    let acc = 0;
    for (const v of values) {
      acc = gcdInt(acc, v);
    }
    return acc;
  },
  lcm: (...args: unknown[]) => {
    const values = integerArgs(...args);
    if (values.length === 0) return 0;
    if (values.some((v) => v <= 0)) return 0;
    let acc = 1;
    for (const v of values) {
      acc = lcmInt(acc, v);
    }
    return acc;
  },
  rand: () => Math.random(),
  len: (v: unknown) =>
    typeof v === "string" || Array.isArray(v) ? v.length : v == null ? 0 : String(v).length,
  upper: (v: unknown) => (v == null ? null : String(v).toUpperCase()),
  lower: (v: unknown) => (v == null ? null : String(v).toLowerCase()),
  trim: (v: unknown) => (v == null ? null : String(v).trim()),
  substr: (v: unknown, start: unknown, length?: unknown) => {
    const s = String(v ?? "");
    const st = Number(start) || 0;
    if (length === undefined) return s.substring(st);
    return s.substring(st, st + (Number(length) || 0));
  },
  replace: (str: unknown, search: unknown, replace: unknown) => {
    const s = String(str ?? "");
    const se = String(search ?? "");
    const re = String(replace ?? "");
    return s.split(se).join(re);
  },
  like: (value: unknown, pattern: unknown, options?: unknown) => {
    if (isNullish(value) || isNullish(pattern)) return false;
    const opts = parseOptions(options);
    const re = compileLikePattern(String(pattern), opts);
    return re.test(String(value));
  },
  regex: (str: unknown, pattern: unknown, replacementOrOptions?: unknown, options?: unknown) => {
    if (isNullish(str) || isNullish(pattern)) return null;

    const input = String(str);
    const pat = String(pattern);

    let replacement: unknown = undefined;
    let optionArg: unknown = options;

    if (replacementOrOptions !== undefined) {
      // Disambiguate 3-arg calls: if arg3 looks like options, treat as extraction mode.
      if (options === undefined && isRegexOptionsString(replacementOrOptions)) {
        optionArg = replacementOrOptions;
      } else {
        replacement = replacementOrOptions;
      }
    }

    const opts = parseOptions(optionArg);
    const extractionMode = replacement === undefined;

    if (extractionMode) {
      const re = compileRegexPattern(pat, opts, true);
      const matches = Array.from(input.matchAll(re));
      if (matches.length === 0) return null;

      const groupCount = matches[0].length - 1;
      if (groupCount <= 0) {
        // No capture groups: return the original string on match.
        return input;
      }

      const parseGroups = opts.has("p");
      if (groupCount === 1) {
        const out = matches.map((m) => m[1] ?? "");
        return parseGroups ? out.map((v) => splParse(v)) : out;
      }

      const out = matches.map((m) => {
        const groups: string[] = [];
        for (let i = 1; i <= groupCount; i += 1) {
          groups.push(m[i] ?? "");
        }
        return parseGroups ? groups.map((v) => splParse(v)) : groups;
      });
      return out;
    }

    const replacementText = replacement == null ? "" : String(replacement);
    const replaceAll = opts.has("a");
    const re = compileRegexPattern(pat, opts, replaceAll);
    return input.replace(re, replacementText);
  },
  pos: (str: unknown, sub: unknown) => {
    const s = String(str ?? "");
    const su = String(sub ?? "");
    const idx = s.indexOf(su);
    return idx === -1 ? null : idx + 1;
  },
  split: (str: unknown, sep: unknown) => {
    const s = String(str ?? "");
    const se = String(sep ?? "");
    return se.length > 0 ? s.split(se) : s.split("");
  },
  left: (str: unknown, len: unknown) => {
    const s = String(str ?? "");
    const l = Number(len) || 0;
    return s.substring(0, Math.max(0, Math.min(l, s.length)));
  },
  right: (str: unknown, len: unknown) => {
    const s = String(str ?? "");
    const l = Number(len) || 0;
    return s.substring(Math.max(0, s.length - l));
  },
  mid: (str: unknown, start: unknown, len: unknown) => {
    const s = String(str ?? "");
    const st = Number(start) || 0;
    const l = Number(len) || 0;
    return s.substring(Math.max(0, st - 1), Math.max(0, st - 1 + l));
  },
  concat: (...args: unknown[]) => args.map((v) => (v == null ? "" : String(v))).join(""),
  nvl: (value: unknown, fallback: unknown) => (isNullish(value) ? fallback : value),
  json_parse: (value: unknown, options?: unknown) => jsonParse(value, options),
  json_stringify: (value: unknown) => jsonStringify(value),
  json: (value: unknown, options?: unknown) => jsonCompat(value, options),
  parse: splParse,
  count: (...args: unknown[]) => countValues(...args),
  icount: (value: unknown) => {
    if (!Array.isArray(value)) return truthy(value) ? 1 : 0;
    return icountValues(value);
  },
  now: () => new Date(),
  decimal,
  long,
  date: (str: unknown) => toDate(str),
  dateadd: calendarElapse,
  elapse: (value:unknown,amount:unknown,options?:unknown)=>calendarElapse(value??new Date(),amount,options),
  interval: calendarInterval,
  month: (d: unknown) => {
    const date = toDate(d);
    return date ? date.getMonth() + 1 : null;
  },
  day: (d: unknown) => {
    const date = toDate(d);
    return date ? date.getDate() : null;
  },
  year: (d: unknown) => {
    const date = toDate(d);
    return date ? date.getFullYear() : null;
  },
  hour: (d: unknown) => {
    const date = toDate(d);
    return date ? date.getHours() : null;
  },
  minute: (d: unknown) => {
    const date = toDate(d);
    return date ? date.getMinutes() : null;
  },
  second: (d: unknown) => {
    const date = toDate(d);
    return date ? date.getSeconds() : null;
  },
  datevalue: (d: unknown) => {
    const date = toDate(d);
    if (!date) return null;
    return date.getTime();
  },
  datetime: (year: unknown, month: unknown, day: unknown, hour?: unknown, minute?: unknown, second?: unknown) => {
    const y = Number(year);
    const m = Number(month) - 1;
    const d = Number(day);
    const h = Number(hour) || 0;
    const min = Number(minute) || 0;
    const s = Number(second) || 0;
    if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) {
      return null;
    }
    const result = new Date(y, m, d, h, min, s);
    return Number.isNaN(result.getTime()) ? null : result;
  },
  datediff: (a: unknown, b: unknown, options?: unknown) => {
    if(options!==undefined)return calendarInterval(b,a,options);
    const da = toDate(a);
    const db = toDate(b);
    if (!da || !db) return null;
    const diffMs = da.getTime() - db.getTime();
    return diffMs / (1000 * 60 * 60 * 24);
  },
  format:splFormat,
  string:splString,
  number:splNumber,
  age: (start: unknown, endOrOptions?: unknown, options?: unknown) => {
    const s = toDate(start);
    if (!s) return null;

    let end: Date | null;
    let optionArg: unknown = options;

    if (endOrOptions === undefined) {
      end = new Date();
    } else if (options === undefined && isAgeOptionsString(endOrOptions)) {
      end = new Date();
      optionArg = endOrOptions;
    } else {
      end = toDate(endOrOptions);
    }

    if (!end) return null;

    const opts = parseOptions(optionArg);
    const years = end.getFullYear() - s.getFullYear();
    if (opts.has("y")) return years;
    if (opts.has("m")) {
      return years - (end.getMonth() < s.getMonth() ? 1 : 0);
    }
    if (end.getMonth() < s.getMonth() || (end.getMonth() === s.getMonth() && end.getDate() < s.getDate())) {
      return years - 1;
    }
    return years;
  },
  workday: (date: unknown, diff: unknown, offDays?: unknown, options?: unknown) => {
    const base = toDate(date);
    if (!base) return null;
    const delta = Math.trunc(Number(diff));
    if (!Number.isFinite(delta)) return null;

    // 'b' indicates offDays is already sorted (optimization only).
    void parseOptions(options);
    const off = normalizeOffDays(offDays);

    const cursor = new Date(base.getTime());
    if (delta === 0) return cursor;

    const step = delta > 0 ? 1 : -1;
    let remaining = Math.abs(delta);
    while (remaining > 0) {
      cursor.setDate(cursor.getDate() + step);
      if (isWorkday(cursor, off)) {
        remaining -= 1;
      }
    }
    return cursor;
  },
  workdays: (begin: unknown, end: unknown, offDaysOrOptions?: unknown, options?: unknown) => {
    const b = toDate(begin);
    const e = toDate(end);
    if (!b || !e) return null;

    let offDays: unknown = offDaysOrOptions;
    let optionArg: unknown = options;
    if (typeof offDaysOrOptions === "string") {
      offDays = undefined;
      optionArg = offDaysOrOptions;
    }

    const opts = parseOptions(optionArg);
    const off = normalizeOffDays(offDays);
    const excludeEnd = opts.has("x");
    const wantCount = opts.has("n");

    const out: Date[] = [];
    let count = 0;

    const cursor = new Date(b.getTime());
    const endTime = e.getTime();
    const step = cursor.getTime() <= endTime ? 1 : -1;
    const within = (time: number) => {
      if (step > 0) return excludeEnd ? time < endTime : time <= endTime;
      return excludeEnd ? time > endTime : time >= endTime;
    };

    while (within(cursor.getTime())) {
      if (isWorkday(cursor, off)) {
        if (wantCount) count += 1;
        else out.push(new Date(cursor.getTime()));
      }
      cursor.setDate(cursor.getDate() + step);
    }

    return wantCount ? count : out;
  },
  sum: (arr: unknown) => {
    return aggregateValues("sum", Array.isArray(arr) ? arr : [arr]);
  },
  avg: (arr: unknown) => {
    return aggregateValues("avg", Array.isArray(arr) ? arr : [arr]);
  },
  min: (arr: unknown) => {
    return aggregateValues("min", Array.isArray(arr) ? arr : [arr]);
  },
  max: (arr: unknown) => {
    return aggregateValues("max", Array.isArray(arr) ? arr : [arr]);
  },
  median: (arr: unknown) => {
    return aggregateValues("median", Array.isArray(arr) ? arr : [arr]);
  },
  top: (count: unknown, arr: unknown, expr?: unknown) => {
    const take = Number(count);
    if (!Number.isFinite(take) || take === 0) return Array.isArray(arr) ? [] : null;
    const items = Array.isArray(arr) ? [...arr] : arr == null ? [] : [arr];
    const mapper = typeof expr === "string" && expr.length > 0
      ? compileMapper(expr)
      : (item: unknown) => item;
    const sorted = items
      .map((item) => ({ item, value: Number(mapper(item)) }))
      .filter((entry) => !Number.isNaN(entry.value))
      .sort((a, b) => a.value - b.value);
    const picked = sorted.slice(-Math.abs(take)).map((entry) => entry.item);
    return Math.abs(take) === 1 ? (picked[0] ?? null) : picked;
  },
  range: (start: unknown, end: unknown) => {
    const s = Number(start);
    const e = Number(end);
    if (Number.isNaN(s) || Number.isNaN(e)) return [];
    const step = s <= e ? 1 : -1;
    const out: number[] = [];
    for (let i = s; step > 0 ? i <= e : i >= e; i += step) {
      out.push(i);
    }
    return out;
  },
  if: (...args: unknown[]): unknown => {
    if (args.length === 1) {
      return truthy(args[0]);
    }
    if (args.length === 2) {
      return truthy(args[0]) ? args[1] : null;
    }
    if (args.length === 3) {
      return truthy(args[0]) ? args[1] : args[2];
    }
    throw new Error("if() expects 1-3 arguments");
  },
  case: (...args: unknown[]): unknown => {
    if (args.length < 1) {
      throw new Error("case() expects at least 1 argument");
    }
    const value = args[0];
    for (let i = 1; i < args.length; i += 2) {
      if (i + 1 < args.length) {
        if (value === args[i]) {
          return args[i + 1];
        }
      }
    }
    return null;
  },
  ifp: (rawParams: unknown, scope: unknown): unknown => {
    if (typeof rawParams !== "string" || typeof scope !== "object" || scope == null) {
      throw new Error("ifp() expects (string, scope) arguments");
    }
    const { ifp } = require("./paramFunctions") as typeof import("./paramFunctions");
    return ifp(rawParams, scope as Record<string, unknown>);
  },
  casep: (rawParams: unknown, scope: unknown): unknown => {
    if (typeof rawParams !== "string" || typeof scope !== "object" || scope == null) {
      throw new Error("casep() expects (string, scope) arguments");
    }
    const { casep } = require("./paramFunctions") as typeof import("./paramFunctions");
    return casep(rawParams, scope as Record<string, unknown>);
  },
  connect: (name?: unknown, url?: unknown): unknown => {
    if (name === undefined) {
      throw new Error("connect() requires at least 1 argument");
    }
    if (url !== undefined) {
      if (typeof name !== "string" || typeof url !== "string") {
        throw new Error("connect(driver, url) expects string arguments");
      }
      return makeDbHandle({ driver: name, url, type: "jdbc" });
    }
    if (typeof name !== "string") {
      throw new Error("connect(name) expects a string argument");
    }
    return makeDbHandle({ name });
  },
};

export function withCustomFunctions(overrides: FunctionRegistry): FunctionRegistry {
  const next: FunctionRegistry = { ...builtins };
  for (const [name, fn] of Object.entries(overrides)) {
    next[name.toLowerCase()] = fn;
  }
  return next;
}
