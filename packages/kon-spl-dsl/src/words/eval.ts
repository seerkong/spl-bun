/**
 * spl_eval — 把 Conf.expr 字符串交给 depa-data-expression 同步求值。
 *
 * - scope 合并（依序，后覆盖前）：ctx.scope ⊕ Kon env 可见变量快照 ⊕ Conf.with。
 * - 选项：`#opt = 串`（权威）/`@x`（糖）经 applyOptions 改写进表达式最外层
 *   调用（如 age → age@y）；表达式内已含不同选项时抛冲突错。
 */
import { Cursor, compileExpression, TYPE_CURSOR, defaultMemberRegistry, MemberFunctionRegistry, type MemberFunction, type MemberExpressionFunction } from "depa-data-expression";
import type { SplContext } from "../context";
import type { WordCall } from "../knot-reader";
import { applyOptions } from "../options";
import { normalizeWith, snapshotKonEnv, type KununRuntime } from "./shared";
export function executeEval(ctx: SplContext, runtime: KununRuntime, call: WordCall): unknown {
    const expr = call.conf.expr;
    if (typeof expr !== "string" || expr.length === 0) {
        throw new Error("spl_eval：Conf 缺少 expr（SPL 表达式字符串）");
    }
    const scope = {
        ...ctx.scope,
        ...snapshotKonEnv(runtime),
        ...normalizeWith(call.conf.with),
    };
    const finalExpr = applyOptions(expr, call.options);
    const expression = compileExpression(finalExpr, undefined, new SyncMemberRegistry());
    const value = expression.evaluate(scope);
    if (value instanceof Cursor) {
        if (!Object.values(scope).includes(value))
            void value.close().catch(() => { });
        throw new Error("Cursor requires async evaluateFlow or the host cursor API; synchronous Kon does not own cursor leases");
    }
    return value;
}
// Reject at the actual invocation boundary, before cursor position/IO changes.
// Lazy branches remain lazy; nested record/list/row ASTs use the same registry.
class SyncMemberRegistry extends MemberFunctionRegistry {
    private guard(name: string, target: unknown): void {
        if (name.toLowerCase() === "cursor" || target instanceof Cursor || target && typeof target === "object" && "__type" in target && target.__type === TYPE_CURSOR)
            throw new Error("Cursor requires async evaluateFlow or the host cursor API");
    }
    override resolve(name: string, target: unknown): MemberFunction | null { this.guard(name, target); return defaultMemberRegistry.resolve(name, target); }
    override resolveExpression(name: string, target: unknown): MemberExpressionFunction | null { this.guard(name, target); return defaultMemberRegistry.resolveExpression(name, target); }
}
