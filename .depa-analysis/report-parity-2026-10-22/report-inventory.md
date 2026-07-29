# Excel 模板报表剩余能力盘点

日期：2026-10-22。范围：`nop-report` Excel 模板渲染及其直接 `nop-excel` / OOXML 依赖；目标 `packages/report-*`。本文件仅分析、不实现。旧 unsupported 是待补能力证据，不能据此将能力排出用户要求的表格报表对齐范围。独立 PDF、Word、企业报表平台另列边界。

路径别名（后文 `别名/相对路径:行号` 是源码证据，不是运行期依赖）：

- `R` = `/Users/kongweixian/java/src/nop-entropy/nop-report/nop-report-core/src/main`。
- `D` = `/Users/kongweixian/java/src/nop-entropy/nop-report/nop-report-demo/src/main/resources/_vfs/nop/report/demo`。
- `E` = `/Users/kongweixian/java/src/nop-entropy/nop-format/nop-excel/src/main/java/io/nop/excel`。
- `O` = `/Users/kongweixian/java/src/nop-entropy/nop-format/nop-ooxml/nop-ooxml-xlsx/src/main`。
- `X` = `/Users/kongweixian/java/src/nop-entropy/nop-kernel/nop-xdefs/src/main/resources/_vfs/nop/schema/excel`。
- `S` = `/Users/kongweixian/infra-dev/spl-bun`。

## 动态 sheet：已核实的实际配置载体

`R/java/io/nop/report/core/XptConstants.java:30–37` 定义 `XptWorkbookModel`、`-XptSheetModel`、`workbookLoopVar/Index`、`sheetLoopVar/Index`。`R/java/io/nop/report/core/build/ExcelToXptModelTransformer.java:65–93` 从 `XptWorkbookModel` 与 `业务sheet名-XptSheetModel` 工作表导入配置，然后从输出移除这两类配置表；单元格批注另由 `:116–162` 解析。sheet 循环配置不是批注，不可只给单元格注解添加 `dynamicSheet` 开关。

`R/resources/_vfs/nop/report/imp/xpt.imp.xml:76–108` 是 Excel 配置表标签到字段的实际映射：`构建循环变量 → beginLoop`、`循环变量名 → loopVarName`、`表单名称表达式 → sheetNameExpr`、`条件表达式 → testExpr`、`展开前/展开后 → beforeExpand/afterExpand`、`sheetVarName`。`loopItemsName/loopIndexName` 出现在 `X/workbook.xdef:145–165`，但该版本 `xpt.imp.xml` 没有相应导入字段，不能宣称它们已能直接通过原 Excel 标签配置。

### 17 号真实模板的 ZIP 观察

只读解压 `D/base/17-动态Sheet和动态列.xpt.xlsx`，按 `xl/workbook.xml` → `xl/_rels/workbook.xml.rels` 定位，而非按文件编号猜测：

| sheet | part | 实际单元格 / 批注 |
|---|---|---|
| `sheet1` | `xl/worksheets/sheet1.xml` | A1 标题；A2 产地、B2 品牌、C2 单价、D2 克重；A3 `*=产地`、B3 `*=品牌`、C3 `*=单价` |
| `XptWorkbookModel` | `xl/worksheets/sheet2.xml` | A1=`展开前`；B1=`let data=[...]; assign("data",data)`，包含苹果/香蕉 JSON；A3=`dump`，B3=`1` |
| `sheet1-XptSheetModel` | `xl/worksheets/sheet3.xml` | A1=`构建循环变量` B1=`data`；A2=`循环变量名` B2=`entity`；A3=`表单名称表达式` B3=`entity.name` |
| 业务 sheet 的 comment | `xl/comments1.xml` | D2：`expandType=c\nexpandExpr=entity.list[0].属性.keySet()`；A3：`expandType=r\nexpandExpr=entity.list`；D3：`valueExpr=cell.rp.ev.属性[cell.cp.ev]` |

苹果记录属性为 `克重=100, 大小=中, 颜色=红`；香蕉为 `长度=150, 成熟度=中等, 存储=低温`。这是每个 sheet 各自独立的动态列集合；不是要求同一 sheet 的每行都不同列。

### 最小可实施语义与精确 fixture

输入由调用方 / Kon / SPL 提供，替换模板中的 Java/XLang 初始化。保留 `sheet1-XptSheetModel` 的声明式配置。示例输入（对象字段名可保留中文）：

```json
{
  "params": {
    "data": [
      {"name":"苹果","columns":["克重","大小","颜色"],"list":[
        {"产地":"山东","品牌":"A","单价":3.2,"属性":{"克重":"100","大小":"中","颜色":"红"}},
        {"产地":"陕西","品牌":"B","单价":4.1,"属性":{"克重":"120","大小":"大","颜色":"青"}}
      ]},
      {"name":"香蕉","columns":["长度","成熟度","存储"],"list":[
        {"产地":"海南","品牌":"C","单价":2.1,"属性":{"长度":"150","成熟度":"中等","存储":"低温"}}
      ]}
    ]
  }
}
```

