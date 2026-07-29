# 表格与报表对账验收

> 2026-10-24 重观察：RP01–26/F/G/M/X/Q 的规范化输入断言、XLSX/HTML/HTTP 和网页测试在当前业务基线重新通过；动态 sheet 与格式处理已重读源实现。该证据是 TypeScript 当前验证及源码/保存输出对照，未运行完整 Java nop-report 引擎，未扩大为任意 Excel/XLang 兼容。当前详细裁决和仍待独立 review 的条件见[续作对账](../spl-compatibility-2026-10-23/acceptance-matrix.md)。

来源定义以 [report-inventory](report-inventory.md) 和 [formula-inventory](formula-inventory.md) 的源码、原工作簿和已保存输出证据为准。这两个库存是实施前快照；本表索引最终实现与实际验证，不篡改旧库存结论。Java 报表引擎未重新构建，数值 oracle 来自库存中明确标注的源码推导/原断言/保存输出，TypeScript 用规范化输入实际运行。

PASS 表示该行所述能力有结果断言；ADAPTED 表示保持业务能力、显式改变宿主协议或修复已证明的来源缺陷。它们不表示完整 Excel 或整个 nop-entropy 已兼容。企业 ORM、权限、容器、VFS 和独立 PDF/Word 均不进入本项目。

以下测试路径以 `packages/report-logic/__tests__/`（L）、`packages/report-xlsx-support/__tests__/`（X）为基准；HTTP 为 `packages/web-server/__tests__/report-workbench.test.ts`，浏览器为 `packages/web-ide/__tests__/e2e/report-workbench.e2e.ts`。

| 来源项 | 最终能力与裁决 | 可重观察证据 |
|---|---|---|
| RP01 | PASS 动态sheet/独立配置表、源sheet身份与输出实例分开、名称去重 | L/X `sheets.test.ts`，苹果/香蕉不同列集合及关系；HTTP与浏览器动态两sheet |
| RP02 | ADAPTED workbook→模板→sheet loop；before/after初始化改Kon准备输入与宿主资源释放 | L `sheets.test.ts` 嵌套顺序、空loop与封面；X拒绝带位置的Java hook，不偷偷执行 |
| RP03 | PASS inplace预留槽，超额才增长，非后代保留 | L `layout.test.ts` 2/3/4项TAIL；X `workbook.test.ts` 真实序列化 |
| RP04 | PASS 同父兄弟共享空间，父域独立 | L `layout.test.ts` 3项与2项，footer只移动2行 |
| RP05 | PASS 邻格默认拉伸与两个轴关闭开关 | L `layout.test.ts` 默认合并/关闭/兄弟展开不误合并 |
| RP06 | PASS 父锚位于多行段内部，原合并和空样式格 | L `layout.test.ts` 三行段；L `groups.test.ts`；X边框连续 |
| RP07 | PASS 行特有列、列特有行、行→列→行 | L `layout.test.ts` X=p/q、Y=z/空及对称用例，固定尾列对齐 |
| RP08 | PASS hidden与physical removal分开、删除后重求值及重定位 | L `processing.test.ts`；X `workbook.test.ts`；浏览器qty0删除后SUM=5 |
| RP09 | PASS 命名/动态样式与静态row/column继承 | L `processing.test.ts`；X `workbook.test.ts` palette不变、实际s、空格HTML背景；row优先col，显式cell优先 |
| RP10 | ADAPTED 原值/显示/导出分离、SSF及显式dict输入 | L `processing.test.ts`；X `workbook.test.ts` 数值1234.5与￥文本；浏览器下载类型断言 |
| RP11 | PASS 内部/外部link及关系、HTML转义和scheme限制 | X `references.test.ts` 动态两sheet+删除；unsafe URL负例 |
| RP12 | PASS 嵌入图片、描述配置、条件/字节替换、实例anchor及独立关系 | X `media.test.ts` 2sheet×2记录=4图片、offset/size、HTML及限制负例 |
| RP13 | ADAPTED QRCODE显式同步PNG端口，无Java运行依赖 | X `barcode.test.ts`、HTTP、浏览器naturalWidth；mission `verification/BarcodeFormats.java` 独立ZXing解码13种格式；CODE93强制C/K字符已修 |
| RP14 | PASS 原生chart逐sheet独立、标题/series/category/axis绑定与cache | X `charts.test.ts` East/2 West/5与North/7，样式12/粗体/legend保持；schema-only数组表达式保存在inertBindings且NEVER_RUN零执行 |
| RP15 | PASS validation sqref及公式引用重定位 | X `references.test.ts` 范围、formula1/2、提示/allowBlank及删除 |
| RP16 | PASS 原OOXML CF范围/公式/priority/dxf保真 | X `references.test.ts`；HTML动态样式由RP09投影。来源未证明完整条件格式解释器，不宣称已经复制此引擎 |
| RP17 | PASS definedNames/localSheetId/printArea/printTitles | X `references.test.ts` 配置表删除、动态sheet名称和局部定义 |
| RP18 | PASS 页面/页边距/headerFooter、分页点/打印范围及HTML print | X `references.test.ts` A4横向/页边距与break移动；XLSX结构真实断言 |
| RP19 | PASS protection、冻结pane、selection映射 | X `references.test.ts` pane视口固定，selection按几何变化，sheet实例独立 |
| RP20 | PASS rich text、空样式格、批注消费 | X `references.test.ts` 未变runs保留/HTML字体；X `workbook.test.ts` 边框；模板批注按来源全部消费 |
| RP21 | PASS 反引号/三引号多行配置与定位错误 | L `processing.test.ts`、L `report.test.ts` 非法项带source位置 |
| RP22 | ADAPTED 上下文字段array/scalar/null、静态展开标记 | L `processing.test.ts` 保留重复记录；排序用Kon/SPL显式准备，来源schema expandOrderBy未见运行消费 |
| RP23 | ADAPTED XLSX或规范化ReportTemplate输入共用核心 | L全部规范化fixtures与X真实XLSX；公开README明确raw `.xpt.xml` 的XDSL/VFS/Java语法不直接解释 |
| RP24 | ADAPTED 数据准备由Kon/宿主，后处理为受限纯patch | L `processing.test.ts`、`members.test.ts` 当前格自身后处理/依赖次序，非法patch字段和反写负例；图片patch真实导出 |
| RP25 | PASS 依赖值、cellSet/层次公式、native f+v与HTML一致 | L `formulas.test.ts`、`members.test.ts`；X `workbook.test.ts`；HTTP与浏览器当前缓存值和公式 |
| RP26 | PASS autoFilter/sort/table及structured引用独立重定位 | X `references.test.ts` table的id/name/part/列，unknown受影响ext精确诊断，未受影响载体保留；不新造pivot/宏引擎 |

