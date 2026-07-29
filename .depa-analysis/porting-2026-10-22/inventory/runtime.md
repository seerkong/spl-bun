---
status: active
last_verified: 2026-10-22
scope: system/package
---

# Runtime、数据输入与工程基线盘点

扫描对象为 `/Users/kongweixian/infra-dev/spl-bun` 的当前工作区；下列 `packages/` 路径均以此为根。现有业务领域外迁删除是输入事实，未恢复、重置或修改。本文仅新增分析文件。盘点表共 **30 行**（事实节点 7、读写路径 8、包边界 10、问题 5），**RISK 5 项**；风险不是现有回归失败的同义词。

目前可运行的是 Kon 查询/计算 IDE；Excel 仅有本地文件表格导入导出。网页上传、模板编译、动态展开、保留模板样式的报表导出均无产品路径。计算库和 Kon 门面可复用；报表需要新的内核边界，但不需要复制语言解释器、ZIP/XML 库或引回外迁业务域。

## 事实节点

| ID / 数据节点 | semantic role | authority model | authority owner | transition entries | physical writes | relations | verdict | 证据 |
|---|---|---|---|---|---|---|---|---|
| F1 Kon 源码与初始 scope | immutable input | request value | 请求调用者 | `POST /api/execute-kon` | 请求体；UI `source.value` | commands → fresh runtime | clean | `packages/web-shared/src/index.ts:26`; `packages/web-ide/src/pages/KonIde.vue:50`; `packages/web-server/src/server.ts:196` |
| F2 单次执行的 Kon 环境与数据源注册表 | current_authority / runtime_control | memory_authority | 单次 `runSplKon` 创建的 Kunun runtime + SplContext | `EnableSplDsl`、`runtime.define`、`openDataSource` | `Map.set`、当前 env 的变量表 | owns bindings；observes source files；projects → result | multi-entry | `packages/kon-spl-dsl/src/run.ts:74`; `packages/kon-spl-dsl/src/context.ts:94`; `packages/kon-spl-dsl/src/words/shared.ts:47` |
| F3 SQLite 业务数据 | current_authority | durable_authority | SQLite 文件 / 同一数据源连接 | `spl_execute`、SQL 初始化脚本 | `Database.run`、`db.exec` | query projects → DataSet；DML changes authority | multi-entry | `packages/kon-spl-dsl/src/context.ts:138`; `packages/web-server/src/server.ts:107`; `packages/web-server/src/server.ts:179` |
| F4 CSV/JSON/Excel 源文件 | current_authority（外部输入） | file/external_authority | 文件作者；导入仅观察 | `T()`、`spl_connect`/`spl_query` | 导入路径无写入 | projects → rows/schema；文件数据源缓存可丢弃 | clean | `packages/spl-flow/src/index.ts:223`; `packages/kon-spl-dsl/src/context.ts:257`; `packages/kon-spl-dsl/src/context.ts:278` |
| F5 DataSet 与 flow 单元格值 | derived_observation / runtime_control | invocation-local memory | flow 执行器；值来自上游输入 | 计算步骤、cell 求值、result/lastQuery 选择 | 局部 scope、evalByRef、ExecutionContext.results | derives from files/queries；projects → QueryResult | clean | `packages/core/src/dataset.ts:54`; `packages/core/src/execution.ts:22`; `packages/spl-flow/src/index.ts:651`; `packages/kon-spl-dsl/src/words/flow.ts:93` |
| F6 浏览器结果表与选择状态 | derived_observation | UI-local memory | KonIde / ResultTable 组件 | fetch completion、props、鼠标选择 | `resultColumns.value`、`resultRows.value`、selection refs | observes API result；copies → TSV clipboard | clean（ordering 见 I5） | `packages/web-ide/src/pages/KonIde.vue:31`; `packages/web-ide/src/components/ResultTable.vue:20`; `packages/web-ide/src/components/ResultTable.vue:121` |
| F7 当前 Excel 导出文件 | derived_artifact | file projection | T 导出函数 | `T(path,data;sheet)` | `writeFileSync` | projects rows → 新建 workbook；无模板输入关系 | clean，但不满足模板报表目标 | `packages/spl-flow/src/index.ts:296`; `packages/spl-flow/src/index.ts:417` |

这里没有 canonical event authority 或 replay，`EventSourcedStateProfile: NOT_APPLICABLE`。Vue refs/computed 激活 UI 局部 ReactiveDataGraphProfile：输入为 API 结果和 props，owner 为组件；没有自建响应式运行时图或 depa-data-graph 依赖。数据关系单向，但异步结果的请求关联尚未声明，profile 该项为 GAP（I5）。不因缺少事件日志或自定义 graph 判定计算内核有缺陷。

