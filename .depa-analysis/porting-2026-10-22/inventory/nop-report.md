---
status: active
last_verified: 2026-10-22
scope: package
---

# nop-report 报表内核移植证据

本主题共 **30 条盘点，8 条 RISK**（仅统计下表 NR-01～NR-30）。结论：可提取的是 `xlsx 模板 + 已准备的数据 -> 编译模型 -> 双轴展开 -> 求值 -> HTML/XLSX`，无需移植 DAO、ORM、认证、工作流、服务树或 Nop 容器。首个可交付切片应完成真实 XLSX 模板、记录行展开、标量绑定、样式/合并保留、HTML 预览和 XLSX 下载；随后补父格/分组，再补列展开/交叉表。目标只承诺逐步明确的兼容子集，不把整个 XLang 与所有 Excel 公式函数一起移植。

观测范围：本地源码阅读；Python 标准库 ZIP/XML 只读解包 11 个参考 XLSX；Bun 1.3.14 + 已安装 SheetJS 0.18.5 的两次内存读写实验。未运行 Java Maven 测试，未修改参考仓库、业务源码或 codument。运行结果与下文拟定验收明确区分。

## 证据定位约定

下表 `N/...:line` 精确展开为 `/Users/kongweixian/java/src/nop-entropy/...:line`；`S/...:line` 展开为 `/Users/kongweixian/infra-dev/spl-bun/...:line`。`C` 为 `N/nop-report/nop-report-core/src/main/java/io/nop/report/core`，`X` 为 `N/nop-format/nop-excel/src/main/java/io/nop/excel`，`O` 为 `N/nop-format/nop-ooxml/nop-ooxml-xlsx/src/main/java/io/nop/ooxml/xlsx`。这是路径缩写，不是外部网站引用。二进制 XLSX 用 ZIP entry + sheet + cell 定位，不能虚构源码行号。

核心入口：[XptModelLoader.java](/Users/kongweixian/java/src/nop-entropy/nop-report/nop-report-core/src/main/java/io/nop/report/core/build/XptModelLoader.java:47)、[XptModelInitializer.java](/Users/kongweixian/java/src/nop-entropy/nop-report/nop-report-core/src/main/java/io/nop/report/core/build/XptModelInitializer.java:76)、[TableExpander.java](/Users/kongweixian/java/src/nop-entropy/nop-report/nop-report-core/src/main/java/io/nop/report/core/engine/expand/TableExpander.java:36)、[ExpandedSheetGenerator.java](/Users/kongweixian/java/src/nop-entropy/nop-report/nop-report-core/src/main/java/io/nop/report/core/engine/ExpandedSheetGenerator.java:128)。

## 证据盘点

