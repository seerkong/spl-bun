# Mission: 报表文档引用投影

终点: 同一份来源格到输出实例映射驱动公式、超链接和Excel文档元数据，展开/删除/动态sheet后引用及关系保持有效；RP11/15–20/26通过真实XLSX验收。

## Attractors

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 结构/身份 | [attractors/reference-projection.md](attractors/reference-projection.md) | 坐标与关系一致性 | 计划 / 决策 / 实现 / 校验 | 1 |

## Notes

- 每轮加载depa-expert、cdmt-mission-lite。命名候选report-document-reference-projection、report-metadata-relocation；选前者。
- 源头库存：report-inventory RP11/15–20/26及nop-excel/OOXML writer、ExcelReader。纯schema不冒称运行引擎。
- 需要改造：普通A1重写仅支持单sheet，codec动态元数据一律拒绝；改为统一reference projection、shared展开、保留array边界、metadata重定位。
- 最终暴露：现有Excel模板与公开ReportTemplate/RenderedReport输入，窄纯投影API；支持超链接和现有文档结构保真。不恢复企业平台。
- 本地合成数据；命令写忽略dist/隔离测试资源。相关测试不能与全量并行。

## 期望结果

- 期望-1: 源格→输出实例投影支持复杂二维/inplace、删除、跨sheet重命名；普通公式和共享公式正确复制，数组边界有可验证保真和明确诊断。
- 期望-2: 链接（静态及表达式）、validation/CF引用与公式、definedNames/localSheetId/Print_Area/Print_Titles、分页、freeze selection/保护、富文本/空样式格在真实ZIP中正确。
- 期望-3: autoFilter与table part范围/ID/relationships随sheet克隆和明细增长更新，输入模板不变；未知扩展仅定位拒绝受影响part，不能拒全部已支持结构。

## 约束

- 约束-1: AT1成立；logic无IO/JS eval、无第二引用权威，codec仅应用投影。
- 约束-2: 不写旧codument及源仓库，不恢复企业平台；HTML链接不执行不安全scheme。

## Acceptance

- [x] 期望-1、期望-2、期望-3、约束-2 → `bun test packages/report-logic packages/report-xlsx-support packages/web-server` → 坐标/公式/链接与ZIP关系真实回读通过，危险URL不生成可执行链接、模板不变（本地合成数据）。
- [x] 期望-1、期望-2、期望-3 → `bun test` → 最宽相关回归全部通过（隔离资源）。
- [x] 约束-1 → `bun run build` → 所有包成功，公开依赖与投影owner重读（忽略dist）。
- [x] 约束-1 → `! rg -n 'node:fs|Bun\.file|new Function|eval\(' packages/report-logic/src` → 无隐藏IO/JS eval（负向）。
- [x] 约束-2 → `git diff -- codument | shasum -a 256` → 仍7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049；untracked清单仍1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e。

## 范围外

- 独立PDF/Word、企业容器/ORM/权限；drawing/chart为下一mission，仍属于整体目标。
