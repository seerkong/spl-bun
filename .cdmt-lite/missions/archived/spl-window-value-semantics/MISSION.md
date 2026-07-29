# Mission: SPL窗口值与相对行计算

终点: 窗口累计使用共享null/精确数字聚合与schema绑定，窗口输入和外部scope不反写；相对行lag/lead和包含端点的ROWS聚合frame经共享纯处理器接入core/member/Kon，分区边界不泄漏。

## Attractors

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 结构/语义 | [attractors/source-parity.md](attractors/source-parity.md) | 来源语义、纯处理器与输入权威 | 计划 / 决策 / 实现 / 校验 | 1 |

## Notes

- 使用 depa-expert 和 cdmt-mission-lite；命名候选 spl-window-value-semantics、spl-window-value-semantics-convergence，选前者。gap-loop 未启用，自行独立重观察。
- 源头库存：Move/Moves 相对当前行与区间、gather规则、旧window迁移承诺；需要改造：窗口只实现5输出且强制Number导致精度/空值漂移；最终暴露：既有 window 与 spl_window 显式Conf，不引入Java Current宿主。
- 只使用合成数据和隔离临时资源；源码与 Codument 只读，主工作区用户 dirty 保留。

## 期望结果

- 期望-1: 窗口累计使用共享null/精确数字聚合与schema绑定，窗口输入和外部scope不反写。
- 期望-2: 相对行lag/lead和包含端点的ROWS聚合frame经共享纯处理器接入core/member/Kon，分区边界不泄漏。

## 约束

- 约束-1: AT1 成立，报表既有布尔/数值规则回归保持。
- 约束-2: 不修改旧 Codument、源 Java 和外部基础库，不恢复 domain/ORM/企业平台。

## Acceptance

- [x] 期望-1、期望-2、约束-1 → `bun test packages/expression packages/core packages/kon-spl-dsl packages/spl-flow packages/report-logic` → 来源实值、负向类型/字段/选项与输入不变断言通过（隔离本地数据）。
- [x] 约束-1、约束-2 → `bun test` 与 `bun run build` → 全量回归和13包构建通过，生成物在忽略目录。
- [x] 约束-1 → `! rg -n 'node:fs|Bun\.file|new Function|eval\(' packages/report-logic/src` → 纯核心无隐藏 IO/eval；相关测试包含不支持输入/不反写负例。
- [x] 约束-2 → `git diff -- codument | shasum -a 256` 与 `git ls-files --others --exclude-standard codument | shasum -a 256` → 分别保持 7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049 和 1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e。

- [x] 期望-1、期望-2 → `bun .cdmt-lite/missions/archived/spl-window-value-semantics/verification/source-offset-oracle.ts` → 抽取实际 Java Move 方法，1743项相对行/区间结果一致；临时 javac 制品 finally 清理。
- [x] 期望-1、期望-2 → `SPL_E2E_FRONTEND_PORT=4394 SPL_E2E_BACKEND_PORT=4396 bun run test:e2e` → 17个产品用例通过，新增精确窗口/相对行/ROWS frame 网页路径。

## 范围外

- 企业平台、分布式 DW、JDBC/VDB、外排磁盘执行器；没有将 Java 全库兼容作为完成信号。