| ID | 能力与实际语义 | relation / owner boundary | 判定 | 证据及移植含义 |
|---|---|---|---|---|
| NR-01 | 加载 `.xpt.xlsx` 先解析 OOXML，再转换配置，再初始化父子图；`.xpt.xml` 是另一入口 | template input projects -> compiled model | OK | `C/build/XptModelLoader.java:47`、`:61`；目标直接读 bytes，不需要 VFS/ResourceComponentManager |
| NR-02 | 单元格批注是配置载体；合并代理格批注附着到真实主格；只有批注的空格也会创建 | annotated workbook projects -> cell model | OK | `O/parse/ExcelWorkbookParser.java:77`；`C/build/ExcelToXptModelTransformer.java:116` 解析后清除批注 |
| NR-03 | `XptWorkbookModel`、`<sheet>-XptSheetModel` 是普通配置工作表，不是 Excel custom properties；转换后从输出 sheets 删除 | config input projects -> workbook/sheet model | OK | `C/build/XptConfigParseHelper.java:31`、`ExcelToXptModelTransformer.java:73`、`:89`；名称常量 `C/XptConstants.java:35` |
| NR-04 | `*=field` 绑定字段；`*=^ds!field` 按行展开；`*=>ds!field` 按列展开；`@expr` 指定展开来源；`${expr}` 为模板文本 | text input projects -> binding instructions | OK | `C/build/XptModelInitializer.java:145`、`:168`；字段支持 prop path 与中文；不是 Excel `f` 公式 |
| NR-05 | 批注 `expandExpr`、`valueExpr`、`formatExpr` 的 Java 实现分别用 xpl/report-expr 编译，XLang 可访问大量宿主能力 | expression source -> injected Processor | RISK | `C/build/ExcelToXptModelTransformer.java:139`；`N/nop-kernel/nop-xdefs/src/main/resources/_vfs/nop/schema/excel/excel-table.xdef:67`、`:77`；目标不能直接执行 Java/XPL，也不能新增任意 `eval` 作为替身；定义可审计的表达式子集和显式运行时 |
| NR-06 | rowParent/colParent 独立；未配置时同一行向左找最近 r 展开格，同一列向上找最近 c 展开格；显式 `A0` 取消父格 | compiled model owns structural dependency decisions | OK | `C/build/XptModelInitializer.java:246`、`:294`；`N/nop-kernel/nop-core/src/main/java/io/nop/core/model/table/CellPosition.java:30`；不能简化成所有格都依附左一格 |
| NR-07 | 两轴分别检查父格环；运行展开同时等 rowParent 和 colParent 完成 | graph validation -> expansion control | RISK | `C/build/XptModelInitializer.java:393`、`C/engine/expand/TableExpander.java:45`；目标还应检查跨两轴依赖形成的联合环并报 sheet/cell，避免队列永转；源实现未证明联合环安全 |
| NR-08 | descendants 闭包决定复制集；其最小/最大坐标加 span 决定展开矩形；没有 parent 的范围内格可补默认 parent | template graph projects -> duplicate/extend plan | OK | `C/build/XptModelInitializer.java:439`、`:473`、`:647`；复杂段落报表不是单行数组替换 |
| NR-09 | 初始按行优先入 deque；取到格先处理未展开的父格；生成新展开格再排队 | render-local runtime_control owns scheduling | OK | `C/engine/expand/TableExpander.java:26`、`:36`；目标可用拓扑调度和展开实例队列，但不能只做一次 flat map |
| NR-10 | `expandExpr` 返回序列时第一项复用原格，其余复制；复制值、样式、合并跨度、父指针，随后重连到本批复制父格 | RenderSession transitions expanded cells | OK | `C/engine/expand/AbstractCellExpander.java:45`、`:163`、`:194`；`CellRowExpander.java:106`；模板模型应保留不可变，实例按次渲染创建 |
| NR-11 | 未写 expandExpr 且有 ds+field 时，用当前上下文数据集按字段分组；顺序为首次出现；展开值含 key 与原 records | source rows projects -> stable grouping views | OK | `C/engine/expand/AbstractCellExpander.java:93`；`C/dataset/ReportDataSet.java:89`；输出 key，不能丢掉组内记录 |
| NR-12 | 当前 ds 来源为最近同名 row-parent group 与 col-parent group；同时存在时按原对象 identity 求交集；无上下文才回全量 | context views projects -> intersection view | OK | `C/dataset/DynamicReportDataSet.java:60`、`:72`、`:124`；目标用稳定 row-id 或保持 record 引用；按值重建 rows 会破坏交叉表 |
| NR-13 | 列展开与行展开对称，复制列宽/样式与列 descendants；一格可同时有行父和列父 | same RenderSession owns both axes | OK | `C/engine/expand/CellColExpander.java:20`、`:48`；双轴结构不可建成互不关联的两份表 |
| NR-14 | 同父兄弟展开可复用刚插入的行/列；父格拉伸只累计真正新增空间；同方向展开兄弟缺省不互相拉伸 | render geometry transitions | RISK | `C/engine/expand/CellRowExpander.java:79`、`:129`、`:161`；`C/build/XptModelInitializer.java:557`；第一切片必须拒绝此类复杂布局或有专门实例测试，不能把简单 insertRow 冒充兼容 |
| NR-15 | 空序列默认保留区域，清动态格与动态 descendants，静态文本保留；`keepExpandEmpty=false` 删除展开行/列 | expansion policy owns removal decisions | OK | `C/engine/expand/AbstractCellExpander.java:50`、`:175`；`X/model/XptCellModel.java:130`；remove 与 clear 是两种可观测行为 |
| NR-16 | expandMaxCount 截断、expandMinCount 补 null、expandInplaceCount 复用模板预留区域后才插入 | explicit template policy -> bounded expansion | OK | `C/engine/expand/AbstractCellExpander.java:70`；`CellRowExpander.java:129`、`:207`；按阶段提供并测试边界 |
| NR-17 | 合并使用主格+代理格；复制主格保留跨度，父格延展改变 mergeDown/Across；OOXML 合并边框会合成主格样式 | geometry projects -> XLSX merge refs / HTML spans | OK | `C/model/ExpandedCell.java:239`；`O/parse/SimpleSheetContentsHandler.java:105`；`O/output/ExcelWriteSupport.java:380`；须保留 styled blank cells，不能只导出非空值 |
| NR-18 | 展开后求值；引用其他格时惰性求值；源代码先 setEvaluated(true) 防递归，可能让循环得到旧值/null | evaluation state belongs to RenderSession | RISK | `C/engine/ExpandedSheetEvaluator.java:109`；目标宜区分 unvisited/visiting/done/error，报告值依赖环而不是静默 null |
| NR-19 | value、formattedValue、formula 分开；styleIdExpr、formatExpr、linkExpr、row/col 条件后处理；默认 XLSX 导出原始数值+NumberFormat | values projects -> display and export observations | OK | `C/engine/ExpandedSheetEvaluator.java:128`、`:159`、`:166`；`C/model/ExpandedCell.java:205`、`:314`、`:393`；不能把格式化字符串写回数值 authority |
| NR-20 | 原生 Excel 公式在源实现中编译成专用 AST，`exportFormula=true`，保留公式与计算值；它不是普通 report expression 文本 | workbook formula input -> FormulaProcessor | RISK | `C/build/XptModelInitializer.java:160`；`C/expr/ExcelFormulaParser.java:36`；目标必须分别建 nativeFormula/reportExpr，支持范围明确，不能把 `.f` 交给 SPL 或 Kon parser |
| NR-21 | 导出公式在几何整理完后生成；模板 cellName 对应多个实例，需按当前层次解析再输出具体 range | final layout projects -> emitted formula | RISK | `C/engine/ExpandedSheetGenerator.java:251`；`C/expr/ReportFormulaGenerator.java:42`；常规 Excel copy 相对引用平移与 Nop 层次格展开是不同策略；必须用明确公式模式区分 |
| NR-22 | 源 OOXML reader 对 shared formula 有 TODO；普通公式、cached value、styleId 分开读 | imported OOXML observation | RISK | `O/parse/SheetNodeHandler.java:164`、`:176`、`:458`；不能宣称参考本身完全覆盖 Excel；共享/数组/动态数组/外部引用等首期拒绝或明确诊断 |
| NR-23 | ReportEngine 只注册 renderer factory；展开生成器可输出模型，XLSX factory 交给 ExcelTemplate | logic -> render Effect adapter | OK | `C/engine/ReportEngine.java:70`、`:77`；`C/engine/renderer/XlsxReportRendererFactory.java:20`；`ReportRenderHelper.java:12`；TypeScript 可无容器按函数组合 |
| NR-24 | HTML 输出用 table/colgroup/rowspan/colspan，CSS 由 ExcelStyle 投影；值和属性均 escape，代理格不输出 | ExpandedWorkbook projects -> HTML | OK | `X/renderer/HtmlReportRendererFactory.java:100`、`:127`；`N/nop-kernel/nop-core/src/main/java/io/nop/core/model/table/html/HtmlTableOutput.java:110`；不需要 Nop 前端控件体系 |
| NR-25 | workbook/sheet loop、图片说明中的 dataExpr/testExpr、chart dynamicBindings、dataValidation 范围均有扩展 | optional template extensions -> later projections | UNKNOWN | `C/engine/ExpandedSheetGenerator.java:69`、`:232`；`C/build/ExcelToXptModelTransformer.java:179`、`:218`；均有实现证据，目标需求/兼容优先级待后续切片，首期不得默默忽略 |
| NR-26 | spl-flow T() 用 sheet_to_json 读数据，json_to_sheet 创建新表；没有模板渲染链；SheetJS 直接 roundtrip 丢大部分模板样式 | data IO adapter is not report renderer | RISK | `S/packages/spl-flow/src/index.ts:223`、`:296`、`:378`；实测 P-01；不得复用 T() 导出当模板出口 |
| NR-27 | 现有 Kon word 壳有同步执行、runtime/env 绑定与 workspaceRoot；没有 report word | shell commands -> report capsule | OK | `S/packages/kon-spl-dsl/src/enable.ts:26`；`context.ts:6`、`:78`；新增 report word 应走同一 `expandWord`，输入变量解析沿用 env -> ctx.scope |
| NR-28 | 已装 xlsx 自带 CFB ZIP 读写；原 OOXML entries 内存重打包保持 payload，可保留样式主题等未修改 entry | ZIP bytes Effect codec only | OK | 实测 P-02：15/15 payload 相同；无需为 ZIP 另引 native 依赖；XML adapter 仍须单独实现/选择并验证 |
| NR-29 | Java demo 多是生成文件或快照；核心有环/坐标/平均值/删除越界断言，但“测试存在”不等于语义充分锁定 | tests observe -> implementation behavior | OK | `N/nop-report/nop-report-demo/src/test/java/io/nop/report/demo/TestReportDemoBizModel.java:108`、`:148`；`N/nop-report/nop-report-core/src/test/java/io/nop/report/core/engine/TestReportEngine.java:199`；目标使用下述带精确断言的新小 fixture |
| NR-30 | Nop 仓库 LICENSE 标为 Apache 2.0；Java 源文件保留作者版权头；NOTICE.md 另有 supersql-open 提示词归属 | source provenance / distribution record | OK | `N/LICENSE:1`、`:66`；`N/NOTICE.md:1`；仅按语义独立实现可避免复制大块 Java；如复制/改写源文件或分发原样 fixture，携带 license、适用 notice、来源与修改记录；这只是仓库证据记录 |