把 D2 的 `keySet()` 改为 `entity.columns`；A3 与 D3 的报表语义保持。Kon/SPL 可先做键列表/稳定分组投影，也可由明确的表达式 `keys` 原语处理，不能内核执行 Java 对象方法。删除原 `XptWorkbookModel` 初始化脚本，或将其改为显式输入声明；不要悄悄忽略任意有副作用脚本。

验收 DS-1：输出只有 `苹果`、`香蕉` 两个 sheet；配置表均不存在。苹果 D2:F2=`克重,大小,颜色`，D3:F3=`100,中,红`，D4:F4=`120,大,青`；香蕉 D2:F2=`长度,成熟度,存储`，D3:F3=`150,中等,低温`，没有苹果第2条记录。两个 sheet 的 style/theme 与原模板一致，HTML 两个 section 的标题与值一致。输入对象和模板 bytes 不变，两次渲染结果语义一致。

验收 DS-2：`data=[]` 生成零个循环 sheet；没有循环配置的固定封面仍出现一次。`testExpr=false` 在 beginLoop 前跳过整个模板 sheet。无 beginLoop 时单次生成；有循环且结果为空时零次。错误来源必须附配置 sheet、字段和值所在单元格。

验收 DS-3：名称表达式依次为 `"苹果"`、`"苹果"`、`"苹果"`，输出 `苹果`、`苹果(1)`、`苹果(2)`；表达式为 null/空白回退模板名；名称含单引号的跨表公式正确引用。多个模板都产生同名时，目标应使用 workbook 范围唯一名称注册，避免复刻来源局部 map 的跨模板冲突。Excel 名称非法字符、空名、31 字符限制要有明确策略和断言，不以 SheetJS 默默修正为依据。

来源：`R/java/io/nop/report/core/engine/ExpandedSheetGenerator.java:91–125` 表级 test/循环/cleanup；`:133–150` 动态名称；`:285–308` 重名加 `(n)` 且剥离已有数字后缀；`:311–350` 循环语义。注意 `:102–103` 的名称 map 每个模板 sheet 重建，跨模板唯一性是来源风险，目标须显式裁决。

实现接缝：`TemplateSheet/RenderedSheet` 应携带独立 `sourceSheetId`（稳定模板身份）与输出 `name/instanceId`；当前 `S/packages/report-contract/src/index.ts:13–22,79–85` 只有 name。当前 `S/packages/report-xlsx-support/src/workbook.ts:79` 拒绝配置 sheet，`:143–144` 按输出 name 取源 part，无法动态重命名或克隆。codec 解析配置为声明，logic 对每次循环创建独立 scope/view cache，support 按 sourceSheetId 克隆 worksheet part / rels、创建唯一 sheetId/rId，更新 workbook、content-types、localSheetId、跨表引用及必要 drawing 关系，再剔除配置表。不能仅 map 渲染结果 name。

作用域：源 `X/workbook.xdef:140–165` 的 `sheetVarName` 只改变顶层非展开 field 的默认对象，`loopVarName` 绑定循环项，二者不同。`S/packages/report-logic/src/scope.ts:57–72` 当前只合并 datasets/params/记录，须加入当前 sheet 实例变量与索引；不能把某 sheet 的过滤视图或局部变量泄漏给后续 sheet。rendered cells 与 XLSX/HTML 是从输入和模板派生的 observation，不反写输入或模板。

## 剩余能力矩阵

状态以盘点开始时 `S/packages/report-*` 为基线；其他 agent 后续实现可能已消除部分 GAP。`SOURCE_RUNTIME` 表示看到执行逻辑；`SOURCE_SCHEMA_ONLY` 表示只有声明或载体，不能据此宣称完整运行能力。`RELOCATION` 是保留模板已有结构时应守的坐标一致性；不要求复刻来源未实现的 Excel 全功能。

