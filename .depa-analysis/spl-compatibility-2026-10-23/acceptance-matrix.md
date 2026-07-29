# SPL / Excel 模板报表兼容重评

观测日期：2026-10-24。范围为当前网页表格、Kon/Flow 查询和 Excel 模板报表。这里只索引证据，执行状态仍归各 mission 的 loop；不新建另一套任务状态。

本次人类continuationDirective明确接纳sort/parse，授权为目录级，不存在逐文件Host冻结允许集。formatting先按给定独立Review归档；generation5依次实施排序与parse。已准入gap-review generation5支持关闭原排序差距及G5，指出parse非有限词法和S12索引漂移。implement generation6/graph revision7修复这两项后，原run graph8的Verify7 passed、独立Review7 complete/C1–C10 met/gaps空，正式关闭parse及G2；最终after none、Return completed。parse经归档前新复测后整体归档，见[归档mission](../../.cdmt-lite/missions/archived/spl-parse-conversion/MISSION.md)，不宣告全库兼容。

## 当前基线与证据等级

- 原 HEAD：`1e37adb6a8eccb5087348f2abd2cc2ccbba251fb`，已有 dirty 内容保留。首次写入前 status、tracked diff、275 个未跟踪文件内容 manifest 均与输入匹配。
- 历史 round2 业务基线：`60f19579ae793131568fbd4a51b5e36ca43d81d957ae9dd1b8481ecae6fbf154`，覆盖 Git 已跟踪及非忽略的 packages、scripts 和根非隐藏非Markdown文件；逐文件摘要见 [business-baseline.json](../../.cdmt-lite/missions/archived/spl-text-formatting/verification/holarchy-round-2/business-baseline.json)。文档/mission/忽略文件不在这个业务摘要中；忽略的 bun.lock 另记环境摘要，工作树另记 final-worktree.json。
- 历史 round2 验证：相关 417 pass / 1416 expects / 68 files；全量 464 pass / 1724 expects / 83 files；13 包构建；112 项 Formatter/ICU/SimpleDateFormat 实值（原46+52个null结果+14个非法null协议）；4394/4396端口17项产品验收通过（16.6s）。这是round2实际receipt，不能替代generation5验证。
- 历史round2日志、负向检查、基线与保留清单在 [round-2](../../.cdmt-lite/missions/archived/spl-text-formatting/verification/holarchy-round-2/)。前轮 [round-1](../../.cdmt-lite/missions/archived/spl-text-formatting/verification/holarchy-round-1/) 的三时区4728项日历/BigDecimal与1743项Move是当时receipt，本轮未重跑，相关生产模块未改动。百万行RSS、13格式ZXing同样不挪用为本轮结果。
- Java oracle 编译目标在隔离临时目录且 finally 删除；日历/Move 是抽取真实源方法并提供窄 stub，不等同于完整 esProc 运行。**未构建或运行完整 Java nop-report**；其证据仍是源码、已有保存输出与相同规范化输入的 TypeScript 断言。
- 历史generation5：相关429 pass/1538 expects/74 files，全量476 pass/1846 expects/89 files，13包build、112 Formatter + 80 sort + 504 parse源码对照、17 E2E（18.8s）全部exit0；日志与基线见[当时checks](../../.cdmt-lite/runs/holarchy-0e32cd3d67d631730d42c305c551dfec1614/implement-5/checks.json)。
- 当前generation6：parse专项232 pass/909 expects/39 files、相关432 pass/1791 expects/74 files、全量479 pass/2099 expects/89 files、13包构建、592项parse源码对照、112 Formatter、80 sort、17 E2E（17.9s）全过；Review原152项Java对照与四入口20项探针也exit0、零差异。日志、指纹和保留清单见[当前checks](../../.cdmt-lite/runs/holarchy-0e32cd3d67d631730d42c305c551dfec1614/implement-6/checks.json)。
- 本文PASS仅覆盖列出的行为；ADAPTED是显式宿主协议；CANDIDATE-sort/parse是已接纳缺陷的历史编号，排序已获独立Review通过，parse的新修复仍待独立Review；UNVERIFIED不作为已对齐证明。

