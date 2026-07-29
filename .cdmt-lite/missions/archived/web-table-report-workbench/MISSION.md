# Mission: 网页表格与报表工作台

终点: 用户可在网页导入 CSV/JSON/XLSX 表格、供 Kon 计算，并以 Excel 模板渲染当前结果、预览和下载报表。

本文件是期望态权威；状态见 [loop.md](loop.md)，证据见 [evidence.md](evidence.md)。

## Attractors

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 结构 | [attractors/explicit-projection.md](attractors/explicit-projection.md) | 输入 authority、显式依赖与投影关系 | 计划 / 决策 / 实现 / 校验 | 1 |

## Notes

- 每轮加载 skill：cdmt-mission-lite、depa-expert。
- 资源控制来自 esproc E23 的同步不可中断证据，作为真实文件链路的必要补充，不引入分布式调度。
- 来源证据：[分析工作区](../../../../.depa-analysis/porting-2026-10-22/manifest.md)。
- 命名候选：web-table-report-workbench、web-table-report-workbench-port；选择前者，避免无语义编号。
- 源头库存：当前 KonIde 与 execute-kon API、表格 datasource 和新增报表程序化 API。
- 需要改造：请求内数据源绑定、文件输入、报表请求与下载 UI；服务器只适配公开能力。
- 最终暴露：网页导入表格、Kon 继续计算、模板预览、XLSX 下载；不新增企业应用面。
- 用户已授权按路线顺序执行；前序 mission 验收后直接激活，不重复询问。
- 命令从仓库根执行；测试仅用本地隔离或内存资源，构建输出到忽略的 dist。

## 期望结果

- 期望-1: 用户可在网页导入 CSV/JSON/XLSX 表格、供 Kon 计算，并以 Excel 模板渲染当前结果、预览和下载报表。
- 期望-2: 新能力有来源可追溯的行为回归、使用示例与明确支持边界。

- 期望-3: Web 的 Kon 与报表计算可在独立 worker 中终止，具有实际时限与输入/输出边界，超时后下次请求仍可正常工作。

## 约束

- 约束-1: AT1 的输入不变、显式依赖、单向分层与请求隔离成立。
- 约束-2: 不改 codument 和外部 Java/基础库，不恢复用户已外迁的业务领域，不移植企业平台。
- 约束-3: 新包使用契约/logic/support 的真实职责，复用当前 kunun、数据与 XLSX/XML 原语；旧公开能力保持回归。

## Acceptance

- [x] 期望-1、期望-2 → `bun test packages/web-server packages/kon-spl-dsl packages/web-ide` → 行为回归含正向样例、空输入、错误边界和输入不变，全部通过（内存或隔离测试写入）。
- [x] 约束-1、约束-3 → `bun run build` → 构建或 typecheck 全部 exit 0；独立重读依赖确认核心未越界（本地构建）。
- [x] 约束-1 → `! rg -n 'node:fs|Bun\.file|new Function|eval\(' packages/report-logic/src` → 纯报表逻辑无 IO 或隐式 JS 求值（只读负向检查；计算 mission 同时核对新建的键工具为纯逻辑）。
- [x] 约束-2 → `test "$(git diff -- codument | shasum -a 256 | cut -d ' ' -f 1)" = 7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049 && test "$(git ls-files --others --exclude-standard codument | shasum -a 256 | cut -d ' ' -f 1)" = 1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e` → 历史轨迹与原始基线一致（只读负向检查）。

- [x] 期望-3 → `bun test packages/web-server/__tests__/execution-limits.test.ts` → 实际循环超时、取消与恢复通过（隔离 worker 测试）。

## 范围外

- nop-entropy 企业应用框架、PDF/Word/图表/图片渲染、宏、公式通用计算器。
- esProc 全部外部连接器、分布式服务器、数值建模算法与原 Java Excel 计算格 IDE；其缺口保留在来源盘点与后续 backlog。
