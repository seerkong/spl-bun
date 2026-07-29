# 可实施切片

| Mission | 问题/目标/输入 | 改动边界与非目标 | 可观察 PASS 条件 |
|---|---|---|---|
| excel-template-report-kernel | D1/D3；模板 bytes + datasets/params → XLSX/HTML | 三个真实职责新包；不引入 Java runtime、通用 Excel 计算器 | 真实文件有两条明细、END 后移；样式 entry 相同、合并正确、HTML 转义；输入不变；公式明确重算策略 |
| report-groups-and-cross-tables | D2；父格图与命名数据集 → 分组/交叉格 | 内核计划、几何与实例；不承诺任意 Nop 脚本 | East/West × Apple/Milk 的 6/3、0/5；重复记录不丢、环与无效父格报错 |
| web-table-report-workbench | D4/D5；用户文件 → Kon 数据 → 模板预览/下载 | 请求绑定、文件解码、Vue shell；不信任服务器文件路径输入 | 从浏览器选择 CSV/JSON/XLSX，Kon 计算后渲染当前结果，下载再打开正确；旧响应不覆盖新输入 |
| dataset-semantics-and-kon-window | D6；修复实际错误并暴露已有计算 | core、Kon、示例与回归 | 分隔符/类型不碰撞；sum(a) 和 avg(b) 独立；Kon 原生 window 输出正确 |

角色与依赖验收见 [package-disposition](../convergence/package-disposition.md)。各 mission 的 MISSION/attractor 是实施期终点；本文件不维护节点状态。
