---
status: active
last_verified: 2026-10-22
scope: system-package
---

# esProc 计算能力与 spl-bun 续作盘点

本报告是当前工作树的观测快照。结论：spl-bun 已有可运行的 TypeScript/Bun 数据计算内核与 Kon 产品入口；当前最有价值的续作是先修复序表语义，再把已有计算能力、真实数据输入与报表渲染接入 Kon。Java 类库存不能直接转换为逐函数移植承诺。

盘点主表为 **E01–E30，共 30 行；RISK 共 8 行（E04、E06、E07、E09、E10、E17、E23、E24）**。RISK 表示已有行为或当前目标存在具体风险，不等同于 authority 冲突。其余明确缺失能力仍列为 `missing`，不重复计入 RISK。F/H/V/M 表分别是事实边界、历史、验证和建议，不重复累计数量。

## 快照与判定口径

- 原实现根：`/Users/kongweixian/infra-dev/esProc`。只读文件计数：`src/main/java/**/*.java` 1213 个；其中 `com/scudata/expression` 567、`expression/mfn/sequence` 96、`dm/cursor` 40、`dm/op` 42、`dw` 84、`parallel` 41、`excel` 29；`importlibs` 有 22 个一级目录。计数是实现规模证据，不是必需公开 API 数。
- 实施根：`/Users/kongweixian/infra-dev/spl-bun`。`packages/*/package.json` 当前有 10 个：expression、core、spl-flow、sqlite-adapter、kon-spl-dsl、composer、web-shared、web-server、web-ide、test-utils。`functions.ts` 的顶层 builtins 有 66 个源代码键；Kon 注册 11 个 `spl_*` word。
- 历史资产：`codument/tracks/archived` 递归有 15 个 `plan.xml`、24 个 `track.xml`；`codument/missions/archived` 有 6 个 `mission.xml`。仅作为历史记录读取，不能用 `completed` 替代当前代码/实测。
- `implemented` 是本报告列明的有限行为已存在；`partial` 是有基础实现但覆盖/暴露/语义仍有限；`missing` 是当前保留包内未发现实现或公开入口；`retired` 是已决定移除/外迁；`unknown` 是未验证，不能推导为缺失。
- 用户当前工作树包含有意的 Domain 拆包及文档迁移，未修改、还原或重新引入。当前范围权威见 [source-only-scope.xml](/Users/kongweixian/infra-dev/spl-bun/codument/behaviors/source-only-scope.xml:3)。Weaver 配置 `excludeDirPatterns=/Users/kongweixian/infra-dev/**` 命中本 Git 根，未调用 Weaver MCP。
- 检查仅含本地源码阅读、目录计数、core 既有测试、3 个不写文件的 Bun 最小反例。没有运行 Java oracle、浏览器或完整回归；Java/TS 跨实现兼容性不能声称已全部验证。

## 能力主表

