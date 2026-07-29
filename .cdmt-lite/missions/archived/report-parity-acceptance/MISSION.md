# Mission: 表格报表能力总对账

终点: 对RP01–26及公式矩阵逐项重观察，修复实际运行缺口，完成网页上传→Kon计算→动态报表→HTML/XLSX产品验收，再进入SPL查询计算gap。

## Attractors

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 结构/兼容 | [attractors/report-parity.md](attractors/report-parity.md) | 来源能力与显式目标适配、证据覆盖 | 计划 / 决策 / 实现 / 校验 | 1 |

## Notes

- 使用depa-expert和cdmt-mission-lite。名称候选report-parity-acceptance、report-surface-reconciliation；选前者。
- 源头库存：report-inventory RP01–26、formula-inventory F01–12/G01–19/M01–07/X01–08/Q01–06；旧codument只读。
- 需要改造：M04 cellSet公共成员与M05 view别名/M06显式runtime入口尚缺；删除后相对layer使用旧expandIndex存在错选；补最终Web真链路和来源矩阵证据。
- 最终暴露：保留XLSX批注/描述与规范化ReportTemplate值输入、公开纯report表达式与runtime API适配，不引入XDSL/VFS/Java容器；SPL/Kon继续作为数据准备语言。
- 相关测试与全量不能并行，E2E使用独立4294/4296与忽略DB，不动其他端口/服务；文档只解释真实格式边界，不用unsupported排除来源已证明运行语义。

## 期望结果

- 期望-1: cellSet成员get/firstCell/lastCell/cellRanges/map/filter/flatMap/rowChildSet/colChildSet/realCells及只读cell别名与显式cells/eval/expand入口有等价目标API；值与Excel导出语义准确区分。
- 期望-2: 删除首项后的relative+0仍选自身，relative-1选前一保留实例；跨sheet、样式/显示/媒体/引用组合保持正确。规范化模板与raw xpt.xml格式边界明确，不借企业DSL缺席遮盖渲染gap。
- 期望-3: RP/公式全矩阵有代码/实测结果/适配决策，Web动态多sheet/公式/格式/删除/图片下载和无过时结果全部通过；报表目标无未验证SOURCE_RUNTIME缺口后才进入SPL。

## 约束

- 约束-1: AT1成立；无隐藏IO/JS eval，来源输入不反写、衍生值无跨请求cache、公共方法有明确权限边界。
- 约束-2: 保留用户既有dirty改动，codument与源仓库不写；不恢复企业平台或完整Excel/图表交互编辑器。

## Acceptance

- [x] 期望-1、期望-2、期望-3、约束-2 → `bun test packages/report-logic packages/report-xlsx-support packages/web-server` → 成员/别名/layer反例与组合报表通过（本地合成数据）。
- [x] 期望-3 → `bun run test:e2e` → Web产品全部过线，下载XLSX回读与iframe媒体解码有效（隔离端口/DB）。
- [x] 期望-1、期望-2、期望-3 → `bun test` → 全量通过；`bun run build` → 13包全部成功（隔离资源/dist）。
- [x] 约束-1 → `! rg -n 'node:fs|Bun\.file|new Function|eval\(' packages/report-logic/src` → 无隐藏IO/JS eval；多基数、循环、非法member/patch和输入不变负例通过。
- [x] 约束-2 → `git diff -- codument | shasum -a 256` → 仍7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049；untracked仍1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e。

## 范围外

- 企业平台/Java XLang容器、独立PDF/Word；SPL查询计算属于后续已授权mission，完成后继续，不构成整体返回条件。
