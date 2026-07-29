import { compileExpression } from "./evaluator";

export interface MacroContext {
  [name: string]: unknown;
}

export function replaceMacros(source: string, macros: MacroContext): string {
  if (!source) return source;
  let out = "";
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\"" || ch === "'") {
      const quote = ch;
      out += ch;
      i += 1;
      while (i < source.length) {
        const c = source[i];
        out += c;
        if (c === "\\" && i + 1 < source.length) {
          out += source[i + 1];
          i += 2;
          continue;
        }
        if (c === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    if (ch === "$" && i + 1 < source.length && source[i + 1] === "{") {
      const end = scanBalanced(source, i + 2, "{", "}");
      if (end === -1) {
        throw new Error("Unterminated macro expression");
      }
      const expr = source.slice(i + 2, end).trim();
      const compiled = compileExpression(expr);
      const value = compiled.evaluate({ ...macros });
      out += value == null ? "" : String(value);
      i = end + 1;
      continue;
    }

    if (ch === "$" && i + 1 < source.length && source[i + 1] === "(") {
      const end = scanBalanced(source, i + 2, "(", ")");
      if (end === -1) {
        throw new Error("Unterminated macro expression");
      }
      const key = source.slice(i + 2, end).trim();
      const value = macros[key];
      out += value == null ? "" : String(value);
      i = end + 1;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

function scanBalanced(source: string, start: number, open: string, close: string): number {
  let depth = 1;
  let i = start;
  let quote: string | null = null;
  while (i < source.length) {
    const ch = source[i];
    if (quote) {
      if (ch === "\\" && i + 1 < source.length) {
        i += 2;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      i += 1;
      continue;
    }
    if (ch === "\"" || ch === "'") {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === open) depth += 1;
    if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  return -1;
}
