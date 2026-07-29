# 变更：kon-spl-dsl 新增高频数据运算的 Kon 原生 word

## 背景和动机 (Context And Why)

前序 track add-kon-spl-dsl 交付了字符串透传层（spl_eval 等）。G3 验证反馈（mission kon-spl-dsl 的 reports/verify-g3.md）显示透传的核心痛点：SPL param 风格 `:alias` 实参不被通用 expression parser 支持、derive record 形态内层 scope 看不见外层变量，用户被迫字符串拼接。为高频运算提供 Kon 原生 word，把 SPL 的 `; : @` 结构映射为 Kon 习惯（Conf 键 + map 配对），消除这些限制。

## "要做"和"不做" (Goals / Non-Goals)

**目标:**
- 在 packages/kon-spl-dsl 新增 6 个原生 word：spl_derive、spl_select、spl_groups、spl_sort、spl_join、spl_top，挂进现有 EnableSplDsl。
- 语法遵循既有 knot 约定；`in`（join 为 left/right）解析 Kon 变量名或 DataSet 值。
- 原生 word 模式经 Conf 键表达（如 desc），不接受 #opt/@ 糖，误用报错。
- 更新 README 语法表与 examples（示范 derive/select/groups 原生写法替代字符串拼接）。

**非目标:**
- spl_window 本批裁剪（入 mission backlog，理由：window spec 映射直观但工作量大且 G3 反馈未列为痛点）。
- 不改透传层与 spl_flow 行为；不动 kunun 与 spl-flow。

## 变更内容（What Changes）

- packages/kon-spl-dsl：新增 src/words/{derive,select,groups,sort,join,top}.ts 及测试；enable.ts 注册扩展；README/examples 更新。

## 影响范围（Impact）

- 受影响的能力：kon-spl-dsl（新增 4 个 requirement，见 behavior_deltas）。
- 受影响的代码：仅 packages/kon-spl-dsl。