| ID | 能力与原实现证据 | 当前实现/入口证据 | 状态 | 裁决与续作意义 |
|---|---|---|---|---|
| E01 | Sequence/Table/DataStruct 结构；[Table.java](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/dm/Table.java:49) | `DataSet` 的 schema、rows 与 `fromRows`：[dataset.ts](/Users/kongweixian/infra-dev/spl-bun/packages/core/src/dataset.ts:54) | implemented | 已有轻量内存序表。不是 Java Record/DataStruct 的等价替身；schema 仅 name/type，首行推断，空序表须显式提供 schema。 |
| E02 | 选择与派生：[Sequence.java select](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/dm/Sequence.java:6129)、[derive](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/dm/Sequence.java:8655) | project/filter/filterExpr/withComputedColumns：[dataset.ts](/Users/kongweixian/infra-dev/spl-bun/packages/core/src/dataset.ts:68)；Kon `spl_select/spl_derive`：[enable.ts](/Users/kongweixian/infra-dev/spl-bun/packages/kon-spl-dsl/src/enable.ts:48) | implemented | 高频管线已接通。原生 word 的列计算作用域为外层 scope 合并后由行字段覆盖，保留这种明确契约。 |
| E03 | 排序、top：[Sequence.java sort](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/dm/Sequence.java:7059)、[top](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/dm/Sequence.java:3204) | Kon 多键排序与 top：[sort.ts](/Users/kongweixian/infra-dev/spl-bun/packages/kon-spl-dsl/src/words/sort.ts:70)、[top.ts](/Users/kongweixian/infra-dev/spl-bun/packages/kon-spl-dsl/src/words/top.ts:24) | partial | 普通排序/取前 n 行可用；Java option、表达式排序、位置返回、分段等不可按同名推定支持。 |
| E04 | 分组键是独立表达式值，归约交给 IGroupsResult：[Sequence.java](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/dm/Sequence.java:11267) | aggregate 将键 `String(...).join("\u007c")`，输出再 split；Kon `spl_groups` 直接调用它：[dataset.ts](/Users/kongweixian/infra-dev/spl-bun/packages/core/src/dataset.ts:111)、[groups.ts](/Users/kongweixian/infra-dev/spl-bun/packages/kon-spl-dsl/src/words/groups.ts:125) | partial | **RISK：分组键串化与分隔符碰撞。** V1 已重现不同复合键合并且原键被截断。数值键转字符串是已记录限制，但分隔符合并是实际错误。 |
| E05 | 聚合表达式可包含多个 Gather，重聚合/收尾：[Groups.java](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/expression/mfn/sequence/Groups.java:108) | Gather prepare/gather/gatherWith/finish：[gather.ts](/Users/kongweixian/infra-dev/spl-bun/packages/core/src/gather.ts:8)；sum/count/avg/median/top：[dataset.ts](/Users/kongweixian/infra-dev/spl-bun/packages/core/src/dataset.ts:308)；Kon 支持 sum/count/avg/min/max/median：[groups.ts](/Users/kongweixian/infra-dev/spl-bun/packages/kon-spl-dsl/src/words/groups.ts:46) | partial | 有有限聚合生命周期，不等于 Java 的全部高级/并行聚合。`spl_groups` 只接受 `fn(expr)`，尚不支持 `sum(a)/count(a)` 这种组合聚合式；可先聚合再 derive。 |
| E06 | 多序列等值连接与 inner/left/full/merge 分派：[Sequence.java](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/dm/Sequence.java:11612) | core inner/left，复合键、表达式键与列前缀：[dataset.ts](/Users/kongweixian/infra-dev/spl-bun/packages/core/src/dataset.ts:174)；Kon on/leftOn/rightOn：[join.ts](/Users/kongweixian/infra-dev/spl-bun/packages/kon-spl-dsl/src/words/join.ts:43) | partial | **RISK：join/window 分区键串化碰撞。** V2 已重现不同键被 inner join。`String` 还混合数值/字符串；null、undefined 与同名字面字符串也需定约，不应偷偷继承 JS 转换。 |
| E07 | Java 全局 join 返回引用字段，SPL 记录引用语义：[Join.java](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/expression/fn/Join.java:19) | expression 自带另一套 join 并统一 `.toLowerCase()`：[memberRegistry.ts](/Users/kongweixian/infra-dev/spl-bun/packages/expression/src/memberRegistry.ts:716)；core join 不转小写：[dataset.ts](/Users/kongweixian/infra-dev/spl-bun/packages/core/src/dataset.ts:183) | partial | **RISK：同名计算路径语义分叉。** `spl_eval` 成员 join 与 `spl_join` 会对字符串大小写给出不同结果；expression group 也复制键拼接实现。应定一个计算语义 owner，兼容层只转换输入输出。Java 引用字段结果与 TS 扁平合并是显式适配，不能宣称对象形态一致。 |
| E08 | Java full join；交/差连接选项：[Sequence.java](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/dm/Sequence.java:11612)、[Join.java](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/expression/fn/Join.java:46) | JoinType 只有 inner/left：[dataset.ts](/Users/kongweixian/infra-dev/spl-bun/packages/core/src/dataset.ts:22)；Kon 明确拒绝其他 type：[join.ts](/Users/kongweixian/infra-dev/spl-bun/packages/kon-spl-dsl/src/words/join.ts:55) | missing | full、semi、anti、右连接、范围/as-of、外键/主键索引连接等需按案例选择。full/semi/anti 有原实现对应需求基础；right 可由交换左右表与显式列映射实现。先不扩大本轮报表所需面。 |
| E09 | 排名/累计：[Sequence.java ranks](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/dm/Sequence.java:3604)、[cumulate](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/dm/Sequence.java:2918) | core window 有 row_number/rank/dense_rank/runningSum/runningAvg：[dataset.ts](/Users/kongweixian/infra-dev/spl-bun/packages/core/src/dataset.ts:40)；求值：[dataset.ts](/Users/kongweixian/infra-dev/spl-bun/packages/core/src/dataset.ts:269) | partial | **RISK：不同 measure 的 running sum/avg 共用累加器。** V3 已重现。已有累计功能应先修复再暴露；lag/lead、滑动 frame、时间窗口尚未发现。 |
| E10 | 原窗口/序列计算能力的语言化入口 | 11 个注册 word 不含 window：[enable.ts](/Users/kongweixian/infra-dev/spl-bun/packages/kon-spl-dsl/src/enable.ts:26)；明确 backlog：[kon-spl-window-word.md](/Users/kongweixian/infra-dev/spl-bun/codument/backlog/kon-spl-window-word.md:3) | partial | **RISK：底层能力存在但 Kon 正式入口缺失。** backlog 的“可 spl_eval 透传”仅对真实 DataSet 对象方法回退成立；普通 `{rows,schema}` 结果没有 window 方法。新增有限 `spl_window` 即可，勿重写窗口引擎。 |
| E11 | pivot/groupc/groupi：[Sequence.java](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/dm/Sequence.java:10345) | 保留 core 公开面止于 project/filter/aggregate/join/window：[dataset.ts](/Users/kongweixian/infra-dev/spl-bun/packages/core/src/dataset.ts:54)；11 个 Kon word 列表见 E10 | missing | pivot/unpivot、嵌套分组、分段/有序组运算是合理后续计算切片；与 Excel 模板横向扩展相关但不应把两者混成一套模型。先由真实交叉报表 fixture 确定需要哪种。 |
| E12 | 序列 union/isect/diff/calc：[Sequence.java](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/dm/Sequence.java:1368) | expression 有集合运算符与 calc：[evaluator.ts](/Users/kongweixian/infra-dev/spl-bun/packages/expression/src/evaluator.ts:101)、[calc](/Users/kongweixian/infra-dev/spl-bun/packages/expression/src/evaluator.ts:182)；数组/表 count、sum/avg/min/max、first/last：[memberRegistry.ts](/Users/kongweixian/infra-dev/spl-bun/packages/expression/src/memberRegistry.ts:315) | partial | 基础数组计算已存在；嵌套序列、1-based 索引、重复值/集合相等、位置选择、字段引用、完整序列方法族未全量验证。不要因没有 Sequence 类而把这些功能全部判缺失。 |
| E13 | 表主键/record/字段结构：[Table.java](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/dm/Table.java:199) | field/fname/fno/key/record、keys/row：[memberRegistry.ts](/Users/kongweixian/infra-dev/spl-bun/packages/expression/src/memberRegistry.ts:477)、[keys/row](/Users/kongweixian/infra-dev/spl-bun/packages/expression/src/memberRegistry.ts:570) | partial | 当前是 JS 对象/数组适配，keys 仅附加数组、row 比较的是每个主键列均等于同一个 key。不能据函数存在推定复合主键、DataStruct、索引、约束、表变更已等价实现。 |
| E14 | Expression AST、Context、macro、typed 函数库：[Expression.java](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/expression/Expression.java:81) | AST/parser/evaluator、param tree、macro、成员注册表均导出：[index.ts](/Users/kongweixian/infra-dev/spl-bun/packages/expression/src/index.ts:1)；SPL options 与分号组：[parser.ts](/Users/kongweixian/infra-dev/spl-bun/packages/expression/src/parser.ts:147) | implemented | 旧表达式引擎作为内部计算组件已有实际价值；外层控制流与编辑入口采用 Kon。无需恢复 Excel 自定义表达式网格。Java `:alias` 直接调用形态并未全面解析，原生 Conf 可以表达别名。 |
| E15 | 原函数库 567 个 expression Java 文件，含多类函数与基础设施 | 66 个 builtins 源码键：[functions.ts](/Users/kongweixian/infra-dev/spl-bun/packages/expression/src/functions.ts:273)；日期/正则/数值等现有测试：[datePhase2.test.ts](/Users/kongweixian/infra-dev/spl-bun/packages/expression/__tests__/datePhase2.test.ts:1) | partial | 已覆盖数学、字符串、JSON、日期、like/regex、聚合、条件。文件数不等于函数数；数值精度、日期时区、空值、错误/未定义变量行为需用使用案例锁定，不能宣称完整兼容。 |
| E16 | JDBC DBSession 与隔离/savepoint：[DBSession.java](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/common/DBSession.java:87) | SQLite prepare/all、DML、close：[context.ts](/Users/kongweixian/infra-dev/spl-bun/packages/kon-spl-dsl/src/context.ts:138)；旧 flow commit/rollback adapter：[index.ts](/Users/kongweixian/infra-dev/spl-bun/packages/spl-flow/src/index.ts:490) | partial | 参数查询、写入和事务 SQL 可用；没有统一 transaction capability，也没有 JDBC 驱动面。Kon 数据源同步、每次运行关闭；跨请求事务不可假定。SQLite authority 是 DB，DataSet 为查询投影。 |
| E17 | 通用 FileObject 导入、流式导出、charset/分隔与类型：[FileObject.java](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/dm/FileObject.java:340) | CSV 使用 split newline / split delimiter：[context.ts](/Users/kongweixian/infra-dev/spl-bun/packages/kon-spl-dsl/src/context.ts:169)；旧 async CSV 同样简单分割：[csv.ts](/Users/kongweixian/infra-dev/spl-bun/packages/spl-flow/src/datasource/csv.ts:42) | partial | **RISK：现实 CSV 导入有数据损坏风险。** 带引号逗号、多行、转义引号不被识别；空白被 trim，`001` 可被数值化。旧 async CSV 建 TEXT 表，Kon 同步 CSV 做数值归一，双路径类型也不同。应把真实导入接入的格式策略一次定清。 |
| E18 | 通用文本/结构化输入 | JSON object/array、首记录列集合：[context.ts](/Users/kongweixian/infra-dev/spl-bun/packages/kon-spl-dsl/src/context.ts:200)；旧 async JSON 有 arrayPath：[json.ts](/Users/kongweixian/infra-dev/spl-bun/packages/spl-flow/src/datasource/json.ts:42) | partial | Kon JSON 无 arrayPath，后续记录新增字段不进 schema；nested object 经临时 SQLite 会字符串化。是有限文件输入，不是任意 JSON 数据模型。 |
| E19 | 原 `T` 根据格式展开 xlsimport/xlsexport、cursor、import/export：[T.java](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/expression/fn/T.java:217) | 旧 flow `T()` 支持 xls/xlsx sheet、header、无头模式：[index.ts](/Users/kongweixian/infra-dev/spl-bun/packages/spl-flow/src/index.ts:223)；写出新工作簿：[index.ts](/Users/kongweixian/infra-dev/spl-bun/packages/spl-flow/src/index.ts:296) | partial | 只是表格 IO，不能保留/展开模板格式、合并、父格、公式、分页。可经 `spl_flow` 内嵌 cells 兼容调用，Kon 没有原生 workbook IO word。 |
| E20 | 原 FileObject read/write/import/export | flow file handle 只提供 read：[index.ts](/Users/kongweixian/infra-dev/spl-bun/packages/spl-flow/src/index.ts:184)；CSV/JSON `T` 明确拒绝 export：[index.ts](/Users/kongweixian/infra-dev/spl-bun/packages/spl-flow/src/index.ts:421)；expression file/cursor 注册仅委派宿主函数：[memberRegistry.ts](/Users/kongweixian/infra-dev/spl-bun/packages/expression/src/memberRegistry.ts:445) | partial | `read/write/import/export` 名字存在不代表生产 handle 实现齐全。CSV/JSON 结果导出、下载与制品管理仍需实现；Excel plain export 已有，可复用适配。 |
| E21 | 内存/File/DB cursor、fetch/skip/close、sortx/groupx/joinx：[ICursor.java](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/dm/cursor/ICursor.java:339)、[sortx](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/dm/cursor/ICursor.java:1202) | 有 CursorHandle tag/宿主委派，但数组 fetch/skip 是 slice：[memberRegistry.ts](/Users/kongweixian/infra-dev/spl-bun/packages/expression/src/memberRegistry.ts:393)；SQLite 用 all：[sqliteAdapter.ts](/Users/kongweixian/infra-dev/spl-bun/packages/sqlite-adapter/src/sqliteAdapter.ts:20)；Excel 明确拒绝 `T@c`：[index.ts](/Users/kongweixian/infra-dev/spl-bun/packages/spl-flow/src/index.ts:365) | missing | 生产级 cursor 生命周期与 bounded-memory 流水线未实现。SQL limit/offset 是分页替代，不是 cursor/streaming。未来应单独定义 async iterator、batch、close/abort、materialize 边界及内存验收。 |
| E22 | PgmCellSet 控制流、函数、异常：[PgmCellSet.java](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/cellset/datamodel/PgmCellSet.java:2224) | flow 支持 if/elseif/else/for/break/continue/goto/func/return/result/end/try：[grid.ts](/Users/kongweixian/infra-dev/spl-bun/packages/spl-flow/src/flow/grid.ts:5)；sync/async 共享 generator core：[index.ts](/Users/kongweixian/infra-dev/spl-bun/packages/spl-flow/src/index.ts:599) | implemented | 旧 flow 核心并非“只有顺序求值”。保留兼容执行即可；用户产品控制流用 Kon，本轮不补旧网格 UI。 |
| E23 | 原程序执行可循环、fork/channel/远程执行：[PgmCellSet.java](/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/cellset/datamodel/PgmCellSet.java:1439) | runSplKon 同步执行，64KB 源码限制，finally close：[run.ts](/Users/kongweixian/infra-dev/spl-bun/packages/kon-spl-dsl/src/run.ts:61)；历史已将真超时列 backlog：[decisions.md](/Users/kongweixian/infra-dev/spl-bun/codument/missions/archived/2026-07-10-migrate-flow-web-to-kon/decisions.md:13) | partial | **RISK：源码大小限制不能中断无限循环/大计算。** Web 请求中执行同步 Kon；在加入真实上传和长报表前，需独立 worker/进程、取消/时限与行/制品资源上限。Kon 真异步 dispatch 尚不支持，旧 flow async 支持不等于 Kon async。 |
| E24 | 原文件数据/Excel 可直接参与运算 | 当前服务器只有 health/execute-kon；数据源为 5 个固定 demo 配置：[server.ts](/Users/kongweixian/infra-dev/spl-bun/packages/web-server/src/server.ts:181)；IDE 只有文本/Run/Demo：[KonIde.vue](/Users/kongweixian/infra-dev/spl-bun/packages/web-ide/src/pages/KonIde.vue:85) | missing | **RISK：真实用户输入到输出的产品闭环未达成。** 无上传/数据资产登记、模板选择、report render/download 路由。Excel Roundtrip demo 只是静态“moved to backlog”行：[konDemos.ts](/Users/kongweixian/infra-dev/spl-bun/packages/web-ide/src/pages/konDemos.ts:166)。标签通过不能作为 Excel 验收。 |
| E25 | 多种连接器、DW、并行与专用库：`importlibs` 22 个一级目录，`dw` 84、`parallel` 41 个 Java 文件 | 当前 DataSource union 仅 SQLite/CSV/JSON：[types.ts](/Users/kongweixian/infra-dev/spl-bun/packages/spl-flow/src/datasource/types.ts:6) | missing | Mongo/Redis/Kafka/Hadoop/云服务、JDBC/ODBC、集群、专用数学/金融算法、二进制组表/列存等属于长期 backlog；没有业务 fixture 时，不把它们纳入立即移植范围。 |
| E26 | Java IDE、HTTP/ODBC 与 CLI 启动面：[README.md](/Users/kongweixian/infra-dev/esProc/bin/README.md:1) | Bun workspace/build/test，Kon IDE/server、composer 有明确 runtime adapters：[runtime.ts](/Users/kongweixian/infra-dev/spl-bun/packages/composer/src/runtime.ts:23) | partial | 新平台已有替代产品形态；Java Swing IDE、原 JDBC 驱动、ODBC 协议、d​​fx 二进制项目兼容不是当前隐含承诺。脚本保存/版本/发布可另切产品任务。 |
| E27 | 旧产品曾使用 SPL 表格编辑入口 | 当前只保留 Kon 端点，旧端点被明确禁止：[web-flow-api.xml](/Users/kongweixian/infra-dev/spl-bun/codument/behaviors/web-flow-api.xml:3)；迁移决策不嫁接 Univer：[decisions.md](/Users/kongweixian/infra-dev/spl-bun/codument/missions/archived/2026-07-10-migrate-flow-web-to-kon/decisions.md:10) | retired | 不应以“原 IDE 已移除”判迁移回退，更不应恢复 Excel 自定义表达式网格。Excel 是输入模板/输出制品；Kon 是控制与计算入口。 |
| E28 | 八月 Domain/ORM/workbench/temporal organization 历史 mission | 当前明确外迁 Domain 协议/runtime/server/reference/UI 与 ORM adapter conformance：[source-only-scope.xml](/Users/kongweixian/infra-dev/spl-bun/codument/behaviors/source-only-scope.xml:3) | retired | 这些删除不是 esProc 计算移植缺口。自有基础库承接的实现由另一盘点主题确认；本报告不对其外部实现做“缺失”判定。 |
| E29 | 原 Java 是语义参照，但尚未实际运行 oracle | 本次只运行现有 core 测试和 V1–V3 TS 反例 | unknown | 不宣称全库逐函数 parity 或 Java/TS 全量差分通过。下面的 V 表区分源语义证据、目标约定和已实测结果。 |
| E30 | esProc POM 声明 Apache-2.0：[pom.xml](/Users/kongweixian/infra-dev/esProc/pom.xml:16)；附带库有独立 LICENSE | 本次只读研究，没有复制 Java 源码；根目录未发现 LICENSE/NOTICE 文件（只读目录计数） | unknown | 复制/翻译实际代码前按文件来源建立 provenance；根 POM 不能推断所有 importlibs/JAR/文档/商标的许可相同。详见许可记录。 |