## 关键读写路径

| ID / 路径步骤 | 操作/位置 | 输入来源 | relation | owner boundary | 标记 |
|---|---|---|---|---|---|
| P1 浏览器执行入口 | KonIde `runScript`，`packages/web-ide/src/pages/KonIde.vue:40` | 编辑器源码 | commands | JSON contract → server | OK-declared-relation |
| P2 服务端装配 | `createApp`，`packages/web-server/src/server.ts:160` | root/env、demo.db、固定 sales/products/config/users 清单 | configures / observes | shell 负责路径、数据库生命周期 | OK-authority |
| P3 单请求执行 | `runSplKon`，`packages/kon-spl-dsl/src/run.ts:61` | source/scope/dataSources | creates runtime；registers sources；finally closes | 新建 runtime/context，每次隔离；默认源码上限 65536 bytes | OK-declared-relation |
| P4 原生 Kon 数据计算 | `EnableSplDsl`，`packages/kon-spl-dsl/src/enable.ts:26` | env + ctx + word config | transforms | 已注册 connect/query/execute/eval/flow/derive/select/groups/sort/join/top | OK-declared-relation |
| P5 flow 同步桥接 | `deriveFlowContext` / `evaluateFlowSync`，`packages/kon-spl-dsl/src/words/flow.ts:55`; `packages/spl-flow/src/index.ts:644` | scope、sqlite 数据源 | adapts to shared flow core | SQLite adapter 显式传入；遇 Promise 抛 `FlowAsyncValueError`，不能直接挂 async 数据源 | OK-declared-relation |
| P6 表格文件导入 | T dispatch，`packages/spl-flow/src/index.ts:325` | root 内 csv/json/xls/xlsx | projects → rows/schema | 路径经过 lexical root 校验；Excel sheet 支持名字或 1-based index，`@b` 无表头 | OK-declared-relation |
| P7 Excel 导出 | `writeExcelFile`，`packages/spl-flow/src/index.ts:296` | rows/schema | projects → 单 sheet 新文件 | 直接同步 mkdir/write；不经可注入 workbook IO port | OK-declared-relation；I2/I3 |
| P8 网页上传/模板报表 | 路由清单 `packages/web-shared/src/index.ts:5`；server 链结束 `packages/web-server/src/server.ts:222`；UI toolbar `packages/web-ide/src/pages/KonIde.vue:85` | 当前没有 file/template 输入 | 目标链路缺席 | 只有 health/execute-kon，没有 multipart、模板、报表预览或下载 endpoint | UNKNOWN（已证实缺失，I1） |

`spl_eval` 直接调用 `compileExpression(...).evaluate(scope)`，没有 flow 的 T/file/connect runtime functions（`packages/kon-spl-dsl/src/words/eval.ts:23`）。因此现有文件 Excel 能力应通过 `spl_flow` 的 T 路径使用；不能把“表达式计算存在”误当成所有 IO 内置函数可在任意门面调用。`spl_connect` 的公开类型仅 sqlite/csv/json（`packages/kon-spl-dsl/src/words/connect.ts:14`），Excel 目前不是注册数据源类型。

## 包边界

declared role 按技能的包后缀词汇核对；这些历史包大多不采用 contract/logic/support 等 role 后缀，因此 `invalid-name` 只记录现状，不据此扩大为重命名任务。

