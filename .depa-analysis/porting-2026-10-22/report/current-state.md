---
status: active
last_verified: 2026-10-22
scope: system/package
depth: standard
---

# 移植基线与续作路线

## 执行摘要

当前项目是可运行的 Kon 查询/计算 IDE，基线 306 测试、typecheck 和十包构建通过。Excel 目前只承担表格 IO，网页上传和模板报表路径都缺席。直接用现有 workbook writer 重建会丢模板样式；报表应基于原 OOXML、纯渲染计划与请求内数据。序表还存在可复现的键编码和窗口累计错误，Kon 未公开已有窗口能力。来源见 [runtime](../inventory/runtime.md)、[nop-report](../inventory/nop-report.md)、[esproc](../inventory/esproc.md)。

## 范围与深度

按 [scope](../scope.md) 执行标准深度的系统/包边界分析；独立盘点，不宣称穷尽所有函数语义。nop-entropy 仅提取 Excel 模板报表；业务领域外迁保留，codument 只读。

## DEPA 四维符合度

| 维度 | 结论 | 来源 |
|---|---|---|
| Data | 请求 runtime 和投影已有边界；typed key 与报表记录身份是重点 | runtime F1–F7；nop NR-11/12；esproc 计算缺口 |
| Effect | 现有文件 IO 混在 flow；新内核将显式分离 bytes codec 与 evaluator | runtime P5–P7；nop NR-23/28 |
| Processor | Kon 用原生注册表，可继续适配 core；新报表无须企业容器 | runtime P4；nop NR-27 |
| Actor | 同步报表内核不适用；浏览器异步响应需要来源版本关联 | runtime I5 |

EventSourcedStateProfile 为 NOT_APPLICABLE；没有 canonical event authority。报表父格图不激活 ReactiveDataGraphProfile；Vue refs 激活页面局部 profile，旧响应关联的 GAP 随工作台修复。依据为 [runtime](../inventory/runtime.md#事实节点) 与 [nop-report](../inventory/nop-report.md#data--effect--processor--actor-边界)。

Package role overlay：旧命名差异登记但本批不作全量重命名；新包按 contract/logic/support，shell 只组合。详见 [包处置](../convergence/package-disposition.md)。

## 事实源边界发现

模板/数据/源码是请求输入；计划、实例、表格和报表文件是可重建投影。没有证实 authority 冲突；应避免新渲染反写模板、丢同源记录身份或把格式文本当数值。详见 [fact-roles](../boundary/fact-roles.md)、[single-writer](../boundary/single-writer.md)、[risks](../boundary/backwrite-risks.md)。

## 关键问题

| 问题 | 影响 | 证据 |
|---|---|---|
| 网页文件与模板报表链路缺席 | 用户目标无入口 | runtime I1 |
| 重建 Excel 丢样式，坐标变化可能破坏保留的结构 | 模板文件能打开仍可能错报表 | runtime I2/I3；nop NR-14/20–22/26 |
| 简单 CSV split 不支持 quoted/newline | 上传数据被静默截断 | runtime I4 |
| 分组/关联拼串与独立窗口累计错误 | 结果错误而当前测试仍绿 | esproc 复现 |
| 旧响应可覆盖当前输入 | 预览/下载与所选模板不一致 | runtime I5，源码风险，尚未浏览器复现 |

## 改造建议索引

依次实施 [四个切片](../recommendations/missions.md)，完整顺序见 [order](../recommendations/order.md)。新状态仅由 `.cdmt-lite/missions/` 内 harness 拥有。

## 方法自检

- [x] 每条判断回溯独立 inventory；历史不代替当前代码。
- [x] 原语与数据归属中立，不要求采用特定 DEPA runtime。
- [x] 可选 profile 有激活依据或 NOT_APPLICABLE。
- [x] 分析产物与业务实现分开；用户已授权后续实施。
- [x] [backlog](../recommendations/backlog.md) 保留未承诺能力，不宣称全量移植完成。

## 下一步

通过 audit 的来源重观察后，直接按顺序激活报表内核，再执行分组交叉、网页入口和计算修复；不得停在规划完成。