## Data / Effect / Processor / Actor 边界

| 数据节点 | semantic_role | authority_model | authority owner | transition entries | physical writes | relations | verdict | evidence |
|---|---|---|---|---|---|---|---|---|
| 原始 XLSX bytes 与批注配置 | current_authority | external immutable input/versioned file | 调用方/模板作者 | 提交新模板 | 输入文件或上传对象；内核不写回 | projects -> CompiledTemplate | clean | NR-01～04 |
| 命名数据集+参数快照 | current_authority | caller-owned value | SPL/Kon 调用者 | 提交本次输入 | 本次绑定；不改业务数据源 | projects -> groups/intersections | clean | NR-11/12 |
| CompiledTemplate / parent plan | derived_observation | immutable compiled value | Compiler，非业务 authority | compile | 内存 IR；可按模板 hash+compiler version 缓存 | observes template; projects -> instances | clean | NR-06～08 |
| 展开工作表、实例地址、待处理队列、求值状态 | runtime_control + derived_observation | render-local memory | 一个 RenderSession | expand/evaluate/finalize | 本次内存 table/cells | projects -> outputs; never backwrites template/data | clean | NR-09/10/18 |
| raw value / display text / native formula / computed cache | derived_observation，四个独立语义槽 | render-local immutable result | 相应 Processor 的结果 | evaluate/format/rewrite | 当前实例字段；导出不反向更新 raw value | projects -> HTML/XLSX | clean | NR-19～21 |
| HTML 与 XLSX 产物 | derived_observation | disposable output artifact | renderer adapter | serialize/write | 显式返回 bytes，shell 才写文件/HTTP | publishes; never owns input truth | clean | NR-23/24/28 |

