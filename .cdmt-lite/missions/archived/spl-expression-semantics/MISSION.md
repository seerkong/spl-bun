# Mission: SPL表达式与聚合语义对齐

终点: 修复旧迁移已承诺且能改变查询结果的语义差异，使core/member/Kon/flow入口得到一致值、schema和诊断，再继续表算子与资源mission。

## Attractors

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 语义/结构 | [attractors/query-semantics.md](attractors/query-semantics.md) | 纯语义单一归约、输入与投影边界 | 计划 / 决策 / 实现 / 校验 | 1 |

## Notes

- 使用depa-expert和cdmt-mission-lite；候选spl-expression-semantics、spl-semantic-convergence，按路线选前者。上个报表mission已全量归档。
- 源头库存：spl-inventory S06–12/S15/S20及Variant/Count/ICount/And/Conj/AvgValue/Sequence.derive源码，旧Codument只读。
- 需要改造：truth/count/icount、AST lazy branches、conj；null归约、empty global group、derive可见性、已知schema绑定、复合聚合、legacy CSV/JSON输入。
- 最终暴露：现有expression/core/Kon/flow公开入口共享纯规则；SPL真值与Nop报表布尔规则分开。Java数字类型统一JS number、对象按引用/Date按epoch的既有键契约保留；不执行Java脚本或恢复企业模块。

## 期望结果

- 期望-1: 0与空串为真、false/null/undefined为假，count([0,"",false,null])=2且各入口一致；icount保留类型与Date去重；逻辑与if未选分支零调用，连列保持次序重复。
- 期望-2: avg([10,null])各入口=10，全null为空；全表空聚合一行、分组空表零行且schema保留；derive同批可见性有明确一致契约；复合sum(a)/sum(b)=7.5；已知表缺列报字段/表达式/step，声明稀疏列合法。
- 期望-3: legacy CSV/JSON和Kon使用一致解析/类型策略，后行新增列与空查询表头保留；临时DB在成功/错误均释放；报表产品与旧迁移计算回归保持。

## 约束

- 约束-1: AT1成立；输入不反写，无全局可变计算cache，已有报表Number-only/truth语义不被SPL改变。
- 约束-2: 不修改源仓库/旧Codument，不覆盖用户dirty内容，不恢复domain/ORM/企业平台；真实cursor和更多表算子按后续mission继续。

## Acceptance

- [x] 期望-1、期望-2、期望-3、约束-1 → `bun test packages/expression packages/core packages/kon-spl-dsl packages/spl-flow packages/report-logic` → 真值/分支调用/入口一致性/输入不变与report回归通过，本地合成数据与临时DB。
- [x] 期望-1、期望-2、期望-3、约束-2 → `bun test` 与 `bun run build` → 全量测试及13包构建通过，生成物只在忽略目录。
- [x] 约束-1 → `! rg -n 'node:fs|Bun\.file|new Function|eval\(' packages/report-logic/src` → 核心无隐藏IO/eval；类型键、未选分支、未知列与输入不变负例通过。
- [x] 约束-2 → `git diff -- codument | shasum -a 256` 仍7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049，untracked仍1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e。

## 范围外

- Java全函数/完整locale与BigDecimal、原脚本DataStruct及所有option互操作；未验证范围在最终兼容说明逐项列明，不冒称全量Java兼容。
- pivot/join与cursor/file effect属于随后已授权mission，仍须继续。
