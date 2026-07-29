# Mission: 序表正确性与 Kon 窗口计算

终点: 修复分组/关联/分区键碰撞及窗口累计值串用，并让 Kon 公开现有窗口计算能力。

本文件是期望态权威；状态见 [loop.md](loop.md)，证据见 [evidence.md](evidence.md)。

## Attractors

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 结构 | [attractors/explicit-projection.md](attractors/explicit-projection.md) | 输入 authority、显式依赖与投影关系 | 计划 / 决策 / 实现 / 校验 | 1 |

## Notes

- 每轮加载 skill：cdmt-mission-lite、depa-expert。
- 来源证据：[分析工作区](../../../../.depa-analysis/porting-2026-10-22/manifest.md)。
- 命名候选：dataset-semantics-and-kon-window、dataset-semantics-and-kon-window-port；选择前者，避免无语义编号。
- 源头库存：esProc 的类型/元组语义、当前 DataSet group/join/window 与历史 window backlog。
- 需要改造：使用结构化键替代拼串，分别计算不同窗口目标，增加 Kon window word 与示例。
- 最终暴露：现有 DataSet API 保持兼容；Kon 增加 window，包含分区、排序、排名与累计指标。
- 用户已授权按路线顺序执行；前序 mission 验收后直接激活，不重复询问。
- 命令从仓库根执行；测试仅用本地隔离或内存资源，构建输出到忽略的 dist。

## 期望结果

- 期望-1: 修复分组/关联/分区键碰撞及窗口累计值串用，并让 Kon 公开现有窗口计算能力。
- 期望-2: 新能力有来源可追溯的行为回归、使用示例与明确支持边界。

- 期望-3: spl_eval 成员 group/join 与 core/原生 Kon 的键相等规则一致，由共享的类型化元组索引承接，保留适配层各自公开形态。

## 约束

- 约束-1: AT1 的输入不变、显式依赖、单向分层与请求隔离成立。
- 约束-2: 不改 codument 和外部 Java/基础库，不恢复用户已外迁的业务领域，不移植企业平台。
- 约束-3: 新包使用契约/logic/support 的真实职责，复用当前 kunun、数据与 XLSX/XML 原语；旧公开能力保持回归。

## Acceptance

- [x] 期望-1、期望-2 → `bun test packages/core packages/kon-spl-dsl packages/web-server` → 行为回归含正向样例、空输入、错误边界和输入不变，全部通过（内存或隔离测试写入）。
- [x] 约束-1、约束-3 → `bun run build` → 构建或 typecheck 全部 exit 0；独立重读依赖确认核心未越界（本地构建）。
- [x] 约束-1 → `! rg -n 'node:fs|Bun\.file|new Function|eval\(' packages/report-logic/src` → 纯报表逻辑无 IO 或隐式 JS 求值（只读负向检查；计算 mission 同时核对新建的键工具为纯逻辑）。
- [x] 约束-2 → `test "$(git diff -- codument | shasum -a 256 | cut -d ' ' -f 1)" = 7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049 && test "$(git ls-files --others --exclude-standard codument | shasum -a 256 | cut -d ' ' -f 1)" = 1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e` → 历史轨迹与原始基线一致（只读负向检查）。

- [x] 期望-3 → `bun test packages/expression packages/core packages/kon-spl-dsl` → 混合类型/分隔符/大小写的跨路径回归一致（内存测试）。

## 范围外

- nop-entropy 企业应用框架、PDF/Word/图表/图片渲染、宏、公式通用计算器。
- esProc 全部外部连接器、分布式服务器、数值建模算法与原 Java Excel 计算格 IDE；其缺口保留在来源盘点与后续 backlog。