| 包 | declared role | observed role | capability / authority evidence | 依赖 | role verdict | boundary verdict | 问题/证据 |
|---|---|---|---|---|---|---|---|
| depa-data-expression | expression | logic | AST/compile/evaluate、函数与成员注册表 | 无生产依赖 | invalid-name | ok | `packages/expression/src/index.ts:1`；复用 SPL 表达式语义，不重写 parser |
| depa-data-core | core | logic | DataSet、gather、Engine/step；行与 schema 的临时值 | expression | invalid-name | ok | `packages/core/src/dataset.ts:54`; `packages/core/src/execution.ts:49` |
| depa-data-spl-flow | flow | mixed logic/support | flow 导航、求值和直接 FS/XLSX/SQLite IO 同包 | core、expression、xlsx | invalid-name | ok（IO 未形成独立可注入口） | `packages/spl-flow/src/index.ts:11`; `packages/spl-flow/src/index.ts:59`；新报表内核不应继续塞入该大文件 |
| depa-data-kon-spl-dsl | dsl | adapter/logic | Kunun word 协议 → DataSet/flow/data source；导出 facade 与 context | core、expression、spl-flow、sqlite-adapter、kunun 1.0.4 | invalid-name | ok | `packages/kon-spl-dsl/src/index.ts:9`; `packages/kon-spl-dsl/package.json:14` |
| depa-data-composer | composer | assembly/logic | 显式 runtime 配置、adapter/support/context 注入和 pipeline helpers | core、expression、spl-flow、sqlite-adapter、test-utils | invalid-name | ok | `packages/composer/src/runtime.ts:52`；真实生产实现直接 imports core/expression/sqlite-adapter；manifest 中 test-utils/spl-flow 并非这里的运行路径 |
| depa-data-sqlite-adapter | adapter | adapter/support | bun:sqlite → query/step；不承接模板逻辑 | core；dev test-utils | match | ok | `packages/sqlite-adapter/src/sqliteAdapter.ts`；Kon 为同步 query+DML 同连接，在 context.ts 自建连接，不能假定两者统一 |
| depa-data-web-shared | shared | contract | 两个路由、Kon 请求响应、QueryResultData | manifest 声明 core，当前源无 runtime import | invalid-name | ok | `packages/web-shared/src/index.ts:5`；报表 API 类型应在此边界或独立 report contract 声明 |
| depa-data-web-server | server | shell/support | Elysia HTTP、数据库初始化、workspace/runtime 装配 | kon-spl-dsl、web-shared、Elysia/CORS | invalid-name | ok | `packages/web-server/src/server.ts:9`; `packages/web-server/src/server.ts:160`；只经 Kon 公共入口调用计算 |
| depa-data-web-ide | ide | shell | Vue 3 + router，Kon textarea、TanStack table、TSV copy | web-shared、Vue、vue-router、@tanstack/vue-table | invalid-name | ok | `packages/web-ide/src/router/index.ts:4`; `packages/web-ide/src/components/ResultTable.vue:3`；不是 Excel 表格编辑器或报表布局渲染器 |
| depa-data-test-utils | utils | support | 本地 SQLite 测试 fixture | core | invalid-name | ok | `packages/test-utils/package.json:10`；不让新 report 生产代码反向依赖测试包 |

## 问题与可复现边界

| ID / 事故 | 现场 | 观测现象 | 关键证据链 | 已排除原因 | 结论 |
|---|---|---|---|---|---|
| I1 / RISK 网页目标路径不存在 | 要提供数据文件和 Excel 模板并获得报表 | UI 无文件输入；API 只有 health/execute-kon；无 report 包 | P1/P8；`packages/web-shared/src/index.ts:5`; `packages/web-server/src/server.ts:189` | 不是旧 domain workbench 被误删导致的现成报表能力丢失 | 产品入口和 report contract/kernel 均需新增；不要恢复外迁业务域 |
| I2 / RISK 表导出等同模板报表会丢模板结构 | 把当前 T 导出用于报表 | `json_to_sheet` + `book_new` 总是新建 workbook；只导出 rows/columns | `packages/spl-flow/src/index.ts:276`; `packages/spl-flow/src/index.ts:305` | 现有 Excel 单测通过只证明表值/命名 sheet/格式读写，不证明模板保真 | 表格 IO 与模板编译、展开、布局、导出分别建契约；原模板作为不可变输入 |
| I3 / RISK 当前 XLSX writer 无法承担完整样式写入 | xlsx 0.18.5 内存 workbook 的 A1 设置 font/fill/border/alignment，再 write/read，均带 cellStyles:true | 数值 123、`z=0.00`、merge、row hpt=30、col wch=20 保留；A1.s 仅 `{patternType:"none"}`，所设 font/fill/border/alignment 消失 | 本轮 `bun -e` 实测，包位于 `packages/spl-flow/node_modules/xlsx`，声明 `packages/spl-flow/package.json:13` | 不是没打开 cellStyles（测试已打开）；也不能推断 ZIP 原 XML 无法保真 | 不把 SheetJS 高层 writer 作为完整模板重建器；可复用其 ZIP/读取能力，另用成熟 XML parser 精确更新 OOXML 或评估完整 workbook 库 |
| I4 / RISK 普通 CSV quoted field 被截断 | `evaluateFlowSync([{row:1,col:"A",expr:"csv(raw)"}], {scope:{raw:'name,note\nAlice,"a,b"'}})` | 返回 `{name:"Alice",note:'"a'}`，逗号后字段丢失；无错误 | `packages/spl-flow/src/index.ts:136`; `packages/kon-spl-dsl/src/context.ts:169`; `packages/spl-flow/src/datasource/csv.ts:52` | 不是 SQL 数据源查询导致；纯 csv(raw) 即复现 | 上传 CSV 不应在此基础上再复制简单 split parser；选定统一、支持 quoted/newline/BOM 的解析边界，并声明类型转换策略 |
| I5 / RISK 并发执行结果无请求关联 | 同一页面连续点击 Run，多个 fetch 可能乱序完成 | 源码中每个响应均直接覆盖当前表/状态；按钮无 disabled、无 run id/cancellation/latest 判定 | `packages/web-ide/src/pages/KonIde.vue:40`; `packages/web-ide/src/pages/KonIde.vue:63`; `packages/web-ide/src/pages/KonIde.vue:88` | 不是服务端跨请求 runtime 泄漏（runSplKon 每次 fresh 且已有隔离测试） | source-based 风险，未做浏览器乱序实测；新上传/渲染任务关联 source/template/run，防旧结果覆盖当前选择 |