建议契约形状（设计建议，非已有 API）：

```ts
type ReportInput = {
  datasets: Readonly<Record<string, ReadonlyArray<Readonly<Record<string, unknown>>>>>;
  params?: Readonly<Record<string, unknown>>;
};
type CellOrigin = { sheetId: string; templateAddress: string };
type CellInstance = {
  origin: CellOrigin; instanceId: string; row: number; col: number;
  rowParentId?: string; colParentId?: string;
  rawValue: unknown; displayText?: string;
  nativeFormula?: string; reportExpression?: string;
  rowIds?: readonly number[]; styleId?: string;
};
// parse/compile/expand/evaluate are deterministic processors over values.
// read/write filesystem and HTTP remain in shell/Effect adapters.
parseTemplate(bytes: Uint8Array): ParsedTemplate;
compileTemplate(parsed: ParsedTemplate, config: CompileConfig): CompiledTemplate;
renderReport(runtime: ExpressionRuntime, input: ReportInput,
  config: { template: CompiledTemplate; limits: RenderLimits }): RenderedWorkbook;
serializeXlsx(result: RenderedWorkbook): Uint8Array;
serializeHtml(result: RenderedWorkbook): string;
```

`ExpressionRuntime` 的能力和作用域显式注入；Kon 负责组合数据处理和调用报表，报表编译器负责模板配置，ExcelFormulaProcessor 负责原生公式。不要在报告内核隐式打开数据库、读取任意文件或调用 XLang 容器。上述渲染会话无 canonical event authority/replay 证据；事件溯源 profile `NOT_APPLICABLE`。父格图是编译期依赖模型，不是 Signal/Stream 证据；响应式图 profile `NOT_APPLICABLE`。