| ID / 裁决 | 来源支持面与证据 | 当前 gap（S） | 最小可实施语义 / 具体验收 |
|---|---|---|---|
| RP-01 GAP / SOURCE_RUNTIME | 动态 sheet 与独立配置表，见上文 DS-1/2/3 | `report-xlsx-support/src/workbook.ts:79,143` 拒绝配置表、按输出名找源 part；`report-contract/src/index.ts:13` 没有 source id | 先完成 DS-1/2/3；Excel 与 HTML 的 sheet 数、名、列集合和数据隔离均断言。RISK-01 |
| RP-02 GAP / SOURCE_RUNTIME | workbook 外层 loop 和 before/after；`R/java/io/nop/report/core/engine/ExpandedSheetGenerator.java:69–88,311–350` | `report-logic/src/render.ts:64` 固定 map 模板 sheet 一次 | 显式 workbook loop 声明返回2项，每项有封面+明细，共4表，稳定按 loop→模板顺序；回退单次与空循环零次分开。初始化/清理 IO 归宿主，数据变换用显式输入和 Kon/SPL，不能恢复 BeanContainer。RISK-02 |
| RP-03 GAP / SOURCE_RUNTIME | `expandInplaceCount` 复用模板预留范围，超过再插入；`R/java/io/nop/report/core/engine/expand/CellColExpander.java:118–145,198–201`、`CellRowExpander.java:124–153,207–210`；`X/excel-table.xdef:42–48` | `report-contract/src/index.ts:23–34` 无 inplace；`report-logic/src/axis.ts:64–79` 每项重复整个 band | 用 B2 横向展开，预留 B:D 共3格，E2=`TAIL`。2项/3项时 TAIL仍在E2；4项时移至F2；第1/2/3/4项各写B/C/D/E，未用预留格保留原静态内容或空白，不能删除预留区；明确只复制展开格及其后代，非后代保留。行方向同样验收。RISK-03 |
| RP-04 GAP / SOURCE_RUNTIME | 同父兄弟复用其他兄弟新增的行列，而非简单串联相加；`R/java/io/nop/report/core/engine/expand/CellRowExpander.java:161–171`、`CellColExpander.java:153–163` | `report-logic/src/compile.ts:85–93` 直接拒绝 overlapping sibling regions | 同一父实例下 A2展3条 `[a,b,c]`、C2展2条 `[10,20]`，两者各自后代；输出该段3行，而不是5/6行，A2:A4=a/b/c，C2:C3=10/20，C4无第三项，footer只下移2行；更换父实例不得复用前一父的行空间。RISK-04 |
| RP-05 GAP / SOURCE_RUNTIME | 同行/同列非后代单元格按默认或 `rowExtendForSibling/colExtendForSibling` 拉伸；覆盖的原合并不得被插行撕裂；`R/java/io/nop/report/core/build/XptModelInitializer.java:519–569,572–643`，`CellRowExpander.java:52–102` | `compile.ts:6–22` 不收两个控制字段；`render.ts:81–93` 只由 row/col chain 与原 merge 推导 | A1固定标签、B1同级展开3项且A1未继承B1：默认A1合并A1:A3；A1 `rowExtendForSibling=false` 时仅保留A1、A2:A3空白。横向对称；同样需要展开的兄弟不能被误合并。schema的sheet级default字段未在该版本此函数中读取，勿无证据宣称默认配置生效。RISK-04 |
| RP-06 PARTIAL / SOURCE_RUNTIME | 多行/多列段落边界可由后代和原合并决定，父格可在复制矩形内部而非左上；`R/java/io/nop/report/core/build/XptModelInitializer.java:439–503`；02/13/14模板 | `compile.ts:61–94,161–175` 已有多行 band；简单显式右侧父格已有 `__tests__/groups.test.ts:53–62`；尚无全部复杂几何证明 | 保留现有已通过的3行段落；增加父锚A3、子B2/B4 `rowParent=A3`，两记录应复制整个2–4行段，末尾原第5行到第8行；父在段中间、合并跨界、空样式格都不得漏复制。RISK-05 |
| RP-07 GAP / SOURCE_RUNTIME | 行展开后其内部列展开依赖当前行值；`R/java/io/nop/report/core/engine/expand/TableExpander.java:45–57` 按行列父依赖调度；`D/base/13-复杂结构列展开.xpt.xlsx` G2=`*=>document.fileRecord.fileName@cell.rp.ev.deviceEmergencyDetails`，A2行展开；14为对称复杂行展开 | `compile.ts:177–180` 强制两轴独立；`render.ts:66–67` rows/cols各全局预计算一次 | 两设备X含文档`[p,q]`、Y含`[z]`；每行自己的列展开只读本设备，最终全表矩形宽度容纳最大2个文档，X行=p/q，Y行=z/空白，说明/措施列对齐且不会覆盖；不是文档全集p/q/z在两行笛卡尔展开。先定义实例级空间分配和占位，再做引用映射。17不同sheet列集合先于此项实施。RISK-05 |
| RP-08 GAP / SOURCE_RUNTIME | 可见性与物理删除分开：行模型visibleExpr→hidden；cell rowTestExpr/colTestExpr false删整行/列（含其合并跨度）；workbook removeHiddenCell才物理删除隐藏行列；`R/java/io/nop/report/core/engine/ExpandedSheetEvaluator.java:53–71,206–239`、`ExpandedSheetGenerator.java:157–189,207–229` | contract无隐藏/删除；codec能复制row/col XML hidden属性，但HTML完全不读；`render.ts:89–101` 无求值后删除阶段 | 数据qty=0/2/3；`rowTestExpr=qty>0` 后只出2/3两行，SUM=5、footer上移；相同条件用visibleExpr时保留3条物理行，首条hidden、HTML隐藏，footer不回退；removeHiddenCell=true才物理少1行。删除后再分配地址、修formula/validation/drawing。RISK-06 |
| RP-09 GAP / SOURCE_RUNTIME | cell/row styleIdExpr 与命名样式：`R/java/io/nop/report/core/engine/ExpandedSheetEvaluator.java:69–70,159–164`；`build/XptConfigParseHelper.java:35–52` 从workbook配置表style样本生成id | `compile.ts:6–22` 拒绝styleIdExpr；`report-xlsx-support/src/styles.ts:8–45` 只读静态style；`render.ts:91–92` 原styleId传递 | 预定义normal/red两个styleId，qty=-2/3输出red/normal；XLSX对应s正确、HTML背景/字体匹配；两个实例共享style定义而不是修改原style。命名样式从配置表指定样本的实际style index映射，不把名字误写进OOXML数字s。RISK-07 |
| RP-10 GAP / SOURCE_RUNTIME | value、formattedValue、exportValue分离；formatExpr、dict映射、NumberFormat：`R/java/io/nop/report/core/engine/ExpandedSheetEvaluator.java:166–181`；`model/ExpandedCell.java:314–321,392–396` | `report-contract` 只有value；`html.ts:21–25`只SSF数字；`workbook.ts:168–176`导出raw scalar | 原值1234.5、NumberFormat=`#,##0.00`：HTML=1,234.50，默认XLSX仍数值1234.5；formatExpr生成`￥1,234.50`且exportFormattedValue=true时XLSX为字符串；false保留number。dict通过显式输入 `{statusLabels:{A:"已审"}}` 解析，缺key策略明确。RISK-07 |
| RP-11 GAP / SOURCE_RUNTIME（XLSX外链仅部分） | linkExpr生成linkUrl；`ExpandedSheetEvaluator.java:183–187`；源OOXML解析内部/外部link `O/java/io/nop/ooxml/xlsx/parse/SheetNodeHandler.java:308–313`；writer `ExcelWriteSupport.java:474–510` 只输出REF_LINK_PREFIX且含!的内部定位 | `workbook.ts:155–156` 动态布局拒hyperlinks；IR无link；`html.ts:27`只有文本 | 明细两行单元格链接分别`#'详情'!A2/A3`，复制后 ref=A2/A3且location正确；外部https链接保留relationship TargetMode=External并复制ref；HTML `<a>`转义URL/文本，禁止脚本scheme。不能声称源writer已完整导出外部http链接。RISK-08 |
| RP-12 GAP / SOURCE_RUNTIME | 图片解析含anchor/bytes、描述中`----`后的testExpr/dataExpr；`R/java/io/nop/report/core/build/ExcelToXptModelTransformer.java:179–215`；`ExpandedSheetEvaluator.java:75–107,249–308` clone到每个实例且可换bytes；`ExpandedSheetGenerator.java:192–204` 收cell图片 | `workbook.ts:155–156`展开遇drawing拒绝；IR无图片；`html.ts`无图片投影 | 1×1 PNG放B2，明细2行后B2/B3各一张，sheet各克隆drawing part并保持offset/size；test false不输出；输入图片bytes替换指定image而非读取任意服务路径；HTML显示两图，XLSX重开含两anchor。图片来源为bytes/runtime端口。RISK-09 |
| RP-13 GAP / SOURCE_RUNTIME（扩展依赖） | Excel单元格条码/二维码属于表格内容；`nop-report-ext/src/main/java/io/nop/report/ext/ReportExtFunctions.java:25–58,61–80` QRCODE根据value、qr:*、单元格尺寸调IQrcodeService；11模板processExpr=QRCODE() | 没有processExpr/图像端口；不可照搬BeanContainer | 以显式 `renderBarcode({content:"123459V",format:"CODE_128",width,height})→bytes` 端口或Kon/SPL事先生成图片供RP-12；两记录得到不同bytes，空值不出图；断言图像尺寸/anchor和PNG signature，真实解码时另用独立decoder。此是Excel模板领域，不因服务名而列为企业平台。RISK-09 |
| RP-14 GAP / SOURCE_RUNTIME（部分） | 图表clone及series/title/category/axis引用表达式，条件过滤；`R/java/io/nop/report/core/build/ExcelToXptModelTransformer.java:218–270`；`engine/ExpandedSheetChartGenerator.java:28–165,171–276`；`:94–118`明确直接数组seriesDataExpr/seriesCatExpr尚留扩展注释 | 动态布局拒drawing；IR无chart；静态part保留并不证明展开后引用/cache仍对 | 柱图类别源A2、值B2，明细[East/2,West/5]后源范围A2:A3/B2:B3、cache两个点2/5、标题可按sheet项改；动态两个sheet不共享可变chart part；未改图表样式保留。图表原生数据引用与report cellset由专用引用映射处理。源HTML renderer只看到图片+表格，未证实HTML原生chart，因此HTML基础验收是数据/标注准确，不虚称源有图表HTML。RISK-09 |
| RP-15 GAP / SOURCE_RUNTIME | `ExpandedSheetGenerator.java:232–247`克隆validation并用expanded cell ranges更新sqref；`O/java/io/nop/ooxml/xlsx/output/ExcelWriteSupport.java:400–442`导出type/operator/formula1/2/提示；`X/workbook.xdef:76–129` | 动态布局拒dataValidations；没有范围IR | B2整数1..10扩成3条：sqref=B2:B4，formula1=1/formula2=10、allowBlank和error/prompt保留；列表引用`'目录'!$A$2:$A$3`在目录动态变化时正确映射，删除空段时规则移除。来源只显式重定位sqref，未证明formula1/2引用也自动重写，目标不要照搬该遗漏。RISK-10 |
| RP-16 GAP / SOURCE_SCHEMA_ONLY + RELOCATION | `X/workbook.xdef:54–62`条件样式range/when/style；`R/resources/_vfs/nop/report/imp/xpt.imp.xml:110–125`有导入字段；所查core evaluator/OOXML writer没有调用getConditionalStyles或生成conditionalFormatting，不能宣称源完整条件格式引擎 | `workbook.ts:155`动态拒conditionalFormatting；静态保留，不进HTML；styleIdExpr实际来源支持已在RP-09 | 先使原OOXML规则sqref=B2扩B2:B4、公式`B2<0`按复制实例重定位、dxfId/priority/stopIfTrue原样；数据[-1,2,-3] Excel规则覆盖三格。若要HTML一致，用已实现styleIdExpr把负数标红，不把Excel全规则解释器当现成原语。待补源证据仍留矩阵，不能用unsupported排除。RISK-10 |
| RP-17 GAP / SOURCE_NOT_PROVEN + RELOCATION | 本轮对R/E/O查definedName(s)/Print_Area/Print_Titles未见报表端读写实现；`X/workbook.xdef:7–190`也无definedNames。来源的“命名单元格”是源A1身份，不等于Excel definedName | `workbook.ts:218`任一布局改变且有definedNames就拒绝，连未受影响命名也拒绝 | 保留并重定位模板已有定义：`Details='Report'!$B$2`扩3项→B2:B4；localSheetId随配置表剔除/动态sheet克隆更新；`_xlnm.Print_Area`按布局更新、`_xlnm.Print_Titles`保留固定标题行。Excel命名公式/SPL binding/report源格名分属不同命名空间。RISK-11 |
| RP-18 PARTIAL / SOURCE_RUNTIME + SOURCE_SCHEMA_ONLY | XLSX页面方向/纸张/页边距已有parser/writer：`O/java/io/nop/ooxml/xlsx/parse/SheetNodeHandler.java:282–322`、`output/ExcelWriteSupport.java:446–458`；header/footer解析`:414–419`；`X/page-setup.xdef:6–23`声明scale/fit/页码/页眉footer；pageBreaks见`X/workbook.xdef:131–138`；源writer `genSheet:71–94`未输出breaks/headerFooter | 当前保留静态pageSetup/Margins/headerFooter；`workbook.ts:155`动态拒row/colBreaks；无print投影与HTML print样式 | A4横向、left/right0.7、top/bottom0.75展开后属性不丢；原第5行分页点随前面+2行移至7；printArea随高度扩大，repeatRows固定1:2；HTML @media print保留打印隐藏与背景print语义。自动纸面排版/字体换行属于独立PDF实现，不得拿来替代Excel打印元数据验收。RISK-11 |
| RP-19 PARTIAL / SOURCE_RUNTIME | sheetProtection解析/输出：`O/java/io/nop/ooxml/xlsx/parse/SheetNodeHandler.java:362–389`、`output/ExcelWriteSupport.java:131–160`；`X/workbook.xdef:71–74`sheetOptions split；源writer `ExcelWriteSupport.java:117–128`总重建A1 view未证实freeze保真 | current worksheet重写保留sheetProtection/sheetViews节点，IR无这两类信息；动态复制潜在selection/topLeftCell过时 | 导出保护参数和cell style protection保持；冻结A1:B2的pane不随复制行错误改成新行，selection ref若指向删除行则调整；多个输出sheet pane独立。HTML只展示表格，无需模拟Excel交互权限。RISK-12 |
| RP-20 PARTIAL / SOURCE_RUNTIME | richText与空格样式载体见`X/excel-table.xdef:24–39`；comments被当模板元数据消耗后清除 `ExcelToXptModelTransformer.java:116–122` | `workbook.ts:178–180`值完全未变才复用原rich/sharedString XML；`:200–205`删除所有comment/vml关系；HTML不支持run字体 | 未改富文本`红色A+黑色B`导出保持run；表达式输出标量时有明确样式退化，不能残留旧sharedString；只删模板指令批注还是全部批注须声明（来源是全部消耗）；空样式格B2被复制后边框连续。RISK-12 |
| RP-21 GAP / SOURCE_RUNTIME | 多行配置文本支持反引号与三引号；`E/util/MultiLineConfigParser.java:24–75` | `compile.ts:12–17`逐行正则，只剥同一行反引号 | 批注`valueExpr="""\nif(qty>0,\nqty,0)\n"""`按一个表达式解析；下一行styleIdExpr仍可读；位置附起始行/模板格。以目标expression语法为内容，Java import/注入脚本不自动获得权限。RISK-13 |
| RP-22 GAP / SOURCE_RUNTIME（部分） | `AbstractCellExpander.java:89–114`支持无expandExpr+field从上下文字段取数组、无field时单次、null→空iterator、单值→iterator转换；`X/excel-table.xdef:69–72`声明expandOrderBy，但搜索所查R只有schema/getter，未见执行排序 | `compile.ts:125`强制expandExpr或ds+field；`axis.ts:25–26`只接受array；未分辨序列/标量兼容策略 | `expandType=r,field=children`在父item.children两项时展开2行；只有expandType的静态锚保持1项；null按empty策略；需稳定排序时先用SPL sort输入或显式表达式排序，数据qty=[2,1,2]稳定排序为1/2/2且重复记录不丢。不要把来源schema-only的orderBy宣称已迁移行为。RISK-13 |
| RP-23 PARTIAL / SOURCE_RUNTIME | `.xpt.xlsx`与`.xpt.xml`都可加载：`R/java/io/nop/report/core/build/XptModelLoader.java:47–64`；ImportModel→报表模板桥接 `imp/ExcelTemplateToXptModelTransformer.java:188–226,356–379,420–447` | 当前公开ReportTemplate对象可直接compile；codec只读XLSX；不是运行XDSL系统 | 保留“规范化模板值→compile”的公共契约；Kon可产出等价TemplateSheet描述，不必复制XDSL/VFS/继承系统。若声称接受原xpt.xml，需真解析且两种输入同一IR/结果；缺此适配时文档准确声明格式边界，渲染语义继续补齐。 |
| RP-24 GAP / SOURCE_RUNTIME | beforeExpand/afterExpand、processExpr能改当前runtime及cell；`ExpandedSheetGenerator.java:73–87,109–120`、`ExpandedSheetEvaluator.java:190–192`；不是每个hook都要恢复通用可变服务容器 | IR只有value evaluate；无显式处理输出；任意Java/XLang脚本无法运行 | 把数据初始化迁到调用方Kon/SPL；模板可保留纯 `beginLoop/testExpr/valueExpr/styleIdExpr/formatExpr` 声明；需要cell处理时返回显式 `{value,display,image,link}` patch，由logic统一应用。fixture原processExpr写image后输出同RP-12；外部数据查询在宿主执行并给input，不让报表逻辑自行读数据库。RISK-02 |
| RP-25 GAP / SOURCE_RUNTIME | 报表公式与导出公式均在源执行：`R/java/io/nop/report/core/build/XptModelInitializer.java:145–165`把Excel公式转valueExpr并设exportFormula；`ExpandedSheetGenerator.java:251–280`导出AST映射；`expr/ReportExpressionParser.java`、`ReportFormulaGenerator.java`为专门组件 | 基线`report-logic/src/formula.ts:1–41`只重写普通A1；`render.ts:89–92`formula值undefined；HTML只提示Excel重算 `html.ts:22` | 输入qty2/3、price10/4，明细20/12、汇总32，HTML数值与XLSX缓存一致；SUM(源D2)要识别当前上下文实例集合而非只取D2；report层次坐标与原生Excel相对/绝对A1保持不同解析语义。专项公式盘点负责完整语法矩阵；此处保留为最高优先能力。RISK-14 |
| RP-26 GAP / RELOCATION（非来源完整引擎） | 源`O/java/io/nop/ooxml/xlsx/output/ExcelWriteSupport.java:71–94`只重建明确领域结构，未看到tableParts/autoFilter/pivot/ext完整移植证据 | 当前`workbook.ts:155`动态一概拒tableParts/autoFilter/extLst；原样留未变化节点不等于引用正确 | 普通autoFilter A1:D3明细增2行→A1:D5；表格ref/header/totals与table column metadata保持，受影响结构有具体重定位能力；未知ext中引用无法证明时精确诊断其part，不借一个未知ext拒全部已能处理的模板。无需新建完整透视表/宏引擎，但不能损坏模板已有可保留结构。RISK-10 |

