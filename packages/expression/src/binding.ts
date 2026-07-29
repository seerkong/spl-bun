import type { CompiledExpression, ExpressionNode } from "./ast";
import { compileExpression } from "./evaluator";
export function assertExpressionBindings(node: ExpressionNode, names: ReadonlySet<string>, source: string): void {
    function visit(value: ExpressionNode): void {
        switch (value.type) {
            case "identifier":
                if (!names.has(value.name))
                    throw new Error(`Unknown field '${value.name}' in expression ${JSON.stringify(source)}`);
                break;
            case "unary":
                visit(value.operand);
                break;
            case "binary":
                visit(value.left);
                visit(value.right);
                break;
            case "member":
                visit(value.object);
                break;
            case "member_call":
                visit(value.object);
                // These adapters bind their arguments against the receiver's
                // schema and invocation scope when that receiver is known.
                if (["select", "derive", "sort", "calc", "sum", "avg", "min", "max", "median", "count", "icount", "union", "isect", "diff", "conj"].includes(value.method.toLowerCase())) break;
                value.args.forEach(visit);
                value.argGroups?.flat().forEach(visit);
                break;
            case "call":
                value.args.forEach(visit);
                value.argGroups?.flat().forEach(visit);
                break;
            case "list":
                value.items.forEach(visit);
                break;
            case "record":
                value.entries.forEach(entry => visit(entry.value));
                break;
            case "literal": break;
        }
    }
    visit(node);
}
/** Only table adapters opt into binding. Free expression scopes keep their
 * existing missing-variable behavior; sparse declared fields remain legal.
 */
export function compileBoundExpression(source: string, columns: readonly string[], scope: Record<string, unknown> = {}): CompiledExpression {
    const expression = compileExpression(source);
    assertExpressionBindings(expression.ast, new Set([...columns, ...Object.keys(scope)]), source);
    return expression;
}
export function tableRowScope(columns: readonly string[], row: Record<string, unknown>, scope: Record<string, unknown> = {}): Record<string, unknown> {
    return { ...scope, ...Object.fromEntries(columns.map(name => [name, undefined])), ...row };
}
export function assertKnownColumns(required: readonly string[], columns: readonly string[]): void {
    for (const name of required)
        if (!columns.includes(name))
            throw new Error(`Unknown field '${name}' in table schema`);
}
