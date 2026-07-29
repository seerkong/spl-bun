# 来源剩余能力与后续切片

这些是源头存在、当前未验证或未纳入本批公开兼容的能力；不能因本批通过就删除其缺口。

| 能力 | 来源 | 暂缓原因 / 后续边界 |
|---|---|---|
| 大数据 cursor、流式及多路并行计算 | [esproc](../inventory/esproc.md) | 当前 DataSet 为内存表；需独立资源生命周期、背压与性能目标 |
| esProc 其余函数、外部连接器、专用数值与统计 | [esproc](../inventory/esproc.md) | 按业务案例选语义与 oracle，不能以函数类数推导所有接口都应暴露 |
| 广义集合、pivot/unpivot、更多关联模式 | [esproc](../inventory/esproc.md) | 后续按公开数据模型能力拆分，不影响本批报表垂直链路 |
| 多层兄弟区域空间复用、任意段落模板 | NR-08/14/16 | 需独立几何 fixture，未支持形态必须带定位拒绝 |
| Nop 层次公式、IF(filter,cellSet)、Excel 公式完整求值 | NR-20–22 | 原生公式和 report expression 不同；本批保留普通公式/坐标策略并声明重算，完整兼容另立 FormulaProcessor mission |
| 动态 sheet、inplace、样式表达式、图表/图片/validation | NR-25 与 R5 | 受变动影响时拒绝；静态保留不代表动态兼容 |
| PDF/Word/分页和打印级布局 | nop renderer 扩展 | 本轮用户重点为 Excel 模板报表，独立渲染目标待明确 |
| nop-entropy 企业开发平台 | 用户显式范围外 | 不移植 |
| 已外迁 ORM/domain 能力 | runtime 自有库章节 | 归外部仓库，不是当前缺口 |

实现过程如发现以上已可低风险支持，应在实际 mission 内根据证据调和并补验收；不能仅用本表遮蔽已承诺终点。
