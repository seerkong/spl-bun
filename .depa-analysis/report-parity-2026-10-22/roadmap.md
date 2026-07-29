# 表格报表优先、SPL 随后的执行路线

用户已授权依次实施至对齐；以下是范围分配和依赖导航，不维护第二份执行状态。当前节点、验收和证据只看 `.cdmt-lite/missions/` 中同名 mission 的四件 harness。每个里程碑后继续下一项，不能把旧 unsupported 或本批边界当整体停止条件。

| 顺序 / mission 名称 | 对齐范围 | 来源与结果 oracle |
|---|---|---|
| report-formula-evaluation | 实例化后依赖求值、层次坐标、严格聚合、过滤、懒宏、原生公式cache与公式导出 | formula-inventory F/G/M/X；N01–N12；财务Q06的4100、排名13与2003首月累计3100；Q04值4/5/6及对应公式 |
| dynamic-report-sheets | 配套配置表、循环/名称、固定封面、作用域、来源身份、全局去重、OOXML sheet克隆 | report-inventory RP01/02；17号苹果/香蕉DS-1/2/3 |
| report-layout-and-cell-processing | inplace、兄弟空间复用、行特有列、多行布局、隐藏/删除、样式/显示/导出值、配置解析与上下文字段展开、显式cell patch | RP03–10/21/22/24，模板13及2/3/4项TAIL边界 |
| report-document-reference-projection | 统一坐标投影、超链接、validation/CF/名称/打印、富文本、冻结保护、原表格范围与共享公式保真 | RP11/15–20/26；真实ZIP节点与XLSX回读，不只看静态part存在 |
| report-images-and-charts | 图片/条码显式端口、实例anchor、drawing/chart克隆、series/title/category表达式与cache | RP12–14；两个sheet×两行图片、图表East/2 West/5 |
| report-parity-acceptance | 表格报表全矩阵复核、缺口修正、Web整链路和文档；规范化模板/XML边界及cellSet公共适配 | RP01–26及formula矩阵，不允许未验证的SOURCE_RUNTIME留为完成；企业框架与独立PDF/Word不迁入 |
| spl-expression-semantics | 源Variant真值/count、逻辑短路、序列运算、聚合/派生/类型/错误一致性 | spl-inventory H/P/S；优先旧承诺的可复现错误 |
| spl-dataset-operators | pivot/unpivot、更多关联与标准Kon公开入口 | spl-inventory A2/A3；空值/重复键/多类型/输入不变 |
| spl-cursor-resources | 真实惰性cursor、背压与close/cancel、资源边界和旧迁移查询能力最终对账 | spl-inventory A4/A5；有界消费而非SQL分页冒充cursor |

## 架构收敛

请求模板/数据/参数仍是不可变输入。编译声明、sheet/格实例、求值依赖和文档引用是请求内投影；最终坐标和sheet展示名不能反向成为来源身份。报表表达式只调用显式evaluator或窄效果端口，codec实现字节/ZIP/XML/图像编解码。不同请求或不同动态sheet之间不共享可变计算cache。

直接复用现有 XLSX.CFB、fast-xml-parser、SSF、数据与表达式公共接口。报表专用层次语义、Number-only聚合和依赖图属于report logic，不通过修改SPL全局函数来“凑结果”。Java/XLang数据构造、dict provider、QR服务改为Kon/SPL预处理、显式输入或端口；不恢复BeanContainer/VFS/ORM/权限平台。

## 已确认的兼容决策

- 原有物理Excel复制语义保持；report模式及Nop配置模板用实例集合语义，值和导出引用共用selector。
- 不复刻上游absolute单格选错名称、循环半成品cache和跨模板sheet名称碰撞三个已证缺陷。
- ACCSUM采用同源实例顺序的确定prefix，避免重复引用再次累加；与源可变累加器的差异必须公开说明并验证来源财务输出不变。
- Java数字类型细分映射JS number；Nop NaN结果需在XLSX/HTML呈现明确错误状态，不能静默变为null成功值。
- 条件通配符支持完整`*`/`?`，作为修复上游simple-pattern不完整的明确适配，不声称逐字复制源缺陷。

## 停止判定

必须先完成表格报表对应来源矩阵的行为验收及负向边界，再进入SPL阶段。源只有schema或未证明运行消费的项目，需要明确保真测试与准确声明，不能把它们冒称源已实现，也不能用它们掩盖真实运行能力缺口。剩余可做节点不构成停止条件；只按cdmt-mission-lite §7返回。