### 非核心兼容性声明，仍需逐项记录

- `SOURCE_SCHEMA_ONLY` 不是“不用实现”的授权；它要求在“源实际行为”“目标应保持的模板保真”“额外新能力”之间准确陈述。条件格式、名称、分页已有明确最小保真用例，不得统一留作unsupported后宣称Excel模板报表完成。
- 原源格名字A1、Excel definedName、sheet实例ID、展示sheetName、Kon变量名各自独立。稳定实例索引至少包含 sourceSheetId + templateAddress + row/col父实例路径；Excel最终坐标是最后分配的投影。
- 源片段没有证明sheet名非法字符处理、跨模板重复名、validation公式重定位、图表直输数组和所有条件格式的完整正确性；目标可以修复这些缺陷，但验收不能以“源有类名/schema”为充分证据。
- 当前 `workbook.ts:103` 拒绝shared/array公式；它们是Excel公式表示形式。若最终声称支持原模板必须展开shared masters/followers并维护array spill边界；可先支持普通公式，再将这项作为可追踪GAP，不能混为Java语法不兼容。

## Data / Effect / Processor / Actor 边界

| node | semantic_role / authority_model | owner / transition | relations / lifecycle | verdict / evidence |
|---|---|---|---|---|
| 用户模板bytes、params、datasets | 当前请求输入值 / caller-owned immutable input | 调用方提交请求；logic不写回 | projects→compiled template、expanded instances；单请求结束可丢弃 | clean；`S/packages/report-contract/src/index.ts:1,57–60`、`report-logic/src/scope.ts:76–87` |
| 源xlsx配置表、批注 | 模板声明authority / 文件作者拥有 | 仅模板编辑新版本改变声明；解析器不隐式执行企业初始化 | projects→结构化sheet/cell config；source location保留 | 现有拒配置是能力GAP；不能将渲染后XML反写原模板 |
| expansion instances / visibility / named sets | derived runtime values / request-local | 纯logic创建并在该次render生命周期内修改 | 按稳定来源标识映射；删除后重分配最终坐标 | RISK-01/05/06；不得用最终A1反推源格身份 |
| worksheet/drawing/chart/validation/name refs | derived document projection | XLSX support应用已声明relocation plan | 同一输出workbook的全局名称、rId/part依赖必须协调 | RISK-09/10/11；clone parts不能共享可变实例文档 |
| HTML预览、XLSX文件、诊断 | derived observation | 两个renderer从同一rendered model派生 | 可重算；不拥有上游数据或用户输入 | clean边界需继续保持；`S/packages/report-contract/src/index.ts:85–90` |

