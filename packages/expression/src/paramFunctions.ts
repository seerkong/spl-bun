import { compileExpression } from "./evaluator";
import { parseParamTree, type ParamNode } from "./paramParser";
import { truthy } from "./utils";

const evalLeaf = (raw: string, ctx: Record<string, unknown>) => compileExpression(raw).evaluate(ctx);

export function ifp(rawParams: string, scope: Record<string, unknown>): unknown {
  const tree = parseParamTree(rawParams);
  if (!tree) return null;

  if (tree.type === "leaf") {
    return truthy(evalLeaf(tree.raw, scope));
  }

  if (tree.separator === ";") {
    const [pairsNode, defaultNode] = tree.children;
    const result = evalIfPairs(pairsNode, scope);
    if (result !== undefined) return result;
    if (defaultNode) return evalNodeValue(defaultNode, scope);
    return null;
  }

  const result = evalIfPairs(tree, scope);
  return result !== undefined ? result : null;
}

export function casep(rawParams: string, scope: Record<string, unknown>): unknown {
  const tree = parseParamTree(rawParams);
  if (!tree) return null;

  let defaultNode: ParamNode | undefined;
  let payloadNode: ParamNode = tree;

  if (tree.type === "symbol" && tree.separator === ";") {
    payloadNode = tree.children[0];
    defaultNode = tree.children[1];
  }

  if (payloadNode.type !== "symbol" || payloadNode.separator !== ",") {
    return null;
  }

  const [valueNode, ...pairNodes] = payloadNode.children;
  const value = evalNodeValue(valueNode, scope);
  for (const pairNode of pairNodes) {
    const pair = evalPair(pairNode, scope);
    if (pair && value === pair[0]) {
      return pair[1]() ?? null;
    }
  }

  return defaultNode ? evalNodeValue(defaultNode, scope) : null;
}

function evalIfPairs(node: ParamNode | undefined, scope: Record<string, unknown>): unknown | undefined {
  if (!node) return undefined;
  if (node.type === "symbol" && node.separator === ",") {
    for (const child of node.children) {
      const pair = evalPair(child, scope);
      if (pair && truthy(pair[0])) return pair[1]() ?? null;
    }
    return undefined;
  }
  const pair = evalPair(node, scope);
  if (pair && truthy(pair[0])) return pair[1]() ?? null;
  return undefined;
}

function evalPair(node: ParamNode, scope: Record<string, unknown>): [unknown, () => unknown] | null {
  if (node.type === "symbol" && node.separator === ":") {
    const [condNode, valueNode] = node.children;
    return [evalNodeValue(condNode, scope), () => evalNodeValue(valueNode, scope)];
  }
  if (node.type === "leaf") {
    return [evalLeaf(node.raw, scope), () => null];
  }
  return null;
}

function evalNodeValue(node: ParamNode | undefined, scope: Record<string, unknown>): unknown {
  if (!node) return null;
  if (node.type === "leaf") return evalLeaf(node.raw, scope);
  if (node.type === "symbol" && node.separator === ",") {
    return node.children.map((child) => evalNodeValue(child, scope));
  }
  if (node.type === "symbol" && node.separator === ":") {
    const [left, right] = node.children;
    return [evalNodeValue(left, scope), evalNodeValue(right, scope)];
  }
  return null;
}
