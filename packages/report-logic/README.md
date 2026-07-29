# Excel 模板报表

模板作者在 Excel 单元格写 `*=name` 或 `${title}`，在批注中写逐行 `key=value` 配置。`expandType=r` 配合 `expandExpr=orders` 将该模板行对每条记录展开；字段值保留数值、布尔与文本类型。数据和参数由调用方显式提供。

```ts
import { compileReport, renderReport } from "depa-data-report-logic";
import { readXlsxTemplate, writeXlsxReport, reportToHtml, formatReportValue, renderBarcode } from "depa-data-report-xlsx-support";
import { compileExpression } from "depa-data-expression";

const { template, archive } = readXlsxTemplate(bytes);
const output = renderReport({ formatValue: formatReportValue, renderBarcode, evaluate: (source, scope) => compileExpression(source).evaluate(scope) }, {
  template: compileReport(template),
  datasets: { orders: [{ name: "Alice", qty: 2 }, { name: "Bob", qty: 3 }] },
  params: { title: "订单" },
});
const xlsx = writeXlsxReport(archive, output);
const html = reportToHtml(output);
```

内核不读文件或数据库，求值器经 runtime 注入。模板与数据不会被渲染改写；每次拥有自己的实例。默认限制为 20,000 行、512 列与 100,000 个布局格，可显式设置更低或更高的 Excel 范围内限制。

`keepExpandEmpty` 默认 true：没有数据时保留模板行的静态文字，清空动态表达式；false 删除该空区域。`expandMinCount` 补空项，`expandMaxCount` 截断；二者必须合法。普通说明批注不执行；含配置的批注只接受声明支持的 key，未知项报 sheet/cell 位置。

`*=^sales!region` 按首次出现顺序分组并向下展开；右侧再放 `*=^sales!person` 即为组内再分组。`*=>sales!product` 对称地向右展开。批注 `ds=sales`、`field=product`、`expandType=c` 是等价显式写法。每个组保留原记录的索引，交叉格取行、列父组的同源交集；重复记录保留，空交集不会回退到全量数据。

表达式的 `records` 是当前组/交集，命名数据集变量也按当前父格筛选。例如 `valueExpr=records.sum("qty")`；现有 SPL 表达式的空序列 sum 返回 null，若希望展示 0，可写 `valueExpr=if(records.count()==0,0,records.sum("qty"))`。`*=sales!qty` 取当前范围第一条记录字段，聚合必须显式写出。

`rowParent` 默认寻找同一模板行左侧的父格，`colParent` 默认寻找同列上方的父格；显式地址可在右侧或下方，`A0` 取消继承。一个行展开格若有跨行的显式后代，会复制整个多行区域。依赖关系决定展开顺序，支持每个行组不同的列集合、对称的列内行集合以及行→列→行的依赖链。父格标题按实例拉伸合并，子组独立展开；缺格和父关系环带地址报错。

`expandInplaceCount=3` 预留三段空间，数据超过三项才插入新位置；预留区内原有的模板格会被相应复制格替换，其他行列的静态内容保留。同父兄弟复用已经增长的空间，长度取最大值。静态邻格默认随兄弟拉伸，`rowExtendForSibling=false` / `colExtendForSibling=false` 可关闭对应轴。

`rowTestExpr` / `colTestExpr` 为 false 时删除物理行列，重新分配坐标并计算公式；`visibleExpr` 仅隐藏对应展开轴，其他格默认控制行。工作簿配置 `删除隐藏单元=true` 可将隐藏转为删除。`styleIdExpr` 选择模板样式，命名样式由 `XptWorkbookModel` 的“命名样式 / 序号、样式ID、样式”表声明，样式取样本格C列，模板调色板保持不变。

原值 `value`、展示 `displayValue` 和导出 `exportValue` 各自独立。`formatValue` 是注入的纯格式化端口，生产适配器提供 SSF；`formatExpr` 可用 `value` / `cell.formattedValue` 生成文字。`dict=status` 从显式 `params.dicts.status` 读取显示标签，缺键保留原值。`exportFormattedValue=true` 导出显示文本；引用这些文本格的公式会物化为计算结果，防止Excel再次计算时改变数值。`exportFormula=true` 将报表表达式导出为原生公式，false 只保留结果。