Effect：文件/ZIP/XML/图片/条码编码留support或显式runtime端口。Processor：循环、布局、公式、值/样式求值、引用重定位是有明确定义输入输出的处理过程，不恢复Java service locator。Actor：同步报表core没有独立actor需求；HTTP worker取消与限时由现有宿主管理。EventSourcedStateProfile、ReactiveDataGraphProfile 对本次表格内核均 `NOT_APPLICABLE`，父格依赖图不因此变成响应式状态图。

## 可复用原语与改造接缝

| 原语 | 已有证据 | 用途 / 限制 |
|---|---|---|
| XLSX.CFB ZIP read/write + part保留 | `S/packages/report-xlsx-support/src/workbook.ts:38–49,136–140,228–230`；`__tests__/workbook.test.ts:45–54` | 扩展现有OOXML支持，不改用全量JSON workbook重建；styles/theme原entry可逐字节验证，动态sheet必须显式克隆/删part |
| fast-xml-parser / XMLValidator | `S/packages/report-xlsx-support/src/xml.ts:1–22` | 新sheet/config/drawing/name/validation读写复用；保留namespace/escaping与OOXML子节点顺序，不用字符串替换所有数字 |
| XLSX.utils A1 codec / SSF | `workbook.ts:99–120,164–187`、`html.ts:23–25` | A1地址与显示格式基础原语；不承担report层次坐标、原生Excel公式计算、图表语义或布局owner |
| 现有expression runtime端口 | `S/packages/report-contract/src/index.ts:66–68`；`report-logic/__tests__/groups.test.ts:1–6` | 对显式scope计算纯表达式；新的report cellset/层次坐标是专门解析层，不把Excel `$A$1`文本强塞普通成员表达式 |
| Kon/SPL上传数据及fresh调用 | `S/packages/kon-spl-dsl/src/run.ts:32–42,63–104`、`enable.ts:14–25,52–79` | 已有groups/derive/select/sort/join可预处理显式ReportInput；替换Java `assign/import/inject`初始化，不在纯core执行源码文件路径 |
| 现有父链、record-id交集、sheet cache | `S/packages/report-logic/src/scope.ts:31–54`、`axis.ts:6–15,30–44`、`render.ts:65` | 保留重复记录和空交集语义；动态sheet每个实例新cache；更复杂空间布局仍需实例级planner，不能仅复用独立row/col笛卡尔数组 |
| 现有合成xlsx测试方法 | `S/packages/report-xlsx-support/__tests__/workbook.test.ts:10–27,31–54,66–77` | 新fixture合成自有数据/布局，记录来源原语；既看IR/HTML又重开真实XLSX和检查OOXML引用，不复制Java原模板或私有业务数据 |