## 事实、authority 与 IO 边界

计算图不是长期状态 authority，也没有证据激活 canonical event-log/replay profile。本报告的 `streaming` 指批次/迭代器 IO，不把它误认为 ReactiveDataGraphProfile；后者在该计算内核范围标 `NOT_APPLICABLE`。Web Vue 响应式显示不决定数据源真相。

| ID / 节点 | semantic_role / authority_model | owner / transition entries | physical writes / evidence | 有向关系与裁决 |
|---|---|---|---|---|
| F1 Kon source 与绑定 | source 是调用输入值；env 是每次运行的 `runtime_control / memory_authority` | 调用方拥有 source；Kunun runtime 拥有当前绑定，word 通过注册展开器写命名值 | [run.ts](/Users/kongweixian/infra-dev/spl-bun/packages/kon-spl-dsl/src/run.ts:74)、[shared.ts](/Users/kongweixian/infra-dev/spl-bun/packages/kon-spl-dsl/src/words/shared.ts:47) | source → runtime → DataSet/result；bindings 返回快照是 observation。`clean`，没有跨请求变量 authority。 |
| F2 数据源配置/句柄注册表 | `runtime_control / memory_authority` | SplContext，openDataSource；同名注册拒绝 | [context.ts](/Users/kongweixian/infra-dev/spl-bun/packages/kon-spl-dsl/src/context.ts:44)、[openDataSource](/Users/kongweixian/infra-dev/spl-bun/packages/kon-spl-dsl/src/context.ts:94) | config → 打开外部资源；执行结束 finally close。`clean`；未来上传资产目录应独立为 durable owner，勿以这个临时 map 充当持久资产仓库。 |
| F3 SQLite 数据 | `current_authority / durable_authority`（`:memory:` 为临时） | 数据库文件/SQLite 事务；宿主授权的 execute 是 transition boundary | [context.ts](/Users/kongweixian/infra-dev/spl-bun/packages/kon-spl-dsl/src/context.ts:138) | query projects → DataSet；execute commands → DB。demo 启动 DB 与每次运行新句柄都通过 SQLite 写协议，不自动视为 authority conflict。 |
| F4 CSV/JSON/Excel 文件 | `external_authority` 的输入文件；缓存为 `derived_observation / cache` | 文件创建者拥有输入内容；runtime loader 只读；Excel export 通过显式目标路径新建制品 | [context.ts](/Users/kongweixian/infra-dev/spl-bun/packages/kon-spl-dsl/src/context.ts:257)、[Excel write](/Users/kongweixian/infra-dev/spl-bun/packages/spl-flow/src/index.ts:296) | file → parsed rows → temporary SQLite projection；缓存不回写源文件。新制品与源模板需分离 ID/path；当前未出现真实 projection backwrite 证据。 |
| F5 DataSet 与中间记录 | `derived_observation / per-run value` | 计算内核拥有转换语义；并非 durable data owner | [dataset.ts](/Users/kongweixian/infra-dev/spl-bun/packages/core/src/dataset.ts:58)、[toArray](/Users/kongweixian/infra-dev/spl-bun/packages/core/src/dataset.ts:303)、[field setter](/Users/kongweixian/infra-dev/spl-bun/packages/expression/src/memberRegistry.ts:479) | 引用数组/记录可共享，readonly 不等于深度不可变；field/record 可以改共享行。`model_uncertain`：应为本轮语义基线明确 copy-on-transform、哪些显式 mutation 允许。尚未证明 durable authority 被反写。 |
| F6 结果 API/ResultTable/历史 Codument | 结果为 `derived_observation`；旧 plan/mission 为 `historical_record / versioned_repository` | API 投影由 server，显示由 ResultTable；历史记录不能裁决当前运行实现 | [server.ts](/Users/kongweixian/infra-dev/spl-bun/packages/web-server/src/server.ts:216)、[ResultTable.vue](/Users/kongweixian/infra-dev/spl-bun/packages/web-ide/src/components/ResultTable.vue:166) | runtime → response → UI；历史证据 → 本报告，不反向覆盖当前 source-only scope。`clean`。 |