## 自有库与 XML/ZIP 复用证据

- 实际依赖的语言 authority 为发布包 `kunun@1.0.4`（`packages/kon-spl-dsl/package.json:19`），而不是直接读取 `~/lang/kunun.ts` 源码。包内 node_modules 指向 `.bun/kunun@1.0.4`；根 node_modules/kunun 仍有全局 link，验收应看包内解析。自有仓库 `/Users/kongweixian/lang/kunun.ts/packages/kunun/lib/index.ts:1` 统一导出 core、converter、runtime、type-system、annotations；`runSplKon` 使用 `RuntimeInterpreter` 公共 API，新增报表表达式应接该语言或现有 expression 公共口，不复制解释器。
- 当前生产 manifest 未直接依赖 depa-processor/depa-data-graph/depa-flows/depa-orm。安装快照 `bun.lock`（gitignored）中 `kunun-runtime@1.0.4` 传递依赖 `depa-actor@0.2.0`；本地 `/Users/kongweixian/infra-dev/depa-actor/package.json:3` 是 0.2.2，二者不能混为同一运行版本。
- `/Users/kongweixian/infra-dev/depa-processor/package.json:8` 已提供 processor 公共 exports；`/Users/kongweixian/infra-dev/depa-data-graph/packages/core/package.json:8` 提供 graph core；`/Users/kongweixian/infra-dev/depa-flows.ts/packages/work-ctrl-flow-logic/package.json:5` 已有中断恢复工作流；eager-data-flow-logic 的公共入口见同仓 `packages/eager-data-flow-logic/package.json:5`。后续真需要这些基础能力时消费其 public package，不在 report 包重建通用 actor/processor/workflow 框架；本阶段同步报表计算并不自动需要它们。
- 外迁业务事实归 `/Users/kongweixian/infra-dev/depa-orm.ts` 与 `/Users/kongweixian/infra-dev/depa-domain-suite.ts`。根 node_modules 仍有旧 domain workspace 悬空 links 和全局 ORM links，但当前生产 manifests/入口不依赖它们。不要用链接残留反推应恢复旧包。
- 当前 spl-bun 安装树已有 `sax@1.4.4`，来自 stylus/needle 的传递依赖；它提供 strict/XML namespace/event/source-position parser，没有 writer，也不是当前包可稳定声明使用的直接依赖。若采用，应明确直接依赖，不能 deep-import `.bun`。
- 自有项目已复用成熟 `fast-xml-parser`：`/Users/kongweixian/infra-dev/halfcode-compiler.xml/packages/resource-core/package.json:11` 声明 ^5.2.5，`src/index.ts:95` 显式保留 attributes、关闭 tag/attribute 自动数值转换；resource-mapping `src/index.ts:53` 使用 XMLValidator。该安装树当前版本 5.10.1。报表包应直接声明 parser 依赖，不依赖私有 halfcode compiler 的领域 API。
- 本轮用其公共 `XMLParser`/`XMLBuilder` 做纯内存 OOXML 样例往返：`preserveOrder:true, ignoreAttributes:false, parseTagValue:false, parseAttributeValue:false, trimValues:false, processEntities:true` 保留 `c r="A1" s="3" t="inlineStr"`、XML namespace、`xml:space="preserve"`、前后空格与中文，`&amp;` 解码/重编码正确，XMLValidator 返回 true。可支撑“读取样式索引 + 更新 sheetData”的实现；这只是样例证据，复杂 OOXML 结构/公式/关系/批注/图表仍需 fixture 验收。`/Users/kongweixian/lang/xnl.ts/packages/core/package.json:4` 的 xnl-core 是 XNL 语言 parser，不是 OOXML XML parser。

## 本轮基线与验收命令

环境：Bun **1.3.14**、Node **v26.5.0**，macOS 本地安装依赖完整。当前包内 xlsx **0.18.5**、kunun **1.0.4**。所有命令在 `/Users/kongweixian/infra-dev/spl-bun` 执行。