## 旧 SPL 库存 S01–S22 逐项复核

来源位置及旧承诺详见只读 [原库存](../report-parity-2026-10-22/spl-inventory.md)。下表的测试均已出现在本轮 related/full 日志；不会把该库存中当年的 partial/missing 原样当作现状。

| 旧项 | 源行为 / 迁移承诺与当前入口 | 本轮实值与裁决 |
|---|---|---|
| S01 | Variant 数值相等/Date epoch；core 分组、共享 tuple-index | PASS：分隔符碰撞不合并；number/long/decimal 同数值键相等，数值文本保持不同；`semantic-regressions`、`scalar-parity`。对象引用规则仍是目标协议。 |
| S02 | Sequence 等值连接；DataSet/member/Kon 共用 joinTables | PASS：复合键、A/a、稀疏 schema 及前缀二次冲突回归，Date 匹配值 7。 |
| S03 | 旧五种窗口与 Move 相对行；DataSet.window/member.window/spl_window | PASS：排名及分区独立累计；lag/lead 越界默认值、闭区间 ROWS frame、空 count=0/其余 null、精确数值及稀疏字段当前测试通过；round1 实际 Java Move 1743 项一致，本轮未重跑源 oracle。RANGE/GROUPS/外排仍不在此协议。 |
| S04 | CSV/JSON/XLSX 表导入、空表 schema | PASS：quoted newline、001、后行新增列、空表、指定 sheet，网页上传与重算通过；超安全整数 JSON token 保留文本并显式转 long/decimal。Excel 二进制 double 的既有精度不能恢复。 |
| S05 | 旧 phase2 like/regex/math/date 清单 | PASS：已有 like/regex/mathPhase2/datePhase2 断言当前通过；不是再次实现缺失清单。完整 Java regex/locale 方言未由这些有限断言证明。 |
| S06 | Variant 真值、Count/Icount | PASS：0/空串为真；`[0,"",false,null]` count=2；各聚合入口和类型化去重当前通过。报表 COUNT 是另一个 Number-only 规则，不能统一覆盖。 |
| S07 | And/Or/If/Case 的懒分支 | PASS：未选 bomb 零调用，替换函数保持调用契约，Kon 嵌套/quoted cursor 不读取位置。 |
| S08 | Conj 连列、Sequence 集合操作 | ADAPTED：连列保留重复；有序 @m 最大/最小/差 multiplicity；conj@r 跳 null 并拒绝 cycle/depth/size；isect 不复制来源长度相关缺陷。未移植全部并行/递归选项。 |
| S09 | Sequence.derive 的行上下文与新字段依赖 | ADAPTED：`derive(a+1:a,a+1:b)` 顺序可见，稀疏声明列遮蔽外部同名值，外层 registry/scope 保留，输入不变；Kon/Flow 共享。generation5新增sort行AST和多键方向，见下方当前实施表；不是用旧select绿色替代sort验收。 |
| S10 | AvgValue 忽略 null、精确 sum/avg/min/max/median | PASS：四入口 `[10,null]` avg=10；合并 sum/count 权重；decimal 0.1+0.2 聚合得 0.3，不回退 Number。非数值过滤与空值策略有断言。 |
| S11 | 无分组空聚合的单位元 | PASS：空全表一行 n=0/sum&avg=null；有分组空表零行并保留 schema。 |
| S12 | 旧 spec 的字段/step/表达式诊断 | PASS 限于已绑定的 filter/derive/aggregate/window/sort 等入口；稀疏合法字段不回退外部值。当前sort('missing')及raw AST未知字段在非空/空schema表均明确报错，见sort-semantics.test.ts；旧静默返回反例仅保留在下方接纳前历史区，不宣称所有表成员均已覆盖。 |
| S13 | Sequence pivot/unpivot | PASS：A-Jan15/A-Feb20/B-Feb7，逆转三行总计42；显式 null 四行、重复键 reducer、列冲突有断言。 |
| S14 | inner/left/full/semi/anti/right | PASS：基数 2/3/4/2/1/3、2×2重复4、左右空表与右孤儿、顺序/schema/输入不变。range/as-of/外排没有由此验收。 |
| S15 | 组内复合聚合表达式 | PASS：`sum(a)/sum(b)=7.5`、懒分支及 count/icount；未知/任意嵌套 aggregate 不做正则猜测。 |
| S16 | rename/alter/index/groupc/groupi | ADAPTED：纯表变换、只读索引、相邻/全键 nested rows、铺列与反转回归；不是完整 DataStruct 持久外键系统。原记录的“有序分段”概括不能替代真实源码。 |
| S17 | Cursor fetch/skip/close 与 Sequence slice 分开 | PASS：有状态消费 `[1,2]`/skip1/`[4,5]`/EOF；并发队列与独立位置、一次释放；数组 fetch 保留 slice。 |
| S18 | CSV stream / SQLite iterator 与资源 owner | ADAPTED：当前 cursor/resource-file 负向、abort/timeout/Flow 终态释放测试通过；同步 Kon 在实际异步调用处拒绝。百万行/RSS 仅有上轮 receipt，本轮不宣称重新量测；JSON 导入及全表排序仍会物化。 |
| S19 | 原 file CSV/JSON read/write/import/export 承诺 | PASS：当前隔离真实 IO、原子替换、失败保留原文件、越界/符号链接拒绝、精确值文本导出回归。完整 Java 编码/append/btx/多参数导出不是这行的已验证内容。 |
| S20 | legacy Flow/Kon 的 CSV/JSON/SQLite 入口一致 | PASS/ADAPTED：shared 归一、quoted 列、后行列、空表头/后续 SQL 同结果；精确数值在 JSON/worker/SQLite 边界序列化为文本，这是可逆目标协议，不是 Java Number 类身份。 |
| S21 | Variant 标量、日期、转换及成员参数 | 部分 PASS：long/decimal、日历、member AST、窗口和formatting的新协议已有实值；**排序已获独立Review通过；parse非有限词法修复已过当前命令验收，等待新独立Review**。完整Java格式、整数日期表示、locale/cutover、所有选项不继承为永久豁免，也没有全面验收。 |
| S22 | 已外迁 domain/ORM | NOT_APPLICABLE：用户明确不恢复；当前 production-import-boundary 断言及 Codument 两项哈希保持，无企业平台引入。 |