effect 的实际发生点是文件读写、SQLite、HTTP response；core 的纯转换与运行注册表不是同一 owner。当前 Kon context 与 spl-flow 各有 CSV/JSON/SQLite IO 实现；未来用一个明确 effect contract 承载格式解析/数据读取，Kon word 负责参数转换与控制，避免第二份“同名但不同类型/空值语义”的逻辑。

## Codument 历史与当前事实

| ID | 历史轨迹与证据 | 当前裁决 |
|---|---|---|
| H1 | 2026-01-10 初始 scaffold：v1 限 projection/filter/aggregate，SQLite 声称 streams：[spec.md](/Users/kongweixian/infra-dev/spl-bun/codument/tracks/archived/2026-01-10-create-spl-bun-monorepo/spec.md:43)、[stream 声明](/Users/kongweixian/infra-dev/spl-bun/codument/tracks/archived/2026-01-10-create-spl-bun-monorepo/spec.md:67) | 初始有限目标已被后续拓展。当前 all() 实现不是 streaming（E21）；不能引用旧文字当流式完成证据。 |
| H2 | 2026-01-10 join/window 与表达式移植：[join spec](/Users/kongweixian/infra-dev/spl-bun/codument/tracks/archived/2026-01-10-add-join-window-ops/spec.md:3)、[expression spec](/Users/kongweixian/infra-dev/spl-bun/codument/tracks/archived/2026-01-10-port-expression-engine/spec.md:23) | 行为确实存在；当前 22 个 core 测试通过，但未覆盖 V1–V3。历史完成不等于边界语义无错误。 |
| H3 | 2026-01-18 聚合生命周期与 IO/table；plan 已收窄为 connect、query/execute/commit/rollback、record 与 keys/row；其余 file/cursor/vdb/完整表结构延期：[plan.xml](/Users/kongweixian/infra-dev/spl-bun/codument/tracks/archived/2026-01-18-update-expression-engine-port/plan.xml:52)、[remaining gaps](/Users/kongweixian/infra-dev/spl-bun/codument/tracks/archived/2026-01-18-update-expression-engine-port/plan.xml:152) | E05/E13/E16/E20/E21 的有限实现与明确延期吻合；该 archived track 从未承诺所有 IO 完成。 |
| H4 | 2026-01-23 Excel：明确仅 row-wise table，非完整 workbook API：[spec.md](/Users/kongweixian/infra-dev/spl-bun/codument/tracks/archived/2026-01-23-add-excel-integration-web-ide-demos/spec.md:3)；同期 flow control track：[spec.md](/Users/kongweixian/infra-dev/spl-bun/codument/tracks/archived/2026-01/2026-01-23-2216-impl-flow-control/spec.md:1) | E19 plain IO 是真实能力；不是报表引擎。旧 [flow diff](/Users/kongweixian/infra-dev/spl-bun/doc/feature-findings/flow-ctrl/flow-ctrl-feature-diff.md:10) 仍写“NO flow control”，已被当前 grid.ts 与测试推翻，不能沿用为待办。 |
| H5 | 2026-07-04 Kon mission completed，先桥接后高频 native word：[mission.xml](/Users/kongweixian/infra-dev/spl-bun/codument/missions/archived/2026-07-04-kon-spl-dsl/mission.xml:3)；window 单独留 backlog | 11 个 word 已在当前代码注册；window 只缺公开映射，属于短切片。无须重启已完成 mission。 |
| H6 | 2026-07-10 Web 迁移：Kon 文本为主，不嫁接 Univer；保留底层 FlowCell；真超时 backlog：[decisions.md](/Users/kongweixian/infra-dev/spl-bun/codument/missions/archived/2026-07-10-migrate-flow-web-to-kon/decisions.md:7) | 当前路由/页面符合 Kon-only；Excel demo 变成 backlog 占位，需据实际业务链重新接回，而非恢复网格。 |
| H7 | 八月多轮 Domain runtime/workbench/ontology/organization mission；当前 source-only behavior 明确外迁这些 owner | E28 为 retired/extracted；保留其历史是正常的记录，不构成需要恢复这些业务包的依据。 |