| 命令 | 本轮结果 | 实际覆盖/限制 |
|---|---|---|
| `bun test` | **306 pass / 0 fail**，742 expect，48 files，7.47s | 当前计算、flow、Kon、Web contract/unit；含两个跟踪的遗留 `.test.js`，不是 306 个独立新场景 |
| `bun run --filter depa-data-kon-spl-dsl typecheck` | exit 0 | noEmit；Kon/source/test typing |
| `bun run --filter depa-data-web-server typecheck` | exit 0 | noEmit；服务端入口和 scripts |
| `bun run --filter depa-data-web-ide typecheck` | exit 0 | vue-tsc noEmit；浏览器 TS/Vue |
| `bun run build` | 全部十包 exit 0 | 先确认没有已跟踪 dist，所有输出在 ignored dist 后运行；Vite 6.4.3，39 modules，前端约 163.05 kB JS。构建后 computational packages 无 tracked diff；没有改业务源码 |
| `bun run test:e2e` | **本轮未运行** | Playwright 会调用 cleanup 关闭 4174/4176 现有服务；规划阶段未扰动本机监听进程。已有六个 Kon e2e 文件，不包含上传/报表 |

不应把“所有现有检查绿”解释为模板报表已完成。当前无新的运行错误；I1–I5 是目标能力缺口或新输入暴露的真实边界。下一阶段至少保留上述 test/noEmit 基线，加 report fixture contract、API multipart/错误路径、网页上传模板→预览→下载→重新解析验收。

开发入口：`bun run dev:backend`（4176）、`bun run dev:frontend`（4174），但两命令先清理占用端口。若需要保留用户当前服务，直接用 `bun run --filter depa-data-web-server dev` 与 `bun run --filter depa-data-web-ide dev` 并选择独立端口。`VITE_API_BASE_URL` 配置浏览器后端；服务端读 `PORT`、`SPL_WORKSPACE_ROOT`、`SPL_DEMO_DB_PATH`、`SPL_DEMO_DB_RESET`（`packages/web-server/src/server.ts:161`、`:170`、`:239`）。现有 demo source 文件使用固定绝对源码目录路径，任意更换 SPL_WORKSPACE_ROOT 时预注册文件会超出新 root，需要随运行装配一并处理，不能仅改环境变量就认为隔离完毕。

## 实施接缝与首要验收

1. **先建报表内核可验证契约**：不可变模板 bytes + 显式 data/parameters + expression/runtime ports → compiled template / expanded workbook observation → export bytes。复用现有 Kon/expression、XLSX ZIP/读取、成熟 XML parser。模板事实归上传输入；cell style index、原始 styles/theme/relationships 属于模板；渲染值和新增位置是派生结果，不回写上传模板。先覆盖静态文本、参数、纵向明细、分组小计、空数据、合并格和保真样式，不把通用 actor/workflow 或 ORM 当先决条件。
2. **接 Web/API 真路径**：新增 multipart 报表请求（数据 xlsx/csv + template.xlsx + parameters/source），shell 负责文件/bytes 生命周期，kernel 不读进程全局路径。将逻辑渲染结果同时投影为浏览器布局预览与可下载 xlsx；请求/结果关联同一 run，错误包含 template/sheet/cell。当前 ResultTable 继续展示数据观察值；报表预览需独立支持合并格/宽高/样式，不能从 TSV table 假装恢复模板。
3. **复用表格导入、修正输入边界**：已有 `T(path; sheet)` 可作为本地数据计算入口；上传 API 需要 bytes/file 接缝，而不是让用户输入服务器绝对路径。统一 CSV quoted 字段与类型归一策略；覆盖 xlsx sheet、空表、保留 schema、日期/数字和多源数据。不复制 context.ts、spl-flow/index.ts、datasource/csv.ts 的三份 split parser。
4. **最后扩充计算能力并保持语言入口一致**：DataSet、flow 和原生 Kon words 使用同一计算事实；窗口等能力应从公共计算 API 适配为 word，避免在 UI 或 report 中复制。保留 `evaluateFlowSync` 明确的同步语义；如果报表 IO 走 async，先在 shell await 再传纯数据，或另设明确 async 门面。

首个端到端验收应实际上传包含中文、金额格式、合并表头和明细样式的模板及数据，预览展示扩展行/小计；下载后重新读取并比较值、公式策略、merge、row/col dimensions、`styles.xml`/theme 原字节（若采用原包保留路线）和 cell `s` 索引；同时确认输入模板 bytes 未变，连续两次不同输入的响应不会互相覆盖。
