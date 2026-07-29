# 顺序与冲突

用户已授权依次执行：

1. `legacy-port-gap-audit`：查实来源、缺口、基础库与当前基线。
2. `excel-template-report-kernel`：先接通真实模板到报表的内核。
3. `report-groups-and-cross-tables`：在同一 IR 增加父格、分组与两轴。
4. `web-table-report-workbench`：使用稳定内核接通网页文件与当前结果。
5. `dataset-semantics-and-kon-window`：修复数据结果与补齐 Kon 窗口入口。

| 组合 | 共享边界 | 执行要求 |
|---|---|---|
| 报表内核 / 分组交叉 | contract、logic、XLSX 坐标 | 串行，复用同一模板 authority |
| 报表内核 / 网页 | report public API | 先核后壳，壳不复制规则 |
| 网页 / 计算扩展 | Kon contract 与示例 | 串行，保留最宽回归 |
| 所有 mission / 旧 codument | 无新增写入 | 历史只读 |

ready 判定：四项边界、来源与验收均明确；前序通过后后序无需再次授权。未承诺的广泛源头能力列入 [backlog](backlog.md)，不以本批完成冒充全量 esProc 或 Nop 兼容。