`processExpr` 返回纯对象 patch，仅接受 `value/displayValue/exportValue/styleId/linkUrl/image`。它在依赖格读取结果前应用，不持有可变工作表或Java服务容器。配置值支持三引号或反引号多行表达式；展开可直接使用父记录中的数组、标量或null字段。

XLSX 出口保留原 styles/theme 等文件项，复制样式索引、宽高和合并格。HTML 从同一输出模型投影，转义值并显示格式。原生 Excel `<f>` 与模板 `valueExpr` 分开；普通 A1 相对/绝对引用随展开映射，范围端点覆盖展开区域。支持的公式在服务端计算同一份结果，XLSX 同时写公式和当前 cache，HTML 显示当前值。输出删除旧 calcChain 并请求 Excel 再校验；未知原生函数保留公式，明确标为未计算，依赖它的格也不会伪造数值。

报表层次公式可放在 `valueExpr` / `formulaExpr`；原生公式批注 `formulaMode=report` 切换到同样的实例语义。默认原生公式保持物理 Excel 地址语义。报表中的 `SUM(C2)` 取当前父格内由源 C2 展开的实例，根汇总取全部；`SUM(C2[A2:2])` 选第二个 A2 组，`A2:-1` 相对上一组，`A2:!-1` 从尾选最后一组。分号后指定列轴，如 `B2[A2:1;B1:2]`；逗号下钻层次，如 `C3[A3:-1,B3:+0]`。越界为空集合，标量运算对多格集合报错。`B2.value(1)` 是0起始第二个值，负数从尾读取。

19个 Nop 报表函数已经局部实现：SUM/PRODUCT/SUMPRODUCT/COUNT/COUNTA/AVERAGE/MIN/MAX/NVL/PROPORTION/RANK/ACCSUM/STDEV/VAR/COUNTIF/SUMIF/CONCAT/IF/MEDIAN。聚合只统计 number，不强制转换文本或布尔；空集合和 null 参数分别处理。IF/AND/OR/SWITCH 是懒分支；`SUM(IF("e.value <= 10",C2))` 对全sheet源 C2 实例过滤，可读 `e.rp.ev` / `e.cp.ev`。单次渲染建立完整父格关联和依赖状态，支持前向引用；循环报出源格与输出格路径。

聚合只迭代一层，`SUM([[1,2],3])=3`。cellSet表达式还支持 `get/firstCell/lastCell/firstValue/lastValue/cell/cells/values/size/isEmpty/rowCount/colCount/cellRanges/map/filter/flatMap/rowChildSet/colChildSet/realCells` 及成员链。例如 `B2.get(-1).value`、`B2.filter("e.value>8").rowCount`、`SUM(B2.map("e.value*2"))`。map/flatMap返回值列表，filter/children返回cellSet；rowCount/colCount取首尾跨度。成员 `sum` 保持来源MathHelper行为：布尔按0/1，字符串或null使结果NaN，与Number-only的 `SUM` 不同。

回调字符串经显式SPL evaluator执行；`e` 是只读cell view，提供 `value/name/rowIndex/colIndex/ev/ei/rp/cp/rr/cr/records`。没有可调用的任意host方法。`CELLS("B2")`、`EVAL_EXCEL_FORMULA("SUM(B2)")` 和 `EXPAND_EXCEL_FORMULA("SUM(B2)")` 是渲染期的目标API，分别查询集合、计算值和生成当前坐标公式；动态递归最多64层。一般SPL方法可以与报告引用组合，例如 `SUM(B2)+records.count()`；回调不是Java或JavaScript代码。删除后relative层次按保留身份定位，`+0`仍是自身，嵌套跨父域保持相同ordinal。