## 注解载体与已检查的真实 fixture

`MultiLineConfigParser` 读 `name=value` 行，name 为 XML name（允许扩展命名空间 `foo:bar`）；空行跳过；行尾 trim；支持反引号字符串与三双引号多行块。源码：`X/util/MultiLineConfigParser.java:22`、`:43`。未知普通 key 报错，含 `:` 的扩展 key 可保留（`C/build/ExcelToXptModelTransformer.java:143`）。首期最好严格列出支持的 key，并给 cell 定位；不能把用户的普通说明批注悄悄当脚本执行。

参考 fixture 根目录：

- `D = /Users/kongweixian/java/src/nop-entropy/nop-report/nop-report-demo/src/main/resources/_vfs/nop/report/demo/base/`
- `T = /Users/kongweixian/java/src/nop-entropy/nop-report/nop-report-core/src/test/resources/_vfs/nop/report/demo/`

| fixture / ZIP 定位 | 实际注解或内容 | 用作哪一级验证 |
|---|---|---|
| `D/01-档案式报表.xpt.xlsx` / `xl/comments1.xml` B10 | `expandType=r\nexpandExpr=entity.educations`；A10 `rowParent=B10`；B10:E10 合并 | 记录数组 + 显式父格在右侧 + 复制横向 merge |
| `D/02-段落明细表.xpt.xlsx` / A2、A13 批注 | A2 `expandType=r\nexpandExpr=orders\nvalueExpr=null`；A13 `rowParent=A2`；B4 `*=订单ID` 等 | 多行段落复制，不能只扩行 A2 |
| `D/04-交叉报表—数据双向扩展.xpt.xlsx` / D2 批注 | `expandType=c\nfield=产品\nds=ds1`；A3 `*=^ds1!地区`、B3 `*=^ds1!销售员`、C3 `*=^ds1!产品类型`；D3 `*=销售量` | 分组层级、列分组、交叉上下文、总计 |
| 同一 04 / `xl/worksheets/sheet1.xml` F3 | 真 `<f>SUM(D3)</f>`，cached `<v>0</v>`；E3 批注 `valueExpr=SUM(D3)`；E4 文本 `${SUM(E3)}` | 三种作者输入外观相似但类型不同；不能一律字符串求值 |
| `D/08-动态展开列.xpt.xlsx` / D2、D3、D4 批注 | D2 `colParent=D3`；D3 `expandType=c\nexpandExpr=chenfenList\nvalueExpr=cell.ev.name\ncolParent=D5`；D4 使用 `cell.rp.ev` 与 `cell.cp.ev` | 父格可在下方；cross context 不限同一个二维源表 |
| `D/10-导出Excel公式.xpt.xlsx` / A2 与 E2 | A2 `*=^name@data`；E2 真 Excel 公式含 `IF("e.rp.ev.name=='X2'",C2:D2)` | Nop 扩展的二参 IF(filter,cellSet) 不是普通 Excel IF；应延期到专门公式兼容阶段 |
| `D/14-复杂结构行展开.xpt.xlsx` / A2、G2、H2 | A2 expandExpr=entity；G2 `*=^document.fileRecord.fileName@cell.rr.ev.deviceEmergencyDetails`；H2 `rowParent=A2` | 嵌套不同粒度展开与父格拉伸 |
| `D/15-兄弟节点同时展开.xpt.xlsx` / D1、D2、A3～F3 | `*=>ds1!classify`、`*=>ds1!subClassify`；多层行分组，D1:F1、D2:F2 合并 | 两轴多层 + 兄弟新增空间复用 |
| `D/16-多个数据源展开.xpt.xlsx` / D6 批注 | `expandType=c\nfield=产品\nds=ds2\ncolParent=A0` | 两个独立表区域取消误继承的列父格 |
| `D/17-动态Sheet和动态列.xpt.xlsx` / 配置 sheet | `sheet1-XptSheetModel` A1/B1=`构建循环变量`/`data`，A2/B2=`循环变量名`/`entity`，A3/B3=`表单名称表达式`/`entity.name`；D3 `valueExpr=cell.rp.ev.属性[cell.cp.ev]` | 动态 sheet + 每 sheet 不同列集合；延期并显式诊断 |
| `T/test-expand-excel-formula.xpt.xlsx` / A1、B1 批注 | A1 `expandType=r\nexpandExpr=[1,2,3]`；B1 用 `xptRt.evalExcelFormula('SUM(A1)+A2')` 与 `expandExcelFormula` | 显式调用 Excel 公式求值/展开，不应导入任意宿主函数 |
| `T/test-expand-inplace-count.xpt.xlsx` / B5、A6、B6 | B5 c 展开 + `expandInplaceCount=3`；A6 r 展开；B6 用双方父格索引；A1:D1 合并 | 原位预留列、行列组合、宽高和 merge 边界 |