| 公式项 | 最终验证与适配 |
|---|---|
| F01–F02 | L `formulas.test.ts` 当前父域单源格、矩形集合、全局汇总；同一selector驱动求值/导出 |
| F03–F05 | 同文件绝对/两轴交集；财务上一年+同月的嵌套路径，L `members.test.ts` 子集合/列父域 |
| F06–F08 | 同文件relative/reverse/空位置；L `members.test.ts` 删除首项后+0自身/-1前保留项，跨父域ordinal |
| F09–F12 | 标量多基数报错、全局过滤、前向依赖只算一次、循环路径；循环明确报错是来源半成品cache行为的修复 |
| G01–G09 | L `formulas.test.ts` 与 `members.test.ts` Number-only/单层迭代、null/empty、类型严格、默认值、sample统计 |
| G10–G12 | 财务PROPORTION/局部与全局RANK/累计4100，空值与数值字符串负例。JS number归一Java数字细分；ACCSUM确定prefix避免源重复调用再次累加 |
| G13–G19 | STDEV/VAR、COUNTIF/SUMIF、CONCAT、IF/MEDIAN数值断言；完整*和?通配是来源simple-pattern缺陷的明确扩展 |
| M01–M03 | IF/AND/OR/SWITCH及中缀逻辑懒分支，不读取未选循环/BOMB分支，零/单参数行为独立断言 |
| M04–M05 | L `members.test.ts` 有限cellSet成员链、只读view/rp/cp/rr/cr/ev/ei、跨度/ranges、map/filter/flatMap；member.sum与Number-only SUM不同语义分别验证 |
| M06–M07 | CELLS/EVAL_EXCEL_FORMULA/EXPAND_EXCEL_FORMULA为显式目标API；动态深度限制、scalar unwrap与迭代区分；任意host/prototype调用禁止 |
| X01–X04 | L/X `references.test.ts` 普通物理引用、quoted sheet/$/字符串保护、跨sheet/loop匹配，物理模式独立于report selector |
| X05–X06 | L `formulas.test.ts` Q04值4/5/6及SUM(A1)+A4等实际地址；X `workbook.test.ts` f+v/字符串/错误cache；不能等价的类型/懒宏/SPL表达式物化当前值并给诊断 |
| X07–X08 | X `references.test.ts` shared master/follower展开为独立公式、array范围及重叠诊断、external/structured保真但明确未计算；L旧原生复制测试继续通过。不宣称完整spill/外部工作簿求值 |
| Q01–Q03 | L `formulas.test.ts` 最后一例：相同归一数据实际输出5/18/8/11及R5 |
| Q04 | 同文件report-mode native export例：4/5/6与各自公式，非每行全局SUM |
| Q05 | 同文件最后一例：X1/X2/X3/X5实际[3,7,9,7/9]；全局filter引用e.rp.ev |
| Q06 | 同文件financial fixture：年内/全局排名10/13、2003首月累计3100、总4100及同比环比 |
| N01–N12 | 来源库存最小反例分别落在L `formulas.test.ts` / `members.test.ts` / `groups.test.ts`，含空集合、严格聚合、宏与循环，不以源测试仅输出文件充当验证 |

所有实现均保持：调用方模板/数据是输入；格实例/最终坐标/计算cache是请求内衍生值；codec负责OOXML字节，核心仅调用显式evaluator/格式化/条码端口。负向检查包括输入不变、跨请求隔离、非法成员/patch、基数/循环、媒体限制和源码无文件IO/JS eval。上批实值结论限于本表的具体规范化场景，不据此关闭任意源工作簿或尚未准入的兼容疑点。历史命令见 [report-parity-acceptance evidence](../../.cdmt-lite/missions/archived/report-parity-acceptance/evidence.md)，当前命令见续作矩阵所指本轮证据。