## 原语义到 Kon 的验收样例

此表是可执行验收设计，**只有 V1–V3 标记为本次已重现**。原表达式示例用于描述原能力，Java 未执行；复原 Java 输出时应使用 fixture+oracle。目标可以选择不同公开语法，但需显式记录差异并避免丢数。

| ID | 原语义/输入例 | 目标 Kon/TS 验收与期望 | 当前观测 |
|---|---|---|---|
| V1 | `A.groups(a,b;count(1):n)`，键分别是 `(x\u007cy,z)` 与 `(x,y\u007cz)` | `(spl_groups :{in = rows keys = [a b] agg = {n = "count(v)"}})`；应有两组且保留两对原键（数据行 v 均非空） | **已重现错误**：变成一组 `a=x,b=y,n=2`，命令见下。 |
| V2 | 等值连接按两个独立字段比较；左 `(x\u0001y,z)`，右 `(x,y\u0001z)` | `spl_join` inner 结果必须 0 行；追加 null/undefined、数字/字符串、Date、列前缀碰撞用例 | **已重现错误**：返回 1 行；core 与 expression 两条路径都必须参与回归。 |
| V3 | 两个独立累计量 `sum(a)` 和 `avg(b)`，a=[10,20]，b=[100,200] | 拟 `spl_window` 输出 `sa=[10,30]`、`ab=[100,150]`，同时与两个独立 window 调用比较 | **已重现错误**：`ab=[10,15]`。 |
| V4 | `A.groups(k;sum(v):total)`；k 为 number、Date、null/缺失、含分隔符字符串；空输入 | Kon 分组键值/类型保真；typed tuple equality；组内 count(0/空串/null) 明确，空输入全表聚合是否 1 行明确 | 数值键转字符串已在 README 限制中说明；空输入无行与行为“全表单行”需选定并锁测试。 |
| V5 | 原 derive 可按表达式/依赖顺序派生 | `cols={a="x+1", b="a+1"}` 的 b 到底能看同批 a，须明确；行字段 > with > env > ctx.scope | core 以原始 row 求值每列；expression derive 用逐步扩展 base，两路径不同，未作本次额外 probe。 |
| V6 | CSV `name,note,id` 后接 `"A,B","line1\nline2",001`；JSON 后行新增字段；Excel 两个 sheet/日期/空单元格 | UI 上传后给出 asset ID，Kon 显式读取；引号/新行/编码/列类型策略正确，预览与运行使用同一解析快照 | 当前没有上传入口，CSV parser 不能表达该案例。优先作为数据输入 mission 的固定 fixture。 |
| V7 | 原 `T(path;sheet)` + `T(path,data;sheet)`，header/@b | Kon 显式 table read/write，直接读取或导出同一真实 workbook；随后进入独立模板 render IR | 旧 flow IO 有代码/测试；当前 Excel demo 为静态提示，不能作为 roundtrip 证据。 |
| V8 | `A.cursor().fetch(2)` 连续 fetch 应推进；close/exception 应释放资源 | batch 1/2/EOF、cancel、error、重复 close；100 万行下限制内存，不提前 all()/readFileSync 整体加载 | 只有 slice/委派占位；SQL分页 demo 不能证明此契约。 |
| V9 | 原 for/if/func/try 与数据源调用 | 由 Kon 原生控制流组合 `spl_*`，兼容 FlowCell 只需结果对齐；循环超时可取消 | 底层 flow 已支持；运行隔离/取消是独立工作。 |

