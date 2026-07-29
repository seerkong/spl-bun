/**
 * options — 把 SPL 选项串改写进透传表达式最外层调用（func@opt / obj.method@opt）。
 *
 * 实现方式：用 depa-data-expression 的 compileExpression 解析表达式得 AST，
 * 判断最外层节点是否为 call / member_call 及其现有 option（避免脆弱正则）；
 * 再做字符串级精准插入：定位"匹配收尾 `)` 的最外层实参开括号"，在其前插入
 * `@options`。插入后重新编译校验 option 生效，防止静默改坏表达式。
 *
 * 支持范围（其余抛错，引导直接在表达式串内写 @opt 透传）：
 * - 最外层是函数调用或成员方法调用（整个表达式即该调用）。
 * - 已含相同选项 → 幂等原样返回；已含不同选项 → 抛冲突错误。
 */
import { compileExpression, type ExpressionNode } from "depa-data-expression";

/**
 * 在表达式最外层调用上应用选项串。
 *
 * @param expr SPL 表达式源码（如 `interval(start, end)`、`A.pos(2)`）
 * @param options 选项串（如 `m`、`ab`）；空串/空值时原样返回
 */
export function applyOptions(expr: string, options: string): string {
  if (!options) {
    return expr;
  }

  let ast: ExpressionNode;
  try {
    ast = compileExpression(expr).ast;
  } catch (e) {
    throw new Error(
      `applyOptions：表达式无法解析，无法注入选项 "@${options}"：${expr}\n` +
        `（${(e as Error).message}）`,
    );
  }

  if (ast.type !== "call" && ast.type !== "member_call") {
    throw new Error(
      `applyOptions：无法静态定位表达式的最外层函数调用（最外层为 ${ast.type}），` +
        `无法注入选项 "@${options}"。请直接在表达式串内写 @${options}，如 f@${options}(...)：${expr}`,
    );
  }

  const existing = ast.option;
  if (existing !== undefined) {
    if (existing === options) {
      return expr; // 幂等：已含相同选项
    }
    const callName = ast.type === "call" ? ast.callee : ast.method;
    throw new Error(
      `applyOptions：选项冲突——表达式最外层调用 ${callName} 已含选项 "@${existing}"，` +
        `与声明的 "@${options}" 不一致：${expr}`,
    );
  }

  const rewritten = insertOptionBeforeOuterArgList(expr, options);

  // 改写后回验：确保 option 被 parser 识别且落在最外层调用上
  let checked: ExpressionNode;
  try {
    checked = compileExpression(rewritten).ast;
  } catch (e) {
    throw new Error(
      `applyOptions：注入选项 "@${options}" 后表达式不可解析（改写结果 "${rewritten}"）。` +
        `请直接在表达式串内写 @${options}。原表达式：${expr}`,
    );
  }
  if (
    (checked.type !== "call" && checked.type !== "member_call") ||
    checked.option !== options
  ) {
    throw new Error(
      `applyOptions：注入选项 "@${options}" 后校验失败（改写结果 "${rewritten}"）。` +
        `请直接在表达式串内写 @${options}。原表达式：${expr}`,
    );
  }
  return rewritten;
}

/**
 * 定位最外层调用实参列表的开括号并在其前插入 `@options`。
 *
 * 定位规则：正向扫描（跳过单/双引号字符串），记录每个 depth 0→1 的开括号
 * 及其匹配闭括号位置；最外层调用的实参列表即"闭括号为最后一个非空白字符"
 * 的那一组。调用方已用 AST 确认最外层是调用，此处仅做位置定位。
 */
function insertOptionBeforeOuterArgList(expr: string, options: string): string {
  const lastNonWs = expr.replace(/\s+$/, "").length - 1;
  let depth = 0;
  let openAt = -1;
  let quote: string | null = null;
  let found = -1;

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (quote !== null) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "(") {
      if (depth === 0) openAt = i;
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0 && i === lastNonWs) {
        found = openAt;
        break;
      }
    }
  }

  if (found < 0) {
    throw new Error(
      `applyOptions：无法在表达式中定位最外层调用的实参括号，无法注入选项 "@${options}"。` +
        `请直接在表达式串内写 @${options}：${expr}`,
    );
  }
  return expr.slice(0, found) + "@" + options + expr.slice(found);
}