## sort/parse接纳前的历史差距证据

以下为修复前的历史TS值，来自round1真实执行，不是当前实现或simulation；Java 期望来自直接读取的源分支，**没有运行完整 Java Sort/Parse**。复现脚本与原始输出见 [compatibility-probes.ts](../../.cdmt-lite/missions/archived/spl-text-formatting/verification/holarchy-round-1/compatibility-probes.ts) / [log](../../.cdmt-lite/missions/archived/spl-text-formatting/verification/holarchy-round-1/compatibility-probes.log)。round2 仅据 Review 纠正 @u 解释，不改写原收据或扩大本轮业务写入集。

排序引号协议需区分：当前目标 `.sort('a')` 是列名适配入口，源对应按字段排序的表达式是 `.sort(a)`；源 `.sort('a')` 本身是常量表达式。下述 @z/@u 差距指目标入口未消费/拒绝这些选项，不能把 Java 的引号字面量误当字段名。`parse@x` 是目标显式失败契约的待定边界，不作为已经运行的 Java 不同值证明。

纠正 round1 的 @u 推断：`Sequence.java:1129–1152 sort_u` 保留全部记录，以键首次出现的顺序聚拢相等项。键 `[2,1,2]` 的来源推导是 `[2,2,1]`，不是去重，也不是升序 `[1,2,2]`。原探针保留三行本身不是缺陷；后续不得按去重实现 @u。旧迁移 plan 中的 unique 概括也不能取代真实源码。