## 来源初始化到显式输入 / Kon 的转换约定

1. 原 `XptWorkbookModel` / `sheet-XptSheetModel` 的 `beforeExpand` 若只是构造字面量数据、键列表、排序/分组，应提取为 `ReportInput.params/datasets` 或在请求Kon/SPL中计算，保留模板业务布局与纯表达式的来源说明。17例的`data`与`entity.columns`就是最小样例。
2. 日期差、金额、排名等数据派生在SPL原语中先算好，再传report；报表公式所需的当前父格集合和跨实例引用在report层计算，不能全局预聚合后丢失上下文。
3. `sheetVarName`与loopVarName分开建模；字段读取顺序有来源证据：`R/java/io/nop/report/core/engine/XptRuntime.java:188–213`先动态数据集/行父/列父，再sheetVarName，最后全局scope。目标应显式定义冲突优先级并验收：全局name=G，entity.name=S，当前记录name=R，明细*=name得R，sheet顶层*=name在sheetVarName=entity时得S。
4. Java资源读取、数据库查询、dict provider、QR服务依赖改为宿主先取数据/bytes或注入窄端口；模板作者不需要知道服务容器。用户目标没有要求把NOP ORM、认证、任务调度、报告定义持久化、权限或报表设计器平台搬回仓库。
5. 不兼容脚本应报准确的位置和迁移建议；不执行、不悄悄忽略。不把“配置sheet可能含脚本”扩大成拒绝所有纯声明式配置表。

