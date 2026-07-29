# Backlog · spl_window 原生 word

- 来源：mission kon-spl-dsl / track add-kon-spl-native-words 的范围裁剪（track decisions.md#2，2026-07-04）。
- 内容：为 kon-spl-dsl 增加 `spl_window` 原生 word，映射 DataSet.window({partitionBy, orderBy, outputs})（row_number/rank/dense_rank/running_sum/running_avg）。
- 裁剪理由：G3 使用反馈未将 window 列为痛点；映射直观但工作量大。当前可用 `spl_eval` 透传或 TypeScript API 替代。
- 参考：packages/kon-spl-dsl 的原生 word 既有模式（words/sort.ts 等）；mission analysis/spl-kon-dsl-design.md §4。
