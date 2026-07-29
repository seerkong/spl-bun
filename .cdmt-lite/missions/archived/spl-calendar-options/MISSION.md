# Mission: SPL日历与日期选项

终点: elapse/dateadd 的月季年、月末保持和 e 选项以及秒/毫秒位移符合来源日历规则；interval 日历差与单位边界和本地 DST 行为有来源实值验收，datediff 保留原有经过时间契约并支持显式单位。

## Attractors

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 结构/语义 | [attractors/source-parity.md](attractors/source-parity.md) | 来源语义、纯处理器与输入权威 | 计划 / 决策 / 实现 / 校验 | 1 |

## Notes

- 使用 depa-expert 和 cdmt-mission-lite；命名候选 spl-calendar-options、spl-calendar-options-convergence，选前者。gap-loop 未启用，自行独立重观察。
- 源头库存：Variant.elapse/interval 及旧 date phase2 记录；需要改造：calendar纯函数和选项；最终暴露：elapse/interval 原名及现有 dateadd/datediff，不引入时区平台。
- 只使用合成数据和隔离临时资源；源码与 Codument 只读，主工作区用户 dirty 保留。

## 期望结果

- 期望-1: elapse/dateadd 的月季年、月末保持和 e 选项以及秒/毫秒位移符合来源日历规则。
- 期望-2: interval 日历差与单位边界和本地 DST 行为有来源实值验收，datediff 保留原有经过时间契约并支持显式单位。

## 约束

- 约束-1: AT1 成立，报表既有布尔/数值规则回归保持。
- 约束-2: 不修改旧 Codument、源 Java 和外部基础库，不恢复 domain/ORM/企业平台。

## Acceptance

- [x] 期望-1、期望-2、约束-1 → `bun test packages/expression packages/core packages/kon-spl-dsl packages/report-logic` → 来源实值、负向类型/字段/选项与输入不变断言通过（隔离本地数据）。
- [x] 约束-1、约束-2 → `bun test` 与 `bun run build` → 全量回归和13包构建通过，生成物在忽略目录。
- [x] 约束-1 → `! rg -n 'node:fs|Bun\.file|new Function|eval\(' packages/report-logic/src` → 纯核心无隐藏 IO/eval；相关测试包含不支持输入/不反写负例。
- [x] 约束-2 → `git diff -- codument | shasum -a 256` 与 `git ls-files --others --exclude-standard codument | shasum -a 256` → 分别保持 7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049 和 1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e。

- [x] 期望-1、期望-2 → `bun .cdmt-lite/missions/archived/spl-calendar-options/verification/source-oracle.ts` → 抽取实际 Java 方法，在 UTC/New_York/Shanghai 共4728项实值一致；临时编译只在系统临时目录，finally 清理。

## 范围外

- 企业平台、分布式 DW、JDBC/VDB、外排磁盘执行器；没有将 Java 全库兼容作为完成信号。