## 风险登记与执行顺序

| RISK | 风险与边界 | 必需验证 |
|---|---|---|
| RISK-01 | 输出name被当模板identity，动态sheet克隆/重命名不可追踪，局部名称去重跨模板冲突 | DS-1/2/3，多模板同名，含单引号名字 |
| RISK-02 | 把源Java生命周期脚本全部忽略，或恢复隐式DI/副作用；循环作用域泄漏 | Kon显式数据、双循环4表、错误位置、输入不变 |
| RISK-03 | inplace少量数据仍插列或错误覆盖非后代；超过预留后宽度错误 | 2/3/4项与TAIL坐标，行方向对称 |
| RISK-04 | 兄弟复制次数相加，固定格误复制/过度合并，跨父实例复用空间 | 3项/2项只占3行、双父实例分开、extend true/false |
| RISK-05 | 两轴独立表示无法承载行特有列和复杂偏移；来源身份随物理地址丢失 | 两设备不同文档集合、父锚在3行段中间、来源索引 |
| RISK-06 | hidden与deleted混同，删除后formula/merge/validation/drawing仍旧引用 | qty0/2/3的两种状态及移除后的SUM5 |
| RISK-07 | styleExpr修改共享style；raw/display/export混同 | -2/3条件样式、1234.5数值/格式字符串、两次render |
| RISK-08 | 超链接只复制文本而ref/relationship错误或HTMLURL可执行 | 内部/外部链接、动态复制、HTML转义与scheme约束 |
| RISK-09 | drawing/chart实例共享part被后一个sheet覆盖；anchor/cache未重定位 | 2sheet×2行图片、独立chart cache与rel graph |
| RISK-10 | 只移动单元格，不移动validation/CF/table/ref公式；schema当已实现 | 重开文件、读sqref/公式/cache/part、删除后的规则 |
| RISK-11 | named ranges/print metadata/localSheetId跨配置表剔除后指错sheet | Print_Area/Titles、局部名、移除/克隆sheet索引 |
| RISK-12 | 原有richText、保护、冻结、空样式格被重建损坏 | 原entry与核心XML断言、重开XLSX、空格边框 |
| RISK-13 | 多行配置/field展开/排序语义只支持已写测试子集却宣称完整 | 三引号、父children/null/单值、稳定重复key排序 |
| RISK-14 | 公式仅写f不给HTML/缓存数值；报表源格集合误当Excel最终地址 | 20/12/32、层次上下文、相对/绝对引用、未知函数诊断 |

