# Mission: SPL表转换与关联算子

终点: 查询数据层拥有真实pivot/unpivot、六种等值join，以及旧迁移遗留的有限表结构与分段分组能力；core/member/Kon同一实现通过数值与schema验收，再进入cursor资源链。

## Attractors

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 领域/结构 | [attractors/table-values.md](attractors/table-values.md) | 纯表值、类型键、入口共用和schema | 计划 / 决策 / 实现 / 校验 | 1 |

## Notes

- 使用depa-expert与cdmt-mission-lite；候选spl-dataset-operators、spl-table-transformations，按路线选前者。
- 源头库存：spl-inventory S13/S14/S16，Sequence.pivot/unpivot/full/groupc/groupi及旧轨迹只读取证。
- 需要改造：缺少pivot/unpivot和更多join；member/core现join实现重复；rename/alter/index与相邻分段没有公开入口。
- 最终暴露：core DataSet、expression成员和Kon原生word调用同一纯表值处理器；选项通过明确spec/Conf表达，不复刻Java参数糖。pivot指定group keys/category/value/columns/reducer；重复默认报错，显式sum得到15/20/7。unpivot明确null策略。纯join实现移到双方可依赖的expression表值模块，core继续拥有DataSet外观，无循环依赖/全局注册回写。

## 期望结果

- 期望-1: pivot A-Jan10/5、A-Feb20、B-Feb7得A[15,20]/B[null,7]，unpivot默认三行/总42，可保留null四行；类型键、稳定列序、空表schema、未知列和别名冲突均有断言。
- 期望-2: L[1,1,2]/R[1,3]的inner/left/full/semi/anti/right基数2/3/4/2/1/3；2×2重复匹配4、左右空表、Date/null/missing/type与右孤儿字段/schema/顺序正确，三入口一致。
- 期望-3: rename/alter/index为显式纯值操作，冲突与类型查找可诊断；相邻[A,A,B,A]分三段、普通group两组，条件分组按明确目标契约。旧SPL与报表回归保持。

## 约束

- 约束-1: AT1成立，输入不变、同名算子单一实现、没有隐藏文件IO/动态JS求值/跨请求cache。
- 约束-2: 不修改源仓库/旧Codument/外迁domain，不搬入企业模块或用报表展开代替表转换；cursor/file资源另mission继续。

## Acceptance

- [x] 期望-1、期望-2、期望-3、约束-1 → `bun test packages/core packages/expression packages/kon-spl-dsl` → 表值数值/基数/类型/顺序/输入不变及非法字段负例全部通过（本地合成表）。
- [x] 期望-1、期望-2、期望-3、约束-2 → `bun test` 与 `bun run build` → 全量及13包构建通过。
- [x] 约束-1 → `! rg -n 'node:fs|Bun\.file|new Function|eval\(' packages/expression/src/table-transform.ts` → 纯值处理器无隐藏IO；类型碰撞和schema冲突负例通过。
- [x] 约束-2 → Codument diff/untracked SHA256分别保持7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049与1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e。

## 范围外

- Java完整DataStruct/外键索引族、range/as-of/外排/分布式join、全部option语法；不将有限目标冒称所有Java表函数兼容。
