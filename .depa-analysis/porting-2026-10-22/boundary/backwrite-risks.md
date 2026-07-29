# 反写与混用风险

当前盘点没有证实跨系统 authority 冲突；不能把多个物理写点推断成多 owner。具体待修复项来自 [runtime I1–I5](../inventory/runtime.md) 与 [nop-report RISK](../inventory/nop-report.md)。

| 风险 | 处置 |
|---|---|
| 用无模板的 T 导出冒充模板投影 | 新建独立报表入口，不改 T 的公开含义 |
| 直接 SheetJS workbook writer 丢样式 | 原 OOXML entry 保留，仅变更声明支持的结构 |
| 拷贝行后引用原坐标，保留的图表/validation 实际已错位 | 实现引用映射；未支持且受展开影响的结构显式拒绝 |
| HTML 显示文本写回数值，Excel formula 混作 SPL expression | 保持 raw/display/formula 独立槽 |
| 跨行列分组用按值重建数据，丢掉原始记录身份 | 渲染内使用同源数据集稳定 row ID，空交集不回退全量 |
| 旧异步响应覆盖新输入的结果或下载产物 | 请求版本与依赖失效；失败清除当前产物 |
| 归档历史覆盖源码事实；外迁包被当遗漏恢复 | 旧 codument 只读，依赖以当前 public API 为准 |