报表模式导出公式使用与求值相同的 selector，将实例转换为真实输出地址与不连续范围。ACCSUM按同源实例的确定顺序求prefix，重复引用不再重复累加，这是对上游可变累加器的明确适配；财务同比/环比与累计4100的来源样例有数值回归。Java数值细分归一为JS number；非有限结果在HTML/XLSX投影成错误值。COUNTIF/SUMIF支持完整`*`/`?`通配符，扩展了上游不完整的simple-pattern。来源和兼容决策见 [公式盘点](../../.depa-analysis/report-parity-2026-10-22/formula-inventory.md)。

原生公式只有在能保持当前报表类型和求值语义时才输出。谓词/大小写、Number-only参数、懒逻辑、SPL转换、null或非有限结果等不适合原生表示的情形，会物化当前值并保留 `formulaDiagnostic`；不重新执行未选分支。常规数值SUM/IF及层次引用继续保留公式和cache。Excel输出是本次输入的计算快照，Java类型细分与容器默认toString按目标JS值适配。

## 动态工作表

Excel中新增名为 `原表名-XptSheetModel` 的两列表，A列配置名、B列表达式。支持来源标签 `构建循环变量`、`循环变量名`、`条件表达式`、`表单名称表达式`、`sheetVarName`；英文 `beginLoop/loopVarName/testExpr/sheetNameExpr` 也可。`loopIndexName/loopItemsName` 是目标额外公开的声明字段。纯声明 `XptWorkbookModel` 可以提供外层循环；它与配套sheet配置均从输出移除。

例如业务表 `Template` 的配置行分别是 `构建循环变量=data`、`循环变量名=entity`、`表单名称表达式=entity.name`。传入 `params.data=[{name:"苹果",rows:[...]},{name:"香蕉",rows:[...]}]`；业务行用批注 `expandType=r` / `expandExpr=entity.rows`。每个sheet独立展开、求值和生成cache；`sheetVarName=entity` 让顶层字段读取该对象，明细记录字段仍优先。默认循环项/索引变量为 `sheetLoopVar/sheetLoopIndex` 和 `workbookLoopVar/workbookLoopIndex`。

程序化模板同样可设置 `sheet.config={beginLoop:"data",loopVarName:"entity",sheetNameExpr:"entity.name"}`。来源 `sourceSheetId` 与展示名分开，输出带 `instanceId/instancePath`；名字清理非法字符、限制31字符，并在整个workbook范围按大小写不敏感去重，后缀为`(1)/(2)`。原生跨sheet限定符按相同循环实例映射，字符串字面量不被改名。空循环产生零个该类sheet，固定封面仍保留；若全部为空，IR/HTML可以为空，XLSX要求至少一个工作表并给出明确错误。默认最多100个sheet，可用RenderLimits显式配置。

输入数据应由Kon/SPL准备；例如中文属性字典可用 `cell.rp.ev.属性.field(cell.cp.ev)` 读取，列名列表可预先传入 `entity.columns`，避免恢复Java `keySet()`。SPL表达式标识符支持Unicode，保留中文列名。配置表中非空的 `展开前/展开后/后处理脚本` 会给具体配置格错误和迁移建议；不执行、不悄悄忽略Java/XLang初始化。

公式与文档元数据共用来源格→最终实例投影，原位展开不依赖全局行列偏移猜坐标。跨sheet引用按相同workbook/sheet循环上下文选择目标，保留公式字符串、绝对引用和外部/结构化引用原文。共享公式master/follower在读取时展开为普通公式；数组公式保留矩形边界，单格数组可独立复制，多格数组重叠或不再为矩形时给位置诊断。外部、结构化和spill公式交给Excel重新计算，并明确标记未计算。

静态超链接和 `linkExpr` 经同一坐标投影，XLSX建立每个sheet自己的关系；HTML显示安全的http/https/mailto/tel和内部链接，其他scheme保持普通文字。校验/条件格式的sqref与公式、autoFilter/sort、局部名称与打印区域/标题、分页和selection随展开/删除更新。冻结窗格描述viewport，split及topLeftCell保持固定；保护参数和未改富文本run保留，HTML显示run字体。模板批注作为声明被消耗后全部移除。

