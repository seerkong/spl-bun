# Mission: SPL类型解析与选项转换

终点: 已接纳CANDIDATE-parse：默认布尔/null/数值/安全JSON/明确日期及q/e/n来源优先级、首段引号与数字前缀，复用精确数字和安全JSON原语；不支持协议明确失败，不引入eval。

## Attractors

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 结构/语义 | [attractors/shared-semantics.md](attractors/shared-semantics.md) | 纯共享语义与输入权威 | 计划/决策/实现/校验 | 1 |

## Notes

- 使用depa-expert与cdmt-mission-lite；gap-loop未启用，外部workflow Verify/Review独立裁决。名字候选为spl-parse-conversion与spl-parse-conversion-parity，选前者。
- 源头库存：Parse.calculate、Variant.parse/parseNumber、Sentence/StringUtils；需要改造：数字regex和不完整q/e/n；最终暴露：共享纯parse转换、原builtins.parse及Expression/Kon/Flow，不恢复Java容器或动态eval。
- 接纳来自本次continuationDirective，实际implement generation5/graph_revision6；授权为spl-bun目录级，逐文件允许集从未冻结，观察变更另记。排序后再实现parse，最后回归与独立Review。

## 期望结果

- 期望-1: 已接纳CANDIDATE-parse：默认布尔/null/数值/安全JSON/明确日期及q/e/n来源优先级、首段引号与数字前缀，复用精确数字和安全JSON原语；不支持协议明确失败，不引入eval。
- 期望-2: 真实源方法oracle与共享公开入口实值一致，边界/目标协议与Java完整运行的区别准确记录。

## 约束

- 约束-1: AT1成立，保留既有formatting/报表规则与产品入口。
- 约束-2: 原dirty与历史收据保留，不改旧Codument、源Java、外部库或恢复企业/domain/ORM；不commit/reset/clean/push/publish。

## Acceptance

- [x] 期望-1、期望-2、约束-1 → `bun test packages/expression/__tests__/parse-conversion.test.ts packages/kon-spl-dsl packages/spl-flow` → 具体实值、非法协议、精度/字段遮蔽/输入不变与懒分支负例通过（隔离本地数据）。
- [x] 期望-1、期望-2 → `bun .cdmt-lite/missions/archived/spl-parse-conversion/verification/source-parse-oracle.ts` → 实际Java源码方法对照通过、窄stub与适配明确、临时目录清理。
- [x] 约束-1、约束-2 → `bun test` 与 `bun run build` → 全量回归和13包构建通过（仅忽略构建产物）。
- [x] 约束-1 → `SPL_E2E_FRONTEND_PORT=4394 SPL_E2E_BACKEND_PORT=4396 bun run test:e2e` → 17产品用例通过（隔离DB/端口）。
- [x] 约束-1、约束-2 → 纯报表核心IO/eval负向与Codument保护哈希核对 → 无命中，原两项哈希保持。
- [x] 期望-1、期望-2、约束-1 → 外部workflow独立Verify/Review → 原run graph8的Verify7 passed、Review7 complete/C1–C10 met/gaps空，明确关闭parse及G2；登记见E10与[已准入评审](verification/closeout-20261024/accepted-review.json)，不是实施者自批。

## 范围外

- 任意Java类型/脚本/locale数据库完全互操作、外排/分布式执行器、企业平台及已外迁domain/ORM。有限协议之外保留明确诊断或准确未实现边界，不借其宣称全面对齐。