| 候选 / 优先级 | 源与旧承诺 | 当前实际值及建议验收 |
|---|---|---|
| CANDIDATE-sort / major | esProc `expression/mfn/sequence/Sort.java:22–82` 按行求排序表达式、支持多键和 locale；`dm/Sequence.java:6978–7005` 消费 @z/@u/@0/@o，`:1129–1152` 的 @u 是稳定聚拢；旧 `2026-01-19-add-expression-core-ops/.../spec.md:3–19` 承诺排序语义。 | 当前 `expression/src/memberRegistry.ts:166–174,495–506` 只接列名/asc-desc，未接 row AST。`table=[{a:2},{a:1}]` 的 `sort@z('a')` 得 `[1,2]`，应有降序语义或显式拒绝；`[{a:2},{a:1},{a:2}].sort@u('a')` 得 `[1,2,2]`，来源应聚拢为 `[2,2,1]`，两者均保留三行；`sort('missing')` 和 `sort('a*rate')` 静默返回原顺序。Kon 也得到错误升序。建议有限 mission：共享纯多键表达式排序，绑定 schema/outer scope、选项和 locale 显式处理；本项目输入不可变，来源 @o 原地写入应明确拒绝/适配，不能反写输入。验收含精确数值/Date/null、聚拢/稳定性、缺列、懒分支、三入口和真实源 oracle。 |
| CANDIDATE-parse / major | esProc `expression/fn/convert/Parse.java:35–119`，`util/Variant.java:1695–1758`；旧同 spec `:63–79` 明确承诺 parse/options。 | 当前 `functions.ts:196–218` 主要是纯数字 regex。`parse('true')/'null'/'[1,2]'/'1e3'` 均仍为文本；源分支应为 bool/null/序列/数值。`parse('12.5kg','n')` 得原文本，源取数字前缀12.5；`parse('bad','n')` 源为null但当前原文本。`parse@q('"a" trailing')` 当前去引号为a，源 q 不带 e 应保留首段引号；未知 @x 被吞。Flow 中 `parse('true')` 也是 ok 文本。建议独立有限转换 mission：先固定 q/e/n 顺序和默认类型，复用精确数字/安全 JSON/日期原语，补 Java 源实值与 Kon/Flow 断言，不引入 eval 或另一套近似解析器。 |

## generation5实施基线与来源实值

| 已接纳项 | 当前入口与结果 | 明确适配与独立验收状态 |
|---|---|---|
| CANDIDATE-sort | `sorting.ts`共享纯处理器、memberRegistry行AST、parser的xi:di/分号locale、Kon原生列配置适配、Flow。`[2,1,2].sort@u()`为`[2,2,1]`；多键[(1,2),(2,1),(1,1),(1,2)]的id聚拢为[0,3,2,1]；z降序，0始终null末尾；缺字段/非法选项在空schema表也失败。80项真实Sequence.sort/sort_u和CommonComparator方法对照通过。 | 按输入顺序一次投影，不重放有副作用的Java表达式；旧引号列/表达式入口与原生Kon配置保留；@o/@n明确拒绝；Intl locale、JS scalar/Date身份是宿主协议。oracle使用窄storage/context/scalar equality适配，非完整Java Sort引擎。待独立Review核销。 |
| CANDIDATE-parse | `parse-conversion.ts` + builtins.parse + Expression/Kon/Flow，regex @p同源。true/null/[1,2]/1e3分别为bool/null/数组/1000；12.5kg/n为12.5，bad/n为null；q保留首段引号，qe解码内部；e先于n。源数据JSON支持unquoted key、嵌套、尾数组null，空{}保留文本。504项真实Parse/Variant/JSONUtil/Sentence/StringUtils方法对照通过，FloatingDecimal/DateFormatX/默认DateFormatFactory原类在隔离目录运行。 | 叶Context和Java容器适配为JS数组/own-property记录；unsafe JSON数值仍为文本，顶层long精确bigint、超long整数Decimal，溢出显式失败；资源1MiB/128层。默认本地日期/时间，不外迁Java可变全局格式注册与cutover。原Java Number类身份、Unicode digit及任意locale格式不冒称全面一致。待独立Review核销。 |

## generation6独立差异与当前修复