建议按用户优先级直接连续推进：①动态sheet DS-1/2/3 + sheet作用域/稳定身份；②报表公式求值及原生导出/cache；③inplace、兄弟空间复用、复杂两轴实例；④隐藏/删除、样式/显示值/链接；⑤统一引用重定位供validation/name/CF/打印/drawing/chart复用。每一片达成后继续下一GAP；不得以一片通过或旧unsupported列表作为本次“直至表格报表对齐”的停止条件。

## Excel + HTML 与独立文档 / 企业平台的边界

Excel模板的sheet复制、布局、值/公式、样式、图片/条码、图表、validation、已有条件格式/名称/打印元数据保真都在本次表格报表范围。HTML是同一报表模型的浏览器投影，表格数据、合并、可见性、显示值、样式、链接、图片应一致；Excel特有交互元数据可以只导出文件，但HTML不能用错误数值代替未计算公式。

独立PDF有自己的分页、字体、文本换行、矢量/图片渲染实现：`/Users/kongweixian/java/src/nop-entropy/nop-report/nop-report-pdf/src/main/java/io/nop/report/pdf/renderer/PdfReportRendererFactory.java:15–20`创建独立PdfReportRenderer。这不等于Excel的pageSetup/pageMargins/Print_Area，也不作为后者未完成的借口。Word模板有独立parser/table renderer：`/Users/kongweixian/java/src/nop-entropy/nop-report/nop-report-docx/src/main/java/io/nop/report/docx/parse/XptWordTemplateParser.java`，无需为Excel+HTML迁入Word文档引擎。

NOP DAO/service/web/app中的报告定义管理、权限、调度、持久化、业务页面不在本次内核移植范围；必要数据来源由现有Kon/SPL宿主提供。模板领域`dict/image/QR`能力本身仍在范围，其企业实现依赖用显式输入或窄effect端口替换。

## 观察与完整性声明

本文件已独立读取skill与DataTopology判据，逐项重读当前实现和上游源码，并只读解压06/11/12/13/14/15/16/17/18、inplace真实模板及13号既有HTML输出。没有运行Java引擎；source runtime判定来自实现路径，数值fixture是待实施验收，并未伪称当前目标已通过。没有修改业务代码、旧codument或外部源仓库，没有网络。Weaver策略已按当前Git根及`~/.weaver/config.json`解析，该根命中`/Users/kongweixian/infra-dev/**`，故未调用MCP。

本次共26项能力矩阵、14项RISK。源码中的两处须谨慎：`ExcelToXptModelTransformer.java:134–136`注释说formatExpr默认导出格式值，但实际检查`PROP_FORMULA_EXPR="formulaExpr"`（`XptConstants.java:120`），不据注释承诺自动开关；expandOrderBy/conditionalStyles部分也只找到声明未找到运行消费。目标优先使用显式可验证语义。
