# Mission: SPL标量与精确数字

终点: 空值加减、数字文本加法、连接除法、日期算术和结构比较对齐 Variant，非法类型明确失败；long/decimal 显式精确计算、超安全整数字面量不丢精度，聚合/类型键/输出保真。

## Attractors

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 结构/语义 | [attractors/source-parity.md](attractors/source-parity.md) | 来源语义、纯处理器与输入权威 | 计划 / 决策 / 实现 / 校验 | 1 |

## Notes

- 使用 depa-expert 和 cdmt-mission-lite；命名候选 spl-scalar-numeric-parity、spl-scalar-numeric-parity-convergence，选前者。gap-loop 未启用，自行独立重观察。
- 源头库存：Variant add/subtract/divide/isEquals、ToLong/ToBigDecimal；需要改造：标量运算和精确数字；最终暴露：expression/core/Kon/flow 现有入口及 long/decimal，不引入 Java。
- 只使用合成数据和隔离临时资源；源码与 Codument 只读，主工作区用户 dirty 保留。

## 期望结果

- 期望-1: 空值加减、数字文本加法、连接除法、日期算术和结构比较对齐 Variant，非法类型明确失败。
- 期望-2: long/decimal 显式精确计算、超安全整数字面量不丢精度，聚合/类型键/输出保真。

## 约束

- 约束-1: AT1 成立，报表既有布尔/数值规则回归保持。
- 约束-2: 不修改旧 Codument、源 Java 和外部基础库，不恢复 domain/ORM/企业平台。

## Acceptance

- [x] 期望-1、期望-2、约束-1 → `bun test packages/expression packages/core packages/kon-spl-dsl packages/spl-flow packages/report-logic` → 来源实值、负向类型/字段/选项与输入不变断言通过（隔离本地数据）。
- [x] 约束-1、约束-2 → `bun test` 与 `bun run build` → 全量回归和13包构建通过，生成物在忽略目录。
- [x] 约束-1 → `! rg -n 'node:fs|Bun\.file|new Function|eval\(' packages/report-logic/src` → 纯核心无隐藏 IO/eval；相关测试包含不支持输入/不反写负例。
- [x] 约束-2 → `git diff -- codument | shasum -a 256` 与 `git ls-files --others --exclude-standard codument | shasum -a 256` → 分别保持 7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049 和 1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e。

## 范围外

- 企业平台、分布式 DW、JDBC/VDB、外排磁盘执行器；没有将 Java 全库兼容作为完成信号。
