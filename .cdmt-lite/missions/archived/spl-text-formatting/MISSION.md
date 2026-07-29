# Mission: SPL字符串格式与数值转换

终点: format(pattern,args...) 支持来源常用的参数索引/复用、字符串/布尔/整数/浮点/日期转换与明确诊断，保留现有Date-first ISO别名；string/number 接入常用数字和日期模式、精确long/decimal与转换fallback，不再把format误认为仅日期ISO输出。

## Attractors

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 结构/语义 | [attractors/source-parity.md](attractors/source-parity.md) | 来源语义、纯处理器与输入权威 | 计划 / 决策 / 实现 / 校验 | 1 |

## Notes

- 使用 depa-expert 和 cdmt-mission-lite；命名候选 spl-text-formatting、spl-text-formatting-convergence，选前者。gap-loop 未启用。2026-10-24 本轮依用户 Implement 合同执行；实施者重观察及运行验收，外部 workflow 独立 Review 才能裁决接纳 gap 关闭，不自行调用评审或启动下一批。
- 源头库存：fn/convert/Format.java 的 String.format、ToString/ToNumber 与旧port format承诺；需要改造：目前format仅ISO日期输出、number/string缺入口；最终暴露：expression及已有Kon/Flow入口的纯formatting模块，不移植ICU/企业平台。
- 只使用合成数据和隔离临时资源；源码与 Codument 只读，主工作区用户 dirty 保留。

## 期望结果

- 期望-1: format(pattern,args...) 支持来源常用的参数索引/复用、字符串/布尔/整数/浮点/日期转换与明确诊断，保留现有Date-first ISO别名。
- 期望-2: string/number 接入常用数字和日期模式、精确long/decimal与转换fallback，不再把format误认为仅日期ISO输出。

## 约束

- 约束-1: AT1 成立，报表既有布尔/数值规则回归保持。
- 约束-2: 不修改旧 Codument、源 Java 和外部基础库，不恢复 domain/ORM/企业平台。

## Acceptance

- [x] 期望-1、期望-2、约束-1 → `bun test packages/expression packages/core packages/kon-spl-dsl packages/spl-flow packages/report-logic` → 来源实值、负向类型/字段/选项与输入不变断言通过（隔离本地数据）。
- [x] 约束-1、约束-2 → `bun test` 与 `bun run build` → 全量回归和13包构建通过，生成物在忽略目录。
- [x] 约束-1 → `! rg -n 'node:fs|Bun\.file|new Function|eval\(' packages/report-logic/src` → 纯核心无隐藏 IO/eval；相关测试包含不支持输入/不反写负例。
- [x] 约束-2 → `git diff -- codument | shasum -a 256` 与 `git ls-files --others --exclude-standard codument | shasum -a 256` → 分别保持 7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049 和 1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e。

- [x] 期望-1、期望-2 → `bun .cdmt-lite/missions/active/spl-text-formatting/verification/formatter-oracle.ts` → 原46项、52个字符/浮点null结果及14个非法null协议，共112项实际 Java Formatter/ICU DecimalFormat/SimpleDateFormat 对照一致，临时编译 finally 清理。
- [x] 期望-1、期望-2 → `SPL_E2E_FRONTEND_PORT=4394 SPL_E2E_BACKEND_PORT=4396 bun run test:e2e` → 17个产品用例通过，包含网页精确值 format 派生。
- [x] 期望-1、期望-2、约束-1 → 独立 Review 的具体技术整改裁决 → input.loopFeedback.source=gap-review/generation3/hash=bd8521f450c40da6b0b56f028df4abbe1874f8e4f91b718ea6c987d0f0162515 对当前业务基线判定 C1–C7 met、G6/G7 整改通过；这是收到的独立裁决，不是实施者自批。
- [x] 期望-1、期望-2、约束-1 → 当前formatting接纳差距与独立Review核销 → G0/G1/G3/G4及G6/G7技术整改已通过给定Review；新增排序/parse明确归后续有限mission，不混入formatting完成声明。
- [x] 约束-2 → 实际目录级授权与命令身份/feedback lineage可追溯 → 续作指令明确目录策略及候选接纳，逐文件允许集从未冻结；实际implement generation5、node_revision6-user-continuation-20261024、graph_revision6已从command/checkpoint读得。原baseline及feedback保留，观察变更集单列，不伪造Host允许集。

## 范围外

- 企业平台、分布式 DW、JDBC/VDB、外排磁盘执行器；没有将 Java 全库兼容作为完成信号。