- 独立Review来源：gap-review generation5/hash=3704820b20202e14ccc16e1f5adca2f5dfb45664b50693dc5e808dc540517de3。原152项真实Java对照中30项类型不同，四入口20项均将+NaN、-NaN、NaN%、Infinity%、-Infinity%保留为文本。这是已复现缺陷，旧失败收据保留在原Verify目录。
- 共享parse-conversion.numberText先识别来源允许的带符号NaN/Infinity及百分号，再走原精确数值/溢出检查；没有放宽任意非有限计算结果，也没有更改通用scalar或JSON传输协议。default/q/e/qe/en/qen返回number，n/qn返回null，引号q/qe保持原有优先级。
- 新增Expression、Kon、Flow及regex @p类型/数值断言；592项实际Java方法oracle含原504项及扩展特殊值控制，另将Review原152项及20项探针原样重跑均exit0。浏览器用string(parse(text))显示NaN/正负Infinity；四入口内存断言明确验证number类型。真正指数溢出仍拒绝，精确整数、安全JSON、资源限制、输入不变和懒分支回归保持。
- S12已调和为当前sort未知字段在空/非空schema表均报错；旧静默返回仅作为接纳前历史反例保存。排序已由准入独立Review核销并重验归档；parse及G2当前修复待原workflow独立核销，实施者不自行关闭。

## 报表优先项 RP / F 再核对

[旧报表矩阵](../report-parity-2026-10-22/acceptance-matrix.md) 的每项 fixture 路径仍有效；以下为这次对其来源、当前入口和运行信号的重评。没有把查询 pivot 当作报表布局，也没有把完整 Excel 引擎当作 nop-report 已实现能力。

| 来源项 | 源行为 → 当前入口 | 当前运行信号 / 明确适配 |
|---|---|---|
| RP01–02 | `ExpandedSheetGenerator.java:69–149` workbook/sheet loop、条件先于 loop、sheetName、cleanup → `report-logic/src/sheet-instances.ts:42` | L `sheets.test.ts`：Cover/苹果/香蕉、独立 scope/cache、C1=5/7、空loop只封面、嵌套path与全局名称去重；X `sheets.test.ts` 苹果/香蕉不同列与关系，17 浏览器用例含动态sheet。ADAPTED：全局去重避免源跨模板碰撞；before/after Java hook 改 Kon 准备输入和 host cleanup，带位置拒绝嵌入脚本。 |
| RP03–08 | TableExpander/ExpandedSheetGenerator 几何、隐藏/移除 → layout/processing | L layout/groups、X workbook：inplace 预留2/3/4项、同父兄弟复用、两轴嵌套、尾行/尾列与空样式格；删除qty0后SUM=5，隐藏仍保留物理行。不是只移动 A1 文本。 |
| RP09–10、21–22、24 | `ExpandedSheetEvaluator.java:115–192` value/style/formatExpr/dict/link/process；多行配置 → cell-processing/compile/render | raw/display/export 独立，style 输入不变、formatExpr 优先、显式dict未知项拒绝；SSF数字默认仍导出number，格式导出开关实测。processExpr 改显式纯 patch，在依赖读取前应用；这不等同任意 Java hook 执行顺序或容器写入。 |
| RP11、15–20、26 | 源 link、validation、CF、names、print、protection/pane、rich text、filter/table → xlsx-support references/workbook | 当前 full 中 references、workbook、HTTP 及 E2E 通过；含动态sheet/删除后重定位、独立关系、原OOXML静态保真、类型缓存/HTML转义和未知受影响扩展诊断。CF 为载体保真加显式样式投影，不冒称所有条件公式求值。 |
| RP12–14 | 源实例图片/QR/ExpandedSheetChartGenerator → 显式图片字节、barcode端口、drawing/chart克隆 | 当前 media/charts/barcode/HTTP/E2E 通过，2sheet×2记录图片、series/cache独立、真实QR解码；13种格式ZXing是历史receipt，未在本轮重跑。无Java运行依赖。 |
| RP23 | `.xpt.xlsx`/规范化 ReportTemplate → 同一 compile/render 核心 | ADAPTED：旧XLang数据构造交给 Kon/SPL，raw `.xpt.xml` 的 XDSL/VFS 不直接解释。当前 XLSX、HTML、下载、规范化 fixtures 通过；不是声明原文件不经转换全部可运行。 |
| F01–08 | `coordinate/CellCoordinateHelper.java:47–249,267–332` 行列父域/交集/矩形/相对反向路径 → report selector | 当前 formulas/members：二维交集、!-1、+0、删除后 retained sibling、空集；值和导出引用复用同一 selector。绝对单格选择修正源目标名错误。 |
| F09–12 | 源 scalar unwrap、全局IF过滤、依赖缓存 → formula-expression/evaluation | 多格标量报错、前向仅算一次、循环路径诊断，IF过滤 e.rp.ev、未选循环/BOMB 零调用。循环显式失败是来源半成品缓存行为的适配。 |
| G01–19 | `functions/ReportFunctions.java` 的19个函数 → formula-functions | 当前严格 Number-only、单层迭代、空/NaN/sample统计、PROPORTION/RANK、SUMIF/COUNTIF 有实值。ACCSUM 使用确定 prefix 防重复累计，Java 数字类身份映射 JS number，均为显式适配。 |
| M01–07 | 宏和 cellSet 成员/CELLS/EVAL/EXPAND → 受限 report API + SPL evaluator | 当前懒 IF/AND/OR/SWITCH、只读 cell view、动态表达式深度、非法host/prototype/patch拒绝。不是移植通用 XLang 执行器。 |
| X01–08 | 原生 `<f>`、物理坐标与报告选择/导出分开 → formula-export/xlsx-support | 当前 quoted-sheet/$/字符串保护、动态sheet同实例、f+v、shared/array范围与错误缓存有断言。不可等价类型/懒宏物化并给诊断；外部工作簿/structured表达式保真但未计算，完整 spill 未实现。 |
| Q01–06 / N01–12 | 源归一数据/保存HTML/具体反例 → formulas/members/groups fixtures | 当前实际值 5/18/8/11、4/5/6、[3,7,9,7/9]、财务年内/全局排名10/13及累计3100/4100；不是以源测试仅生成文件替代数值验收。 |

