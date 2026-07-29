# Mission: 报表空间布局与单元格处理

终点: 对照nop-report补齐预留区原位展开、兄弟空间复用、依赖另一轴的展开以及可见性/样式/显示值处理，来源矩阵RP03–10/21/22/24有可观测等价结果。

本文件是期望态权威；状态见 [loop.md](loop.md)，证据见 [evidence.md](evidence.md)。

## Attractors

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 结构/身份 | [attractors/instance-layout.md](attractors/instance-layout.md) | 实例身份、几何投影、原值/展示分离 | 计划 / 决策 / 实现 / 校验 | 1 |

## Notes

- 每轮加载cdmt-mission-lite、depa-expert。用户已授权完整路线，前序动态sheet完成后直接实施；完成仍继续文档引用和图片图表。
- 命名候选report-layout-and-cell-processing、report-spatial-projection；选前者。
- 源头库存：report-inventory RP03–10/21/22/24；CellRow/ColExpander、TableExpander、ExpandedSheetEvaluator、MultiLineConfigParser。
- 需要改造：单一独立rows×cols不足以表示依赖展开；新增实例空间分配、原位overlay和兄弟共享，后处理明确隐藏/删除、样式/显示/导出值。
- 最终暴露：既有Excel批注字段及规范化ReportTemplate输入，仍经显式SPL/Kon runtime；纯cell patch取代Java服务脚本。
- 命令仓库根运行，合成模板/本地测试，构建仅写忽略dist。

## 期望结果

- 期望-1: inplace预留3格，2/3项TAIL不移、4项TAIL仅移1；同父3项/2项兄弟只占3行；多行段父锚在中间正确；两设备不同文档列不做全集笛卡尔展开，行列对称。
- 期望-2: row/col test删除与hidden分开，删除后最终坐标/合并/公式一致；styleIdExpr不改共享style，raw/display/export显式分离；纯处理patch有边界。
- 期望-3: 三引号多行配置、field上下文数组/标量/null展开及既有Kon/SPL表达式保持正确；HTML/XLSX与完整公式/动态sheet回归通过。

## 约束

- 约束-1: AT1成立；logic无IO/JS eval和隐式容器，效果端口显式，codec不裁决领域值。
- 约束-2: 输入不变、请求/sheet隔离、稳定来源身份，旧codument与外部仓库不改，不恢复企业平台。

## Acceptance

- [x] 期望-1、期望-2、期望-3、约束-2 → `bun test packages/report-logic packages/report-xlsx-support packages/web-server` → RP数值/几何、真实XLSX回读、HTML、输入不变与错误位置通过（本地合成数据）。
- [x] 期望-3 → `bun test` → 最宽相关回归全部通过（隔离资源；不可和上条并行以免旧固定路径DB竞态）。
- [x] 约束-1 → `bun run build` → 所有包成功，重读依赖与runtime公开边界（本地dist）。
- [x] 约束-1 → `! rg -n 'node:fs|Bun\.file|new Function|eval\(' packages/report-logic/src` → 无隐藏IO/JS eval；几何反例无错合并/身份丢失（负向）。
- [x] 约束-2 → `git diff -- codument | shasum -a 256` → 仍为7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049；untracked清单仍为1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e（只读负向）。

## 范围外

- 企业平台与独立PDF/Word。
- 文档引用与图片图表在后续mission完成，依旧属于整体目标，不能以本mission通过终止。