说明：04 的 `XptWorkbookModel!B1` 含 Java/XScript 风格数据初始化脚本 `let ds1 = [...] ; assign("ds1",ds1)`；17 同样含脚本和 `keySet()`。原模板不能直接当目标兼容验收：先提取数据作为 `ReportInput`，保留布局/注解，换成已声明子集后成为衍生 fixture，并记录修改。批注实际位于 `xl/comments1.xml` / `comments2.xml` 的 `<comment ref="D2"><text><r>...<t>...</t></r></text>`；sheet relationship 才决定归属，不可按文件编号猜。SheetJS 解码后是 `cell.c[].t`，公式为 `cell.f`，合并为 `sheet['!merges']`。

## 最小算法与必须守住的区别

1. **编译结构**：解析真实主格和空样式格；每个源格有稳定 templateAddress。先归一批注、前缀、插值，再解析显式/缺省 rowParent/colParent，解析代理格到主格，检测缺失/环。计算 descendants、复制矩形和 extend 集。引用源格名时永远通过实例索引查询，不能因插行而丢失源格身份。
2. **记录行**：显式 `expandExpr=orders` 把记录数组作为展开值；第一项复用当前实例，其余复制范围；主格和子格保留记录引用。`*=name` 优先从父实例记录取字段。无数据按 keepExpandEmpty 执行 clear 或 remove。最小实现只允许 span=1、一个明确行展开区域时应在编译时拒绝其他形态。
3. **分组行**：`*=^sales!region` 相当于在当前上下文 sales 上稳定 groupBy(region)；每个输出项存 group key、dsName、recordIds。子展开 `*=^sales!person` 必须对父 region 的 records 再分组；上层标签纵向 merge 到子行覆盖范围。总计只读相应 group，不再跑查询。重复 key 的记录不能被去重掉。
4. **列/交叉**：列算法按对称结构复制。交叉格当前数据 = 最近同名行 group 与列 group 的 record-id 交集；没有任何一侧则全量，一侧存在则用该侧，两个 group 存在但交集为空则空集（不能回退全量）。`*=amount` 的源语义是 current.first.amount；聚合应显式 sum(amount)，不能凭列名自动求和。多数据集时只沿同 dsName 找父 group。
5. **值与几何分阶段**：先展开完成 -> 对格求值/格式化/可见性 -> drop removed -> 最终地址分配 -> 公式/validation/图片等引用修正 -> 导出。报表表达式中的 `A3` 是源格的上下文实例集合/值；原生公式 `A3` 是 Excel 坐标语法。纯文本 `=text` 也不能凭首字符被误判成 `.f`。
6. **公式策略**：首期原生公式以独立字段保留，复制行时正确处理相对/绝对 A1 引用，汇总格范围按已声明策略扩展；只有明确支持的算术/SUM 等可计算 HTML cache。未知函数可保留导出，但必须让 HTML 标出 unavailable 或编译时报能力诊断，不能伪造 0。Nop 层次坐标、相对层次索引与二参 IF(filter,cellSet) 在后续 FormulaProcessor 中实现，不混进已有 SPL expression AST。
7. **导出**：HTML 与 XLSX 都从同一 RenderedWorkbook 投影，HTML 转义文本、输出尺寸/样式与 span；XLSX 保留 raw value 与 NumberFormat，把公式写回 `<f>`，支持的计算值可放 cache。不能以 HTML table 作为 XLSX 中间 authority。

