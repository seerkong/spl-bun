# 表格报表与SPL查询续作交付

2026-10-23。按用户要求先完成表格/报表对齐，再执行SPL查询缺口，九个连续mission均已实际实现和验收。新轨迹只在`.cdmt-lite`，旧Codument与源Java仓库只读，用户既有外迁改动保留。

| 交付 | 具体结果 | 证据 |
|---|---|---|
| 报表公式 | cellSet/层次坐标/过滤/懒宏/19函数、只读成员、依赖/cycle、f+v与显示/导出策略 | [完整对账](acceptance-matrix.md)，含财务4100、过滤7/9、4/5/6公式 |
| 动态sheet与模板 | workbook/sheet loop、独立配置表、作用域/唯一名称、inplace/兄弟复用/双轴依赖、删除/隐藏、样式/格式/纯patch | 同一报表矩阵与真实HTML/XLSX/HTTP/E2E |
| 文档与媒体 | link/validation/CF/definedName/print/freeze/protection/rich text/table/drawing/chart动态引用保真；真实图片与13条码格式 | 独立ZXing还解码CODE39/93小写、中文QR；原生chart缓存2/5/7与独立part |
| SPL语义 | truth/count/icount、短路、连列/多重集、null聚合、顺序derive、schema错误、复合聚合、CSV/JSON一致输入 | [22行最终对账](spl-acceptance-matrix.md) |
| SPL表算子 | pivot/unpivot、六种join、rename/alter/只读index、相邻分段、groupc/ungroupc/groupi | 三入口共用纯实现；15/20/7、总42、基数2/3/4/2/1/3 |
| Cursor与资源 | 生产owner、真实CSV stream/SQLite iterator、select/derive/project、有界collect、并发/EOF/close/Abort/timeout与run scope释放 | [Flow说明](../../packages/spl-flow/README.md)，百万行脚本与资源计数 |
| 文件effect | UTF-8 read/write及CSV/JSON import/export、原子替换、失败清理、真实路径边界 | 真实临时文件与原内容不变断言 |

最终代码基线的验证结果：

- `bun test`：426 pass、0 fail、1431 expects、77 files。
- 最宽SPL相关切片：331 pass、0 fail、953 expects、56 files；根构建13包全部成功。
- 隔离4394/4396浏览器回归：16 passed。新增网页上传→pivot/unpivot→聚合42/3/14与sync cursor拒绝；原动态sheet/公式/删除/显示导出/PNG/XLSX下载和过时结果用例保持。
- 独立百万行：两source各1,000,000条，batch<=1024、open=close=1；CSV首批32KiB。最后RSS增量CSV60.9375MiB、SQLite57MiB，满足该窄行fixture的64MiB信号。
- 核心IO/eval负向、输入不变、非法字段/成员/patch、资源/路径/类型冲突反例通过。Codument diff与untracked哈希保持初始值。

网页原“Cursor Pagination”示例实际是SQL LIMIT/OFFSET，已更名“SQL Pagination”；真实异步cursor走host/async Flow，同步Kon明确拒绝。JS Number/宿主Date、规范化ReportTemplate/raw XDSL格式、Java完整option/数值类型及来源缺陷适配边界均见两份矩阵。没有将nop-entropy企业平台、外迁domain/ORM或Java全库兼容扩大为本次完成声明。
