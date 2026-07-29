# Evidence: 表格报表能力总对账

- P0 — 源码观察 — ExpandedCellSet.java:60–226成员实存，rowCount/colCount为首尾坐标跨度而非去重计数。现FormulaCellSet只支持部分成员；layer relative算法用own.index，在删除后anchor列表压缩时+0可能错选，需实际反例修复。

- P1 — 可复现漂移与修复 — members.test初始2 fail：删除0后relative+0得到[3,0]而非[2,3]，空PROPORTION抛单格错误。现按保留身份在当前父域求ordinal，再跨父域按同ordinal选择，财务嵌套同比/累计4100回归保持。补充one-level聚合（嵌套数组不递归flatten）、Number-only排名、空proportion/null、布尔转换及member.sum与SUM不同MathHelper规约。
- P2 — 公共成员/边界 — post-fix相关报表68 pass/366 expects、两个report包typecheck通过。get/first/last/cellRanges/map/filter/flatMap/children/realCells、rr/cr/rp/cp/ei/value/name/rowIndex/colIndex只读view、CELLS/EVAL_EXCEL_FORMULA/EXPAND_EXCEL_FORMULA、SPL方法混算、容器literal和自身后处理均有数值证据；proto/host调用、只读反写、动态字符串64层、真正patch循环有负例。
- P3 — 额外实际反例 — 参数展开items=[qty2,qty3]同时传唯一unrelated数据集qty999，原输出四个999；scope默认dataset不应覆盖明确row/col parent。修后输出[2,2,3,3]。导出新增语义闸门：不可用原生Excel等价表达的类型/谓词/懒逻辑/SPL转换物化当前值，避免留下另一套计算规则；可表示的SUM/IF及层次地址仍导出原生公式，未选BOMB分支零调用。

- P4 — E2E环境观察与调和 — 首次启动未进浏览器断言；诊断时并发启动同一隔离DB产生CUSTOMERS错误，此结果作废。之后单进程换4394/4396仍在Bun listen返回EADDRINUSE，lsof未见监听、ps受沙箱拒绝；是环境启动问题，尚不能记产品E2E通过。先完成样式carrier反例与代码，再申请仅本地隔离E2E运行权限。
- P5 — 静态样式待证假说 — readXlsxTemplate仅取cell@s默认0，row@s/col@style未进入cell IR；writer给所有真实格显式s=0可能覆盖模板继承样式。新增独立节点验证并修复，仍在RP09/20授权范围。

- P6 — 样式carrier反例证实并闭合 — 合成XLSX行1@s=1、列B@style=1，原IR全为style0；修后[1,1,0,1,0]、数值不变、numberFormat继承0.00、空C1背景正确。静态row/col style投影进入contract，归属codec解析，logic按slot来源复制/删除，HTML及XLSX消费同一结果；named-style样本也复用同一继承规则。最终报表切片70 pass/374 expects，report包typechecks通过。

- P7 — Web产品实际验收 — 获准启动仅本地4394/4396后，原14项先通过；新增case准备脚本漏where按现有公开SPL Conf补为where="true"，重跑全部15 passed(17.6s)。新case同时验证Kon结果→动态苹果/香蕉sheet、删除qty0、SUM缓存5/7及真实A2:A3公式、原值/￥格式化导出、3张iframe PNG naturalWidth=128、XLSX下载回读；旧过时结果与窄屏用例继续通过。测试进程由Playwright关闭，未触碰用户4196服务。

- P8 — 全格式独立解码 — `verification/barcode-formats.ts`用生产端口输出13种PNG，`BarcodeFormats.java`用独立ZXing 3.5.0解码。首次仅CODE_93失败，raw缺少强制C/K校验字符；改code93ext+includecheck后13种全部解码到原文，exit 0。CODE39/93使用扩展ASCII编码适配来源writer。源码声明但未消费的chart seriesDataExpr/seriesCatExpr改为inertBindings保留，测试NEVER_RUN未执行；不假造源已有数组图表功能。

- P9 — 最终目标重观察 — 从用户原始目标、MISSION及AT1重新读取RP01–26/F01–12/G01–19/M01–07/X01–08/Q01–06，核对规范化输入与XLSX/HTML/HTTP/浏览器真实出口，索引在acceptance-matrix.md。新增源Q01/Q02/Q03/Q05准确数值回归5/18/8/11、R5、[3,7,9,7/9]通过。无遗留未验证SOURCE_RUNTIME；raw XDSL/Java宿主按公开目标协议适配，schema-only图表字段保真不执行。
- P10 — 最终基线验收 — `bun test packages/report-logic packages/report-xlsx-support packages/web-server` exit0：89 pass/464 expects/18 files；`bun test` exit0：396 pass/1198 expects/68 files；`bun run build` exit0：13包。最终业务变更后隔离4394/4396 `bun run test:e2e` exit0：15 passed。所有日志为忽略的.tmp-parity-*；未修改用户4196服务。`! rg -n 'node:fs|Bun\.file|new Function|eval\(' packages/report-logic/src` exit0；成员权限/非法patch/输入不变/cache隔离/循环/媒体上界反例均通过。Codument diff与untracked哈希仍分别7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049、1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e。
- P11 — 最终SPL验收期间追加独立媒体验证 — verification fixture增加CODE39/93扩展ASCII小写Abc123、QR_CODE UTF-8“中文报表”。javac完成后重跑Java verifier，13基础格式和3扩展case全部解码到原文，exit0；无产品实现变更，归档状态保持。