## 已实测：SheetJS 保真边界

P-01（内存实验，无文件写入）：以 04 模板执行 `XLSX.read(bytes,{cellStyles:true,cellNF:true,cellFormula:true}) -> XLSX.write(wb,{type:'buffer',bookType:'xlsx',cellStyles:true})`，再读回。D2 原 `.s` 是 solid fill `ECEFF4`，读回变成 `patternType:none`。直接用 ZIP 检查 `xl/styles.xml`：

| 属性 | 原模板 | SheetJS 重建 |
|---|---:|---:|
| font 元素数 | 5 | 1 |
| border 元素数 | 3 | 1 |
| fill 元素数 | 4 | 2 |
| cellXfs count | 8 | 1 |

D2 批注、F3 公式字符串仍在，但样式保真失败。`xlsx:^0.18.5` 已声明在 `S/packages/spl-flow/package.json:13`。现有 Excel 测试 `S/packages/spl-flow/__tests__/excel.test.ts:47`、`:165` 只证明表格数据导入导出，不能反证此问题。

P-02（同一模板、内存实验）：`XLSX.CFB.read(bytes,{type:'buffer'}) -> XLSX.CFB.write(cfb,{type:'buffer',fileType:'zip',compression:true})`，再逐 entry 比 payload：15/15 文件内容完全相同，输出仍能被 `XLSX.read` 打开，包含原来的两个 sheets。`CFB.utils` 实际暴露 `cfb_add/cfb_del/cfb_mov`。

因此首期优先沿用现有 xlsx 的 ZIP codec，新增 OOXML/XML adapter，只改必要的 worksheet/config/relationship parts，保留 styles/theme 等未触及 entry。保真声明以 entry 和渲染断言为证；不得改成 `json_to_sheet`。XML 处理须支持 namespace、实体转义、sharedStrings/inlineStr、缺格、空样式格；不能用字符串替换所有数字坐标。插入行列后 merge refs、dimensions、row/cell addresses、公式、named ranges、autoFilter、validation、conditional formatting、drawing anchors 都可能受影响；首期对未实现的受影响结构给显式错误/unsupported diagnostics。仅“未修改 entry 原样留下”不证明其引用仍正确。

## 推荐顺序与逐 mission 验收

以下是可执行切片建议，由父层创建 cdmt-mission-lite；本文件不创建 mission。每片以 public API + 真实 `.xlsx` 再打开 + HTML/IR 断言验收，不依赖 Java 服务。

