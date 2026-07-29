import { executeWindow } from "./words/window";
import { executePivot } from "./words/pivot";
import { executeTableStructure, tableWords } from "./words/table-structure";
/**
 * EnableSplDsl — 在 kunun 运行时上注册 spl_* prefix keyword word 的单入口。
 *
 * 注册 word：spl_connect / spl_query / spl_execute / spl_eval / spl_flow
 * （透传层），以及原生数据运算 word spl_derive / spl_select / spl_groups /
 * spl_sort / spl_join / spl_top。
 *
 * 展开器统一走 expandWord 公共壳：readWordCall → 同步执行 →
 * PushValue（RuntimeOpCode 枚举）→ `#name` 时经 runtime.define 在当前 env
 * 绑定同名变量。
 */
import type { SplContext } from "./context";
import { executeConnect } from "./words/connect";
import { executeDerive } from "./words/derive";
import { executeEval } from "./words/eval";
import { executeGroups } from "./words/groups";
import { executeJoin } from "./words/join";
import { executeSelect } from "./words/select";
import { executeSort } from "./words/sort";
import { executeTop } from "./words/top";
import { executeExecute } from "./words/execute";
import { executeFlow } from "./words/flow";
import { executeQuery } from "./words/query";
import { expandWord, type KununRuntime } from "./words/shared";

export function EnableSplDsl(runtime: KununRuntime, ctx: SplContext): void {
  for (const operation of tableWords) runtime.registerPrefixKeyword(`spl_${operation}`,(rt,{knot})=>expandWord(rt as KununRuntime,knot,call=>executeTableStructure(ctx,rt as KununRuntime,call,operation)));
  runtime.registerPrefixKeyword("spl_pivot", (rt,{knot}) => expandWord(rt as KununRuntime,knot,call => executePivot(ctx,rt as KununRuntime,call)));
  runtime.registerPrefixKeyword("spl_unpivot", (rt,{knot}) => expandWord(rt as KununRuntime,knot,call => executePivot(ctx,rt as KununRuntime,call,true)));
  runtime.registerPrefixKeyword("spl_window", (rt, { knot }) =>
    expandWord(rt as KununRuntime, knot, (call) => executeWindow(ctx, rt as KununRuntime, call)),
  );
  runtime.registerPrefixKeyword("spl_connect", (rt, { knot }) =>
    expandWord(rt as KununRuntime, knot, (call) => executeConnect(ctx, call)),
  );
  runtime.registerPrefixKeyword("spl_query", (rt, { knot }) =>
    expandWord(rt as KununRuntime, knot, (call) =>
      executeQuery(ctx, rt as KununRuntime, call),
    ),
  );
  runtime.registerPrefixKeyword("spl_execute", (rt, { knot }) =>
    expandWord(rt as KununRuntime, knot, (call) =>
      executeExecute(ctx, rt as KununRuntime, call),
    ),
  );
  runtime.registerPrefixKeyword("spl_eval", (rt, { knot }) =>
    expandWord(rt as KununRuntime, knot, (call) =>
      executeEval(ctx, rt as KununRuntime, call),
    ),
  );
  runtime.registerPrefixKeyword("spl_flow", (rt, { knot }) =>
    expandWord(rt as KununRuntime, knot, (call) => executeFlow(ctx, call)),
  );
  runtime.registerPrefixKeyword("spl_derive", (rt, { knot }) =>
    expandWord(rt as KununRuntime, knot, (call) =>
      executeDerive(ctx, rt as KununRuntime, call),
    ),
  );
  runtime.registerPrefixKeyword("spl_select", (rt, { knot }) =>
    expandWord(rt as KununRuntime, knot, (call) =>
      executeSelect(ctx, rt as KununRuntime, call),
    ),
  );
  runtime.registerPrefixKeyword("spl_groups", (rt, { knot }) =>
    expandWord(rt as KununRuntime, knot, (call) =>
      executeGroups(ctx, rt as KununRuntime, call),
    ),
  );
  runtime.registerPrefixKeyword("spl_sort", (rt, { knot }) =>
    expandWord(rt as KununRuntime, knot, (call) =>
      executeSort(ctx, rt as KununRuntime, call),
    ),
  );
  runtime.registerPrefixKeyword("spl_join", (rt, { knot }) =>
    expandWord(rt as KununRuntime, knot, (call) =>
      executeJoin(ctx, rt as KununRuntime, call),
    ),
  );
  runtime.registerPrefixKeyword("spl_top", (rt, { knot }) =>
    expandWord(rt as KununRuntime, knot, (call) =>
      executeTop(ctx, rt as KununRuntime, call),
    ),
  );
}
