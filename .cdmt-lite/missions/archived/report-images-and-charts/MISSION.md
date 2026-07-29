# Mission: Excel报表图片条码与图表

终点: RP12–14在动态sheet和明细展开后生成正确图片anchor/字节及独立chart引用/cache，显式条码端口代替Java容器，真实XLSX与HTML可验证。

## Attractors

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 结构/效果 | [attractors/media-projection.md](attractors/media-projection.md) | 媒体来源、实例、效果与part隔离 | 计划 / 决策 / 实现 / 校验 | 1 |

## Notes

- 使用depa-expert与cdmt-mission-lite。命名候选report-images-and-charts、report-drawing-projection，选前者。
- 源头库存RP12–14：ExcelToXptModelTransformer.parseImageModel/parseChartModel、ExpandedSheetEvaluator.genImage、ExpandedSheetChartGenerator、ReportExtFunctions.QRCODE。
- 需要改造：读drawing为声明、按最终格实例生成媒体、显式字节/条码端口、独立drawing/chart part与关系；复用前序reference projection。
- 最终暴露：XLSX图片描述----后的testExpr/dataExpr及图表binding；规范化模板图片/图表数据；pure process patch image及QRCODE适配。宿主拥有输入bytes及生成端口，不读任意服务路径。
- 本地合成模板与图片，依赖安装仅写工作区包及忽略node_modules；不发布、不改源仓库。

## 期望结果

- 期望-1: B2图片在两行×两个sheet中生成四个独立anchor，保留offset/size，test false不出，dataExpr替换bytes；HTML显示与XLSX引用一致。
- 期望-2: 显式renderBarcode请求携带内容/格式/尺寸，QRCODE或纯image patch可用于当前格，空值不出图；两记录生成不同有效PNG并验证尺寸/签名，默认QR/条码适配可用。
- 期望-3: 图表East/2 West/5输出类别和值范围及cache两点；sheet标题/series/category/axis声明可求值，条件过滤，两个sheet的chart part不共享可变内容，静态样式保留。

## 约束

- 约束-1: AT1成立；logic无IO/JS eval，不恢复BeanContainer，字节/编码由support或窄runtime端口；请求无跨sheet可变cache。
- 约束-2: 输入不变、源仓库/旧codument不写；未知媒体形态定位诊断，图片内容和文档关系有资源界限。

## Acceptance

- [x] 期望-1、期望-2、期望-3、约束-2 → `bun test packages/report-logic packages/report-xlsx-support packages/web-server` → 真实ZIP媒体/anchor/chart引用cache及HTML、PNG尺寸与字节、输入不变通过（本地合成数据）。
- [x] 期望-1、期望-2、期望-3 → `bun test` → 全量回归exit0（隔离资源，不与相关测试并行）。
- [x] 约束-1 → `bun run build` → 全部包成功；runtime效果与关系owner重读（本地dist）。
- [x] 约束-1 → `! rg -n 'node:fs|Bun\.file|new Function|eval\(' packages/report-logic/src` → 无隐藏IO/eval、无Java服务容器（负向）。
- [x] 约束-2 → `git diff -- codument | shasum -a 256` → 仍7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049；untracked仍1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e。

## 范围外

- 独立PDF/Word、企业平台；完整Excel图表交互编辑器非来源已证明行为，既有chart XML样式保留且数据引用必须正确。
