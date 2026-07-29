# 包处置

基线与 legacy role 差异归 [runtime 包边界](../inventory/runtime.md#包边界)，本轮不作无行为收益的全量重命名。

| 边界 | 动作 | target role / 名称 | 说明 |
|---|---|---|---|
| 现有计算与表达式包 | keep + bugfix | 沿用名称 | 保持公开 API 与回归；D6 |
| Kon DSL | keep + extend | 沿用 adapter/logic | 新 window 消费 core public API；D6 |
| spl-flow 表格输入 | keep + extract parser seam | 沿用混合旧包 | 统一 CSV，避免再复制 split parser；D5 |
| 报表类型 | add-contract | depa-data-report-contract | 模板/编译/渲染值、runtime evaluator、codec port，无实现依赖 |
| 报表展开 | add logic | depa-data-report-logic | 只依赖 contract，处理编译、父格与实例，不直接 IO |
| XLSX/HTML | add support | depa-data-report-xlsx-support | 实现 contract 的 bytes codec，保留原 OOXML，与值/样式显示投影 |
| HTTP 与 Vue | keep + extend | 现有 private shell | 显式组合公开 report 逻辑与 support，不强造空 capsule |
| 外迁领域包 | keep retired | 外部仓库 public packages | 不恢复、不重建已外迁能力 |

新依赖方向：shell → logic / support → contract；logic 不反向依赖 support，support 不触 logic internals。没有第二实现也不为分发而建注册表。