| 顺序 | 范围与边界 | 精确验收样例 |
|---|---|---|
| R1 首个报表内核 | OOXML adapter、规范化 IR、单个记录行区域、标量/插值、样式/横向合并、XLSX+HTML、Kon report word/HTTP preview 入口。支持集合之外的批注和结构显式报错 | 新建最小模板：A1:D1 合并标题 `${title}`；A2 批注 `expandType=r\nexpandExpr=orders`，A2 `*=name`，B2 `*=qty`，C2:D2 合并 `*=label`，A3=`END`。数据 Alice/2/`<b>A</b>`、Bob/3/B，title=Orders。输出两条记录，END 从第3行到第4行；合并为 A1:D1、C2:D2、C3:D3；样式 fonts/borders/fills 原 entry 保留，新增行 style id 相同；HTML 有 colspan=2、Alice/Bob、`&lt;b&gt;A&lt;/b&gt;`。重复 render 两次结果相同且输入 bytes/records 未变。零条数据默认清动态格而保留静态 END 与区域；false 删除空区域。 |
| R2 父格与分组 | 显式/默认 parent、源格实例索引、多行 span、嵌套 group、合并拉伸、min/max、cycles 诊断；不做双轴 | sales=[East/A/2, East/A/3, East/B/4, West/C/5]。A2=`*=^sales!region`，B2=`*=^sales!person`，C2 valueExpr=当前组 sum(qty)。输出两地区、三人，qty=5/4/5；East 标签 merge A2:A3，West A4，合计14。同一 A key 的两条记录均保留。显式 rowParent 指向右边/下方也正确；缺格/单轴环/联合环有 sheet+cell 错误。另用 02 衍生两订单、多行段落证明 span 不止1。 |
| R3 列展开与交叉 | 双轴实例和 row-id 交集，动态列，独立区域取消父格，兄弟空间复用 | sales=[East/Apple/2, East/Milk/3, East/Apple/4, West/Milk/5]。A2=`*=^sales!region`；B1 批注 c/ds=sales/field=product；B2 valueExpr=当前交集 sum(qty)。输出 header Apple/Milk，East=6/3，West=0/5（显式 sum 空集=0），行总9/5、列总6/8、总14。不得因 Apple 两条重叠记录只取2或4。再对 15/16 衍生 fixture 验证嵌套列、同父兄弟复用和 `colParent=A0`。 |
| R4 公式与高级格式 | 专门 FormulaProcessor；原生 A1 公式、结果 cache、绝对/相对引用、SUM 集合、格式化导出开关；增加 Nop 层次坐标时另列兼容表 | 行模板 B2=qty、C2=price、D2 真公式 `B2*C2`，两行2*10与3*4：导出 D2.f=`B2*C2`、D3.f=`B3*C3`，值20/12；footer 原 `SUM(D2:D2)` 声明范围扩展后为 `SUM(D2:D3)`，值32。`$B$1` 保持，`$B2` 只移动行；单元格 text `=literal` 保持 text。reportExpr 与 .f 同格冲突报错。未知 Excel 函数保留与不计算行为可测试。Nop SUM(D3) 展开多个实例和普通复制引用分开用例。 |
| R5 文档规模与扩展 | 动态 sheet、inplace、隐藏/删除、条件样式、validation、图片/图表、分页/PDF 按实际优先级推进 | 17 衍生 fixture 输入 apples/bananas，输出同名两个 sheets，列来自各自属性集合且互不串值；原位3列输入2/3/4列边界；长表限制和取消；图片 anchor 与 validation 范围随行列变化。PDF 是独立渲染需求，不阻塞 Excel+HTML 内核。 |

R1 的返回结果建议携带模板 hash、支持能力版本、diagnostics、输出 MIME/字节数以及可重建的 IR observation；所有大小/条数限制属于显式配置，不能借限制把错误结果当完成。R1 若暂时不能可靠改公式或图表引用，应拒绝“展开区域影响这些结构”的模板；允许未受影响的静态结构原样保留，同时明确 unsupported 项。公式支持可以独立迭代，但样式/合并保留和真实导出应从首片成立。

## 未知与不纳入首片的事项

- 当前 SPL/expression 基础库外迁仍在进行；表达式注入应以当前包公开导出为准，不能引用历史 dist 或重复造数值/分组引擎。本主题只确认现有 Kon 公共壳与 xlsx 事实，依赖总体盘点由 runtime 主题负责。
- 没有在本任务证明本机已装 ExcelJS/fast-xml-parser；不把它们列为现有可用能力。现有 CFB ZIP roundtrip 已证实，XML writer/parser 的选型和 namespace/实体验收仍是 R1 工作。
- 原参考很多 demo 含脚本、中文字段、Java 类库/扩展方法和特殊 report 坐标；不承诺直接运行原文件。优先构造外部数据输入、删除 Java 初始化脚本的语义等价小模板，按上述 fixture 来源记录 provenance。
- 表达式 source location 必须保留到 sheet+templateAddress+annotation key；渲染报错附实例坐标。参考 `ExcelWorkbookParser.java:87`、`ExpandedSheetEvaluator.java:197` 已为这种错误定位提供证据。
- 复制来源前再次核对实际提交版本与该文件 license/notice；本盘点只记录当前本地 LICENSE/版权头，未作整个第三方依赖的许可审计。
