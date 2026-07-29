import type { ExpressionNode } from "./ast";
import { aggregateValues, type AggregateKind } from "./aggregation";
import { assertExpressionBindings, tableRowScope } from "./binding";
import { compileExpression, evaluateAst } from "./evaluator";
import { builtins } from "./functions";
const aggregates = new Set<AggregateKind>(["sum", "count", "icount", "avg", "min", "max", "median"]);
/** Extract aggregate calls from the actual AST; scalar outer expressions and
 * lazy conditionals then use the same evaluator as other SPL expressions.
 */
export function compileAggregateExpression(source: string, columns: readonly string[], scope: Record<string, unknown> = {}): (rows: Record<string, unknown>[]) => unknown {
    const compiled = compileExpression(source);
    const reducers: {
        name: string;
        kind: AggregateKind;
        argument?: ExpressionNode;
    }[] = [];
    function rewrite(node: ExpressionNode): ExpressionNode {
        if (node.type === "call") {
            const kind = node.callee.toLowerCase() as AggregateKind;
            if (aggregates.has(kind)) {
                if (node.option || node.argGroups || node.args.length > 1 || (node.args.length === 0 && kind !== "count"))
                    throw new Error(`Aggregate ${kind} expects one row expression (count() also accepts no arguments)`);
                const argument = node.args[0];
                if (argument) {
                    assertExpressionBindings(argument, new Set([...columns, ...Object.keys(scope)]), source);
                    function rejectNested(value: ExpressionNode): void {
                        if (value.type === "call" && aggregates.has(value.callee.toLowerCase() as AggregateKind))
                            throw new Error("Nested aggregate calls require a separate query stage");
                        for (const child of children(value))
                            rejectNested(child);
                    }
                    rejectNested(argument);
                }
                const name = `\0aggregate${reducers.length}`;
                reducers.push({ name, kind, argument });
                return { type: "identifier", name };
            }
            if (!builtins[kind])
                throw new Error(`未知聚合函数 "${node.callee}" (sum / count / icount / avg / min / max / median)`);
        }
        switch (node.type) {
            case "unary": return { ...node, operand: rewrite(node.operand) };
            case "binary": return { ...node, left: rewrite(node.left), right: rewrite(node.right) };
            case "call": return { ...node, args: node.args.map(rewrite) };
            case "member": return { ...node, object: rewrite(node.object) };
            case "member_call": return { ...node, object: rewrite(node.object), args: node.args.map(rewrite) };
            case "list": return { ...node, items: node.items.map(rewrite) };
            case "record": return { ...node, entries: node.entries.map(entry => ({ ...entry, value: rewrite(entry.value) })) };
            default: return node;
        }
    }
    const expression = rewrite(compiled.ast);
    if (!reducers.length)
        throw new Error("agg 值须包含 聚合函数(表达式)，如 sum(amount)");
    assertExpressionBindings(expression, new Set([...Object.keys(scope), ...reducers.map(item => item.name)]), source);
    return rows => {
        const functions = { ...builtins };
        const local = { ...scope };
        // Lazy memoized properties keep aggregates in unselected branches inert.
        for (const reducer of reducers) {
            let computed = false, value: unknown;
            Object.defineProperty(local, reducer.name, { get() {
                    if (!computed) {
                        value = aggregateValues(reducer.kind, reducer.argument ? rows.map(row => evaluateAst(reducer.argument!, tableRowScope(columns, row, scope), functions)) : rows);
                        computed = true;
                    }
                    return value;
                } });
        }
        return evaluateAst(expression, local, functions);
    };
}
function children(node: ExpressionNode): ExpressionNode[] {
    switch (node.type) {
        case "unary": return [node.operand];
        case "binary": return [node.left, node.right];
        case "call": return node.args;
        case "member": return [node.object];
        case "member_call": return [node.object, ...node.args];
        case "list": return node.items;
        case "record": return node.entries.map(entry => entry.value);
        default: return [];
    }
}