### 3 个实际反例与命令

均在 `/Users/kongweixian/infra-dev/spl-bun` 执行，Bun `1.3.14 (0d9b296a)`，exit code 均为 0。它们是行为观测命令，不是对仓库测试的修改。

V1：

```sh
bun --eval 'import { DataSet } from "./packages/core/src/dataset.ts"; const data = DataSet.fromRows([{a:"x|y",b:"z",v:1},{a:"x",b:"y|z",v:2}]); console.log(JSON.stringify(data.aggregate({groupBy:["a","b"],aggregates:{n:rows=>rows.length}}).rows));'
```

实际输出：

```json
[{"a":"x","b":"y","n":2}]
```

期望有两组，键分别保留为 `{"a":"x|y","b":"z"}` 与 `{"a":"x","b":"y|z"}`。

V2：

```sh
bun --eval 'import { DataSet } from "./packages/core/src/dataset.ts"; const left = DataSet.fromRows([{a:"x\u0001y",b:"z"}]); const right = DataSet.fromRows([{a:"x",b:"y\u0001z",r:2}]); console.log(JSON.stringify(left.join(right,{type:"inner",leftKeys:["a","b"]}).rows));'
```

实际输出：

```json
[{"a":"x\u0001y","b":"z","right_a":"x","right_b":"y\u0001z","r":2}]
```

