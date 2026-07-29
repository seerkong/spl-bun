import type { AlterColumn, GroupColumnsSpec, UngroupColumnsSpec } from "depa-data-core";
import type { SplContext } from "../context";
import type { WordCall } from "../knot-reader";
import { declaration } from "./pivot";
import { rejectNativeOptions, resolveDataSet, type KununRuntime } from "./shared";
export const tableWords = ["rename", "alter", "index", "group_rows", "groupc", "ungroupc", "groupi"] as const;
export type TableWord = typeof tableWords[number];
export function executeTableStructure(ctx: SplContext, runtime: KununRuntime, call: WordCall, operation: TableWord) {
    const word = `spl_${operation}`;
    rejectNativeOptions(call, word);
    const input = resolveDataSet(ctx, runtime, call.conf.in, word);
    const config = declaration(call.conf) as Record<string, unknown>;
    switch (operation) {
        case "rename": return input.rename(config.mapping as Record<string, string>);
        case "alter": return input.alter(config.columns as AlterColumn[]);
        case "index": return input.index(config.keys as string[], config.unique === true);
        case "group_rows": return input.groupRows(config as unknown as {
            keys: string[];
            adjacent?: boolean;
            rowsAs?: string;
        });
        case "groupc": return input.groupc(config as unknown as GroupColumnsSpec);
        case "ungroupc": return input.ungroupc(config as unknown as UngroupColumnsSpec);
        case "groupi": return input.groupi(config as unknown as {
            columns: string[];
            ordered?: boolean;
        });
    }
}
