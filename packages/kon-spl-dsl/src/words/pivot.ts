import type { PivotSpec, UnpivotSpec } from "depa-data-core";
import { normalizeKnValue } from "../knot-reader";
import type { SplContext } from "../context";
import type { WordCall } from "../knot-reader";
import { rejectNativeOptions, resolveDataSet, type KununRuntime } from "./shared";
export function declaration(value: unknown): unknown {
    const normalized = normalizeKnValue(value);
    if (normalized !== value)
        return normalized;
    if (Array.isArray(value))
        return value.map(declaration);
    if (value && typeof value === "object")
        return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, declaration(item)]));
    return value;
}
export function executePivot(ctx: SplContext, runtime: KununRuntime, call: WordCall, reverse = false) {
    const word = reverse ? "spl_unpivot" : "spl_pivot";
    rejectNativeOptions(call, word);
    const input = resolveDataSet(ctx, runtime, call.conf.in, word);
    const { in: _, ...raw } = call.conf;
    const spec = declaration(raw);
    return reverse ? input.unpivot(spec as UnpivotSpec) : input.pivot(spec as PivotSpec);
}
