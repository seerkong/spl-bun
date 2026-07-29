export type ParamSeparator = ";" | "," | ":";

export type ParamNode =
  | { type: "leaf"; raw: string }
  | { type: "symbol"; separator: ParamSeparator; children: ParamNode[] };

export type ParamLeafEvaluator = (raw: string, scope: Record<string, unknown>) => unknown;

const SEPARATOR_ORDER: ParamSeparator[] = [";", ",", ":"];

export function parseParamTree(paramStr: string): ParamNode | null {
  if (paramStr == null) return null;
  const trimmed = paramStr.trim();
  if (!trimmed) return null;
  return parseLevel(trimmed, 0);
}

export function evalParamTree(
  node: ParamNode | null,
  scope: Record<string, unknown>,
  evalLeaf: ParamLeafEvaluator,
): unknown {
  if (!node) return null;
  if (node.type === "leaf") {
    return node.raw ? evalLeaf(node.raw, scope) : null;
  }
  return node.children.map((child) => evalParamTree(child, scope, evalLeaf));
}

function parseLevel(text: string, level: number): ParamNode {
  if (level >= SEPARATOR_ORDER.length) {
    return leaf(text);
  }
  const separator = SEPARATOR_ORDER[level];
  const tokens = splitAtTopLevel(text, separator);
  if (tokens.length === 1) {
    if (separator === ":") {
      return leaf(tokens[0]);
    }
    return parseLevel(tokens[0], level + 1);
  }
  if (separator === ":") {
    return { type: "symbol", separator, children: tokens.map((tok) => leaf(tok)) };
  }
  return { type: "symbol", separator, children: tokens.map((tok) => parseLevel(tok, level + 1)) };
}

function leaf(token: string): ParamNode {
  const trimmed = token.trim();
  return { type: "leaf", raw: trimmed };
}

function splitAtTopLevel(text: string, separator: ParamSeparator): string[] {
  const parts: string[] = [];
  let start = 0;
  let i = 0;
  let quote: string | null = null;
  let paren = 0;
  let bracket = 0;
  let brace = 0;

  while (i < text.length) {
    const ch = text[i];

    if (quote) {
      if (ch === "\\" && i + 1 < text.length) {
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

    if (ch === "(") {
      paren += 1;
    } else if (ch === ")") {
      paren = Math.max(0, paren - 1);
    } else if (ch === "[") {
      bracket += 1;
    } else if (ch === "]") {
      bracket = Math.max(0, bracket - 1);
    } else if (ch === "{") {
      brace += 1;
    } else if (ch === "}") {
      brace = Math.max(0, brace - 1);
    }

    if (ch === separator && paren === 0 && bracket === 0 && brace === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }

    i += 1;
  }

  parts.push(text.slice(start).trim());
  return parts;
}