期望 `[]`。

V3：

```sh
bun --eval 'import { DataSet } from "./packages/core/src/dataset.ts"; console.log(JSON.stringify(DataSet.fromRows([{id:1,a:10,b:100},{id:2,a:20,b:200}]).window({orderBy:[{column:"id"}],outputs:{runningSum:{column:"a",as:"sa"},runningAvg:{column:"b",as:"ab"}}}).rows));'
```

实际输出：

```json
[{"id":1,"a":10,"b":100,"sa":10,"ab":10},{"id":2,"a":20,"b":200,"sa":30,"ab":15}]
```

期望 `ab` 分别为 100、150。

既有验证：`bun test packages/core/__tests__` → **22 pass、0 fail、36 expect，4 files**。这说明现有测试能确认普通路径，但上述反例尚不在保护面里；本报告没有把绿色测试当成语义等价证明。

## 有限续作切片（交给父层编排）

这些是建议的 mission 边界，不在此处创建 Codument 或新的执行状态。先交付数据+Excel 模板报表闭环，再按下面顺序推进计算能力，不等全部 Java parity 才可交付。

| ID | 期望态 / 依赖 | 有限范围与验收 | 明确保留到后续的范围 |
|---|---|---|---|
| M1 | 序表语义基线；应作为报告聚合的前置小阶段 | 修复 V1–V3；typed tuple key 与原键保真；合并/复用 expression/core 的 group/join 相等规则；明确大小写/null/未匹配列/列前缀；现有测试与新增反例全部通过；至少跨 `spl_groups/spl_join/spl_eval` 比较一致 | 不新增连接器/全部函数，不一次性重写类型系统。DataSet schema/同批 derive 顺序可据报表依赖追加一组固定测试。 |
| M2 | Kon 既有分析能力可用；依赖 M1 | 增加 `spl_window`，只映射现有 partitionBy/orderBy/rowNumber/rank/denseRank/runningSum/runningAvg；作用域、alias、错误与其他原生 word 一致；用销售分区排名、不同 measure、空表、ties、两次执行隔离验证 | lag/lead、任意 frame、复杂时序分析留 backlog；这不是重做窗口内核。 |
| M3 | 浏览器真实数据→Kon→结果；报告闭环输入前置，可与模板内核顺序集成 | 上传 CSV/JSON/XLSX，资产 ID 与输入快照由 server repository 拥有；Kon 明确读取 asset ID/sheet；真实 CSV 引号/编码/空值/类型测试；Table preview 与执行共享解析契约；出错不创建半成品资产 | 暂不开放任意外部网络连接器；输入资产不是 Domain/ORM 工作台。 |
| M4 | 数据+模板报表闭环；依赖 M1/M3 与 nop-report 主题结果 | 新模板/报表 IR owner 与输出 adapter，Kon 显式传数据+template asset；真实展开、格式/合并/公式投影、预览/下载，由 nop-report 库存确定最小语义；验收使用实际模板，不使用静态 Excel demo | 不复活 Univer 表达式 IDE；不把 xlsx json_to_sheet 当模板 renderer；不移植 Java 企业框架。 |
| M5 | 真实长计算可控；在上传/长报表进入常用产品面时落实 | 执行 worker/进程与取消/时限；资源关闭；输出制品按 run ID 关联；超时能恢复服务且不污染后次请求；正常同步 Kon 语义仍通过 | 不借此实现分布式调度或事件溯源。 |
| M6 | 报表数据整理第二批；依赖真实缺口样例 | 根据首批模板选择 **一个**：full/semi/anti join，或 pivot/unpivot；输入重复键、null、未匹配、输出 schema 与稳定次序验收；原 source 的 full/交差连接与 pivot 作为参考 | 不因“Java 有类”同时导入所有 join/index/foreign-key 变体。right 可作为交换方向适配。 |
| M7 | 大数据流式计算；独立长期能力 mission | Cursor/batch contract + async source + operator chain + materialize/export boundary；先 CSV/SQLite，fetch推进、取消/close、固定内存界限与可观测统计验收 | sort spill、merge/groupx/joinx、列存/分区/并行在基线通过后各自切片。 |