未在本轮复现新的 RP/F 功能缺陷。此表覆盖的是来源矩阵与已列 fixtures，任意来源工作簿、全部 locale/原生 Excel 函数及完整 Java 引擎一致性仍 UNVERIFIED，不能写成“表格报表全部能力已经对齐”。需要具体输入才能为其另行接纳 gap。

## 当前边界与后续独立重评

- formatting按给定独立Review（gap-review generation3/hash=bd8521f450c40da6b0b56f028df4abbe1874f8e4f91b718ea6c987d0f0162515）及本轮重跑归档；历史43项文件整体移动并记录哈希映射。round1/2/失败round3收据均保留，不重新准入被拒调用。
- G5按新的人类续作指令和原run实际command/checkpoint调和：目录级授权及限制，implement generation5/node_revision6-user-continuation-20261024/graph revision6，baseline与review feedback完整关联。逐文件允许集从未冻结，不继续要求未定义制品。观察changedFiles与授权策略分开。
- 已准入独立Review核实CANDIDATE-sort及G5可关闭，排序按当前验收归档。parse及G2已由原workflow generation7独立Verify/Review核销，正式裁决及原始证据映射登记在[已准入评审](../../.cdmt-lite/missions/archived/spl-parse-conversion/verification/closeout-20261024/accepted-review.json)；归档仅登记该已有裁决，未再派发迁移或替代会话。当前generation6/graph7、feedback generation5及原baseline关联见implement-6/run-context.json；旧generation5收据不覆盖。
- 有限Formatter协议明确拒绝%h/%a及任意DecimalFormat grammar；sort @o/@n、Java容器/locale/可变日期注册、完整spill/外部workbook计算、外排sort/groupx/joinx、range/as-of、完整专用统计及其他连接器仍需按具体来源和输入重评。这些未验证项不作为完成或永久豁免；本轮没有据此虚构额外已复现缺陷。
- 报表RP/F fixtures已随全量和17产品用例重跑；未运行完整Java nop-report或任意来源工作簿，所以结论保持有限。企业平台、分布式DW容器、外迁domain/ORM继续不进入本轮。
