# Mission: SPL表达式与多键稳定排序

终点: 已接纳CANDIDATE-sort：共享行表达式/多键稳定排序、@z/@0和保留记录的层次稳定聚拢@u；兼容旧列名/desc入口，未知字段/选项和不可比较类型明确诊断，输入不变。

## Attractors

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 结构/语义 | [attractors/shared-semantics.md](attractors/shared-semantics.md) | 纯共享语义与输入权威 | 计划/决策/实现/校验 | 1 |

## Notes

- 使用depa-expert与cdmt-mission-lite；gap-loop未启用，外部workflow Verify/Review独立裁决。名字候选为spl-stable-expression-sort与spl-stable-expression-sort-parity，选前者。
- 源头库存：Sequence.sort/sort_u及CommonComparator、旧排序spec；需要改造：仅列名+asc/desc、无row AST/选项/字段诊断；最终暴露：Expression成员sort、Kon spl_eval/原生列排序、Flow共用处理器。
- 接纳来自本次continuationDirective，实际implement generation5/graph_revision6；授权为spl-bun目录级，逐文件允许集从未冻结，观察变更另记。排序后再实现parse，最后回归与独立Review。

## 期望结果

- 期望-1: 已接纳CANDIDATE-sort：共享行表达式/多键稳定排序、@z/@0和保留记录的层次稳定聚拢@u；兼容旧列名/desc入口，未知字段/选项和不可比较类型明确诊断，输入不变。
- 期望-2: 真实源方法oracle与共享公开入口实值一致，边界/目标协议与Java完整运行的区别准确记录。

## 约束

- 约束-1: AT1成立，保留既有formatting/报表规则与产品入口。
- 约束-2: 原dirty与历史收据保留，不改旧Codument、源Java、外部库或恢复企业/domain/ORM；不commit/reset/clean/push/publish。

## Acceptance

- [x] 期望-1、期望-2、约束-1 → `bun test packages/expression/__tests__/sort-semantics.test.ts packages/kon-spl-dsl packages/spl-flow` → 具体实值、非法协议、精度/字段遮蔽/输入不变与懒分支负例通过（隔离本地数据）。
- [x] 期望-1、期望-2 → `bun .cdmt-lite/missions/active/spl-stable-expression-sort/verification/source-oracle.ts` → 实际Java源码方法对照通过、窄stub与适配明确、临时目录清理。
- [x] 约束-1、约束-2 → `bun test` 与 `bun run build` → 全量回归和13包构建通过（仅忽略构建产物）。
- [x] 约束-1 → `SPL_E2E_FRONTEND_PORT=4394 SPL_E2E_BACKEND_PORT=4396 bun run test:e2e` → 17产品用例通过（隔离DB/端口）。
- [x] 约束-1、约束-2 → 纯报表核心IO/eval负向与Codument保护哈希核对 → 无命中，原两项哈希保持。
- [x] 期望-1、期望-2、约束-1 → 已准入独立gap-review generation5/hash=3704820b20202e14ccc16e1f5adca2f5dfb45664b50693dc5e808dc540517de3 → 原CANDIDATE-sort整改通过，可关闭；该裁决限于本排序mission，不核销尚未通过的parse。

## 范围外

- 任意Java类型/脚本/locale数据库完全互操作、外排/分布式执行器、企业平台及已外迁domain/ORM。有限协议之外保留明确诊断或准确未实现边界，不借其宣称全面对齐。