长期 backlog 要显式承认：完整序列/record/DataStruct/索引语义、复杂聚合与窗口 frame、pivot 和有序分段计算、完整参数语法/函数选项、精度与时区兼容、生产 cursor/spill、连接器/JDBC/ODBC、DW/组表/二进制文件、fork/channel/distributed、原脚本文件与 IDE/CLI 互操作。它们暂时不构成当前报表产品必须同时暴露的 API 面。

## 许可与复制来源记录

本次没有复制 Java 源码。原仓库 [pom.xml](/Users/kongweixian/infra-dev/esProc/pom.xml:16) 自述 Apache License 2.0。仓库根没有发现单独 LICENSE/NOTICE；多个 `importlibs/*/LICENSE` 单独存在。不能仅以根 POM 推断第三方 JAR、所有可选库、截图/文档与品牌素材都可以同样处理。

若后续逐段翻译/复制代码，需要在实现中记录原文件、版本/commit、移植范围与修改说明，并把相应许可/署名随分发产物保留。当前本地附带 Apache 文本的 §4 明确列出了提供许可证、修改文件声明、保留相关原始 notices、在上游提供 NOTICE 时带上相应 attribution 的条件，证据见 [LICENSE](/Users/kongweixian/infra-dev/esProc/importlibs/rediscli/LICENSE:90)。本报告只记录本地声明和条文位置；对不同来源/商业发行物的权利范围仍为 unknown。以语义测试独立实现时，同样应记录测试/文档样例来源，避免不知来源地批量搬运代码或素材。