克隆sheet拥有独立table part、ID、displayName和关系，table范围、列名/列数、筛选与结构化公式引用随输出更新；静态styles/theme继续共享不变。全局范围名称可表示多个循环sheet的union，全局表达式名称取首个workbook上下文。未知受影响extLst精确定位到part，不把它扩大成拒绝所有动态模板。

行/列默认样式进入规范化 `rowStyles/colStyles`，实际单元格优先级为显式cell→row→column；空白格也有相同HTML背景。展开/删除按来源重映射这些默认样式。动态整行样式可给该行单元格设置相同 `styleIdExpr`，保留单格覆盖，不引入另一套样式求值器。

图片从模板drawing读取嵌入字节、anchor和偏移。描述中 `----` 后的 `testExpr` / `dataExpr` 由显式evaluator执行；每个保留的来源格实例生成自己的图片，`dataExpr` 可返回 `{bytes:Uint8Array或byte数组,mimeType:"image/png"}`，null不生成。输入图片不会反写；每张图片最多5MiB，默认总媒体最多1000项/20MiB，支持PNG/JPEG/GIF/BMP。不同输出sheet拥有独立drawing关系，HTML使用同一份图片实例。

`processExpr=QRCODE()` 通过显式 `runtime.renderBarcode` 编码当前值，空值不生成；生产worker注入support的同步PNG适配器。`qr:barcodeFormat=CODE_128`、`qr:width=320`、`qr:height=160` 设置格式与最小像素尺寸，默认QR_CODE；小尺寸自动扩大到完整module大小，anchor仍按单元格尺寸显示；`qr:margin/errorCorrection/encoding/imgType` 为受限编码选项。端口不接受文件路径、服务容器或绘图脚本。也可用 `imageExpr` 或纯patch `{image:photo}` 提供预生成图片。支持的QR、CODE_128/39/93、EAN_13/8、UPC_A/E、ITF、CODABAR、DATA_MATRIX、AZTEC、PDF_417均经过独立ZXing解码验证；Java仅用于验证，产品没有Java运行依赖。

原生图表按sheet克隆chart part及关系，更新标题、系列名称、类别/数值引用及cache，保留原图表样式。描述 `----` 后支持 `chartTestExpr/chartTitleExpr/chartTitleCellRefExpr/seriesTestExpr/seriesNameExpr/seriesNameCellRefExpr/seriesDataCellRefExpr/seriesCatCellRefExpr/axisDataCellRefExpr/axisTitleExpr/axisTitleCellRefExpr`。表达式读取当前sheet scope及只读 `chart/series/axis` 模型；范围引用使用统一projection。HTML展示同一份标题和图表数据；原生图表在Excel中呈现。过时的嵌入externalData副本从新chart移除，避免它覆盖当前workbook引用和cache。

来源只声明但未执行的 `seriesDataExpr/seriesCatExpr` 和扩展命名空间字段保存在 `inertBindings`，不求值、不冒称直接数组绘图；实际图表数据由工作表区域提供。数据准备、排序、初始化和外部IO由Kon/SPL或宿主先完成。

当前不执行 Nop XLang/Java 初始化工作表，也不宣称完整 Excel 函数或图表编辑器。未知受影响形态会准确诊断；支持的图片和图表按实际实例投影，不能把静态part存在等同于动态重定位。

公共输入是XLSX字节或 `compileReport(ReportTemplate)` 规范化值；不直接解释原始 `.xpt.xml` 的XDSL/VFS继承与Java脚本。规范化对象可以由Kon流程或应用构造，使用相同的布局、表达式、媒体与输出语义。完整来源对账见 [验收矩阵](../../.depa-analysis/report-parity-2026-10-22/acceptance-matrix.md)。

实现依据为本地 nop-report 的批注编译、父格/记录展开与 renderer 分离语义；独立 TypeScript 实现，没有复制 Java 源码或上游工作簿。详细来源与未移植范围见 [取证报告](../../.depa-analysis/porting-2026-10-22/inventory/nop-report.md)。
