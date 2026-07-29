# 报表公式独立盘点（2026-10-22）

状态：核心语法、19函数、全局宏、真实fixtures、Excel输出边界与复用建议已完成。只分析，不修改实现；旧 codument 只读，不调用其工具；企业平台不在范围；Java / XLang 语法以现有 Kon / SPL 表达式承接，报表特有 cellSet 作为局部扩展。当前实现差距以独立盘点开始时的代码为基线；父层可据本文件串行实施，后续实现不由本盘点文件宣称已验收。

路径缩写（所有证据均为本地源码，不使用互联网）：

- `R` = `/Users/kongweixian/java/src/nop-entropy/nop-report/nop-report-core`
- `E` = `/Users/kongweixian/java/src/nop-entropy/nop-format/nop-excel`（实际直接依赖路径，并非仓库根下的 nop-excel）
- `T` = `/Users/kongweixian/infra-dev/spl-bun`

## 可立即实施的结论

1. **区分两条语义**：原生 Excel A1 公式是 output 坐标公式，需要保存 / 坐标重写；Nop 报表公式中的 `A2` 是模板名称，展开后返回多个 cell 实例，依赖行父 / 列父选择。当前 `T/packages/report-logic/src/formula.ts:4-40` 只实现第一条的局部能力，`render.ts:91-92` 对原生公式删除 value，因此 HTML 没有计算缓存。不能把 report formula 的 `SUM(B2)` 简单转换为 Excel 的 `SUM(B2)`。
2. **Nop 的 ExcelFormulaParser 也不是完整 Excel 引擎**：它复用 cellSet 选择；只有 Excel 风格运算符与字符串、注册函数。Excel 文件内 `<f>` 在初始化时编译为这种报表公式并设置 exportFormula（`R/src/main/java/io/nop/report/core/build/XptModelInitializer.java:145-165`）。另一路 `ReportExpressionParser` 继承相同选择语法，但开启全部 XLang 特性（`R/.../expr/ReportExpressionParser.java:13-19`）。移植时保留两种来源 / 输出意图，表达式计算主体使用现有 SPL。
3. **先建全部实例再求值**：需要 sheet 内模板名称→实例列表、每实例行父 / 列父 / descendants 与 expandIndex、单次渲染的求值状态。当前 `T/packages/report-logic/src/render.ts:77-98` 一边生成实例一边求值，无法可靠 forward reference 或按实例递归依赖。
4. **源代码缺陷要显式记录**：`CellLayerCoordinateExecutable.java:69` 的 absolute 分支查的是 `cell.getName()`（当前格），没有查 `layerCoordinate.getCellName()`（目标格）；因此过滤单格 `IF("...",B2)` 有误，range absolute 则正确。兼容目标应按目标名称查全 sheet 实例，不能复制该缺陷；保留反例。

## 核心语法与算法

| ID | 真实语法 / 输入 | Nop 语义 | 证据 | 当前差距 / 实施要求 |
|---|---|---|---|---|
| F01 | `B2` | 返回模板 B2 在当前层次上下文内的实例集合；先分别在行父链、列父链寻找最近匹配的父格或该父格 descendants；两轴都有结果则按实例交集；仅一轴有结果取该轴；都无结果才 sheet 全局 namedCells。不是当前位置的物理 B2。 | `R/.../coordinate/CellCoordinateHelper.java:223-235,303-332` | GAP：当前 expression runtime 只接 scope；要有实例 selector。 |
| F02 | `B2:C4` | 遍历模板矩形中每个地址（row-major），对每地址调用 F01，再 concat 其实例；不等于输出矩形，源码未 dedup。 | 同文件 `237-249` | GAP：不能使用 regex A1 copy 代替。 |
| F03 | `B2[A2:2]` | 从当前格行祖先定位 A2 的候选集合，选第 2 个（绝对 position 1-based），再取其 rowDescendants 中的 B2。 | parser `AbstractExcelFormulaParser.java:80-125`；helper `47-103,267-283` | GAP：完整 row / column relation，不仅 expansion chain。 |
| F04 | `B2[;C1:2]` | F03 列轴版本；前半为空，分号后为列坐标。 | parser `86-95`；helper `158-214,285-301` | GAP。 |
| F05 | `B2[A2:1,A3:2;C1:2]` | 每一轴依次下钻已选父格的 descendants；行 / 列轴最后各返回 B2 集合，再交集；逗号表示层次路径，不是 union。 | helper `54-61,101-102,165-172,212-213,34-37` | GAP：二维选择结果保持实例身份。 |
| F06 | `B2[A2:-1]` / `B2[A2:+1]` | `-1` / 显式 `+1` 设置 relative；取当前最近 A2 祖先（或自己）的 expandIndex，偏移 -1/+1，在候选集合中索引；相对索引是 0-based offset，不是物理行偏移。越界空集。 | parser `106-117`；helper `68-98,179-209` | GAP：存 expansion item index；当前 `ExpansionItem.index` 可复用。 |
| F07 | `B2[A2:!-1]` | reverse 且 position<0，取候选集合 `length+position`，因此 `!-1` 取末个；`!2` 实际仍走绝对正数第 2 个。 | parser `106-117`；helper `68-95` | GAP：reverse / relative 两标志分开。 |
| F08 | `B2[A2]` / `B2[A2:0]` | parser 默认 position=0、relative=false；helper 无法选择父格，返回 null；执行层规范为空集。不要凭直觉把无位置当 current。 | `TestColLayerCoordinateResolve.java:89-95`；helper `90-98`；`CellLayerCoordinateExecutable.java:69-78` | 明确以源码测试为准；`+0` 可设置 relative 但 stringify 丢失 `:0`，需单独 AST 保留。 |
| F09 | `B2+1` / `-B2` / `B2=3` | parser 对二元 / 一元 / 逻辑运算的 cellSet 自动取 `.value`；空集值 null；单元素取值；多元素抛 result-not-one-cell。函数参数仍是 cellSet，可以聚合。 | `AbstractExcelFormulaParser.java:128-158`；`ExpandedCellSet.java:155-173` | GAP：scalar cardinality 必须明确；不能静默取 first / JS 数组强转。 |
| F10 | `SUM(IF("e.value <= 2",A1:B4))` | 仅大写 IF + 2 参数 + 首参数字符串字面量 + 第二参数 cellSet 才触发特殊 filter；先将范围改为 sheet 全局选择，再将字符串编译为 `e=>(...)`，e 是 cell 实例，过滤后返回 cellSet；普通 IF 是条件函数。 | `ExcelFormulaParser.java:82-133`；`FilterCellSetExecutable.java:51-55`；`TestExcelFormulaParser.java:65-86` | GAP：借现有 SPL 对 predicate 求值，注入 `e.value` 等声明的实例 view；单地址 absolute 源缺陷见 RISK。 |
| F11 | dependency / forward ref | 每次选出 cellSet 后先 evaluate 每个实例；evaluateCell 首次标 evaluated 再执行 valueExpr，后续重复引用返回缓存。 | `CellRangeExecutable.java:59-76`；`CellLayerCoordinateExecutable.java:60-78`；`ExpandedSheetEvaluator.java:109-131` | GAP：建立全部实例，递归求值；render 级缓存，无跨渲染共享。 |
| F12 | cycle | 源码仅提前 setEvaluated(true) 截断递归，没有显式 visiting 状态 / 循环诊断，循环返回未完成的旧值，结果可能依执行顺序。 | `ExpandedSheetEvaluator.java:109-115` | RISK：建议三态 unvisited/visiting/done + 输出 cycle path，不应宣称 Nop 自带严格 cycle error。 |

`...` 表示 `R/src/main/java/io/nop/report/core`，test 证据相应位于 `R/src/test/java/io/nop/report/core`。

## 第一批可直接实施的精确用例

以下为从算法推导的合成验收（非声称 Java 已跑），不依赖 Java/XLang；推荐通过注入既有 `compileExpression` 的 ReportExpressionRuntime 执行。

建立两组实例：A2 第 0/1 个行展开实例分别代表 North/South；North 的 B2 实例值 `[10,20]`，South 的 B2 值 `[7,8]`；各 B2 的行父是对应 A2。另有无父根汇总格 D4。

| 用例 | 所在实例 / 表达式 | 精确结果 | 来源依据 |
|---|---|---|---|
| N01 | North 内 D2：`SUM(B2)` | 30 | F01 + ReportFunctions.SUM |
| N02 | South 内 D2：`SUM(B2)` | 15 | F01 |
| N03 | 根 D4：`SUM(B2)` | 45 | F01 fallback 全局 |
| N04 | North 内 D2：`SUM(B2[A2:2])` | 15 | F03 1-based 绝对位置 |
| N05 | South 内 D2：`SUM(B2[A2:-1])` | 30 | F06 当前 A2 expandIndex 1 - 1 |
| N06 | North 内 D2：`SUM(B2[A2:-1])` | 0 | F06 越界→空 cellSet；SUM(empty iterator)=0 |
| N07 | North 内 D2：`SUM(B2[A2:!-1])` | 15 | F07 从尾位置 |
| N08 | 根 D4：`B2+1` | cardinality error（4 个实例） | F09 |
| N09 | 单例 B3=4；C3 expression=`B3*2`；A3 expression=`C3+1`；A3 先于 C3 | A3=9，C3=8；每格一次 | F11 |
| N10 | A1 expression=`B1+1`；B1 expression=`A1+1` | 推荐明确 cycle error 含 A1→B1→A1；源只是截断递归，不保证此错误 | F12 / RISK |
| N11 | 全局 A1:B2 依模板顺序值 `[1,2,3,4]`：`SUM(IF("e.value <= 2",A1:B2))` | 3 | F10，特殊过滤需要全局语义 |
| N12 | 根汇总格 D4：`SUM(IF("e.value <= 10",B2))` | 25（10+7+8）；源 absolute 分支错误会查 D4，结果不能作为 oracle | F10 + 已证源缺陷 |

二维用例：行 A2=[North,South]；列 B1=[Jan,Feb]；四个模板 B2 实例按 (North,Jan)=10,(North,Feb)=20,(South,Jan)=30,(South,Feb)=40，行父分别是 A2 实例，列父分别是 B1 实例。根单元格 `SUM(B2[A2:1;B1:2])=20`；(South,Feb) 内 `SUM(B2[A2:-1;B1:-1])=10`；越界路径规范空集，不能全局 fallback。证据 F05–F07。

## 暂定 RISK 登记

| ID | 风险 | 证据 / 处置 |
|---|---|---|
| RF01 | Nop 公式与 Excel 公式混淆，错误地把物理 A1 重写当 cellSet 语义 | `T/.../formula.ts:4-5` 明示独立能力；先保留来源 / export 意图。 |
| RF02 | 源 absolute 单地址查错当前名 | `R/.../expr/CellLayerCoordinateExecutable.java:69`；以 N12 作防复制回归。 |
| RF03 | 源循环依赖无三态错误且缓存半成品 | `R/.../engine/ExpandedSheetEvaluator.java:109-115`；严格诊断作为明确改进。 |
| RF04 | 缺少 cellSet 标量基数检查会静默给出错误数值 | `R/.../model/ExpandedCellSet.java:155-173`；N08。 |

## 19 个报表函数的完整参数与空值规则

以下全量来自 `R/src/main/java/io/nop/report/core/functions/ReportFunctions.java` 的所有 public static 功能函数（准确为 **19 个**）。`ReportFunctionProvider.java:12-17` 注册它们；父类 `nop-kernel/nop-xlang/.../DefaultFunctionProvider.java:20-28,42-43` 只是空 Map，不额外注册一套 Excel 函数。**实际名称解析先全局后scope，所以IF会先命中全局宏，见后表M01**。不能据类名推断“所有 Excel 函数均支持”。

共通规则：`CollectionHelper.toIterator(o,true)` 对 null 为空迭代器、Iterable/Iterator/数组迭代一层、其他标量包装成单元素；**不会递归 flatten**（`nop-kernel/nop-commons/.../CollectionHelper.java:917-940`）。cellSet 迭代的是值，不是 cell 对象（`ExpandedCellSet.java:180-183`）。除特别注明外，数值计算仅接受 Java Number，字符串数值 / Boolean 都忽略；移植到 JS 需用 `typeof value === "number"` 一类规则，不能复用会执行 `Number("2")` / `Number(true)` 的普通 SPL sum。

| ID | 函数（精确形参） | 空值 / 基数 / 返回规则 | 精确用例 | 源码行 |
|---|---|---|---|---|
| G01 | `SUM(...values)` | 无参数或 varargs=null→null；每参数一层迭代，忽略非 Number；累计初值0，故空集→0、单个null→0。 | `SUM([1,"2",true,null,3])=4`；`SUM([1,2],[3],4)=10`；`SUM()=null`；`SUM(null)=0` | 40-58 |
| G02 | `PRODUCT(values)`（单参数） | 参数null→null；一层迭代、只乘 Number，初值1，因此空集 / 全非数值→1。 | `PRODUCT([2,"3",4])=8`；`PRODUCT([])=1` | 60-75 |
| G03 | `SUMPRODUCT(valuesA,valuesB)` | 任一参数null→null；同步拉取两迭代器，较短长度为限；某对任一非 Number 则整对忽略；初值0。 | `[2,"x",4]` 与 `[3,10,5,7]` →26；`[]` 与 `[1]`→0 | 77-96 |
| G04 | `COUNT(values)` | 参数null→null；只计 Number，空集0；0也计，Boolean/数值字符串不计。 | `COUNT([1,"2",null,"",false,0])=2` | 98-114；已有回归目标与注释一致 |
| G05 | `COUNTA(values)` | 参数null→null；只排除 null 和空字符串 `""`，不 trim；0、false、空白字符串、容器都算。 | `COUNTA([1,"2",null,"",false,0," "])=5`；`COUNTA([])=0` | 116-131；`StringHelper.isEmptyObject:1098-1104` |
| G06 | `AVERAGE(values)` | 参数null→null；只计 Number；无数值时调用 MathHelper.divide(0,0)，返回 NaN，**不是注释暗示的 Excel #DIV/0! 对象，也不是 null**。 | `AVERAGE([1,"2",3])=2`；`AVERAGE([])=NaN` | 133-152；`MathHelper.divide:843-861` |
| G07 | `MIN(values)` | null或无 Number→null；只比较 Number。 | `MIN([3,"1",2])=2`；`MIN([])=null` | 154-174 |
| G08 | `MAX(values)` | 同MIN。 | `MAX([3,"9",2])=3`；`MAX([])=null` | 176-196 |
| G09 | `NVL(value,defaultValue)` | 对参数做 IValueWrapper 解包（cellSet.value）；主值只有null才取默认；""/0/false均保留；任一被解包多元素cellSet会抛基数错误。 | `NVL(emptyCellSet,9)=9`；`NVL(0,9)=0`；`NVL("",9)=""` | 198-211 |
| G10 | `PROPORTION(cellSet,rangeCellSet?)`（隐式scope） | 第1参必须单值cellSet（空集.value=null→null）；value转Number；不传range时，对当前sheet所有同名cell实例求SUM作为分母，缓存在第一个同名cell；传range要求正好1个range cell，对其childSet(同名)求SUM；childSet **先行 descendants，非空优先；其次列 descendants**，不是两轴交集；分母0→NaN。 | 当前B2=20、全sheet同名B2=[10,20,70]→0.2；range=A2且其B2=[10,20]→2/3。 | 213-239；`ExpandedCell.childSet:721-732`；`XptRuntime.getNamedCellSet:227-233` |
| G11 | `RANK(cellSet,rangeCellSet?)`（隐式scope） | 第1参要求正好1个cell；raw value=null→null；默认全部同名cell，range同G10的childSet；按Number降序、非Number映射null排尾；并列为竞赛排名（1,1,3），按Java Objects.equals判断相等（1与1.0数值类型不同可能不并列）；按cell身份查询原次序rank。 | `[100,200,300,100,200,300]`→`[5,3,1,5,3,1]`（已有Java断言）；`[9,9,4]`→`[1,1,3]`。 | 241-270；`RankCompute.java:44-81`；`TestReportFunctions.java:24-27` |
| G12 | `ACCSUM(cellSet,rangeCellSet?)`（隐式scope） | 第1参正好1格；缓存一个可变累加器（初值0），默认挂在第一个同名cell，显式range挂在该单格range；仅当前格的Number值加进去，null/字符串保持旧累计；**按照调用顺序累计，非根据位置重算prefix**；重复调用会再次累加。 | 顺序当前B2值[10,null,20,"3",30]→[10,10,30,30,60]；同格10调用两次→10,20。 | 272-296 |
| G13 | `STDEV(values)` | 参数null或Number个数<2→null；忽略非Number；样本标准差（n-1），double计算。 | `STDEV([2,4,6])=2`；`STDEV([2])=null` | 304-338 |
| G14 | `VAR(values)` | 与G13同筛选，样本方差（n-1）。 | `VAR([2,4,6])=4` | 340-371 |
| G15 | `COUNTIF(range,condition)` | range/condition的**原始参数**任一null→null；condition和值支持IValueWrapper解包；字符串含`*`或`?`先走simple-pattern；底层实际仅实现首/尾星号，**不实现?、内部星号**；否则支持前缀 `> < >= <= = <>`；value为Number且右边是数字则数值比较，否则字符串字典序；无运算符用Objects.equals（不隐式数字字符串转换）。 | `[5,9,10,11,15]`,">=10"→3；"<=9"→2；"<>10"→4；`[1,"1"]`,1→1；`["ab","ac","b"]`,"a*"→2，但"a?"→0（源缺口）。 | 373-395,468-530；`TestReportFunctions.java:31-38`；`StringHelper.java:2150-2167` |
| G16 | `SUMIF(range,condition,sumRange?)` | 原始range/condition任一null→null；sumRange null/省略→对range自身匹配值求和；给sumRange则一一对齐，任何一端耗尽即停；对range值做G15匹配，sum值仅Number纳入；初值0。 | `[1,2,3,4]`,">2"→7；keys["a","b","a","b"],"a",[1,2,3,4]→4；keys同上,sumRange[1,2]→1。 | 397-432；`TestReportFunctionsCondition.java:39-50` |
| G17 | `CONCAT(...values)` | 无参数 / varargs=null→null；每参数迭代一层；跳过null，其余直接.toString()无分隔符；空集→""，null单参→""。 | `CONCAT(["a",null,2],"b")="a2b"`；`CONCAT()=null`；`CONCAT(null)=""` | 434-452 |
| G18 | `IF(condition,trueValue,falseValue)` | 该Java直接函数condition先解包，再ConvertHelper.toTruthy；只对选中返回值做IValueWrapper解包。**但实际报表表达式先解析全局IF宏**，支持2/3参数并只计算所选分支，false分支省略则null；不能从此3参数Java方法推导实际IF是eager。F10特殊过滤在parser阶段先被替换，不会进入条件IF宏。 | `IF(1,7,9)=7`；`IF(0,7,9)=9`；`IF(false,7)=null`；未选分支的循环引用不得触发。 | 454-466；`GlobalFunctions.java:338-355`；`LexicalScopeAnalysis.java:721-727,774-779` |
| G19 | `MEDIAN(values)` | 参数null/无Number→null；只取Number转double排序；奇数中位，偶数取中间平均。 | `MEDIAN([5,1,3])=3`；`MEDIAN([4,1,3,2])=2.5`；`MEDIAN(["2"])=null` | 532-561 |

源函数的空值参数与“空cellSet参数”不同：后者是非null可迭代容器。COUNT(emptySet)=0，COUNT(null)=null；PRODUCT(emptySet)=1，PRODUCT(null)=null；CONCAT(emptySet)=""，CONCAT(null)=""但CONCAT()=null。不能在统一前处理阶段把空cellSet直接变成null，否则会改变聚合语义。

`PROPORTION` / `RANK` / `ACCSUM` 缓存在实例的computed map，生命周期属于单次sheet渲染，不是表达式编译缓存或全局dataset缓存。移植建议先保持函数上下文显式：`fn(runtime, args)`，runtime承载本sheet实例索引/求值表/cache；可变ACCSUM需固定遍历顺序或明确受控改成prefix，不能默默换语义。给局部range时是父cell selector，不能接一个普通多格range后求并集。

新增风险：

| ID | 风险 | 证据 / 处置 |
|---|---|---|
| RF05 | 普通SPL sum/avg会转换数值字符串和Boolean，与ReportFunctions的Number-only语义不同 | `T/packages/expression/src/functions.ts:6-14,68-77,592-617`；报表局部注册严格聚合，不改变全局SPL。 |
| RF06 | ACCSUM是可变、顺序敏感函数；依赖求值重排或重复调用可改变结果 | `ReportFunctions.java:279-295`；用单次渲染runtime拥有cache且测试调用顺序。 |
| RF07 | `AVERAGE([])`和`PROPORTION(...,sum=0)`源返回NaN，导出/JSON不能自然保真 | `MathHelper.java:843-861`；明确错误值表示；不能声称是null或Excel error对象。 |
| RF08 | RANK的类型敏感相等与JS number单一类型存在差异 | `RankCompute.java:67-77` + `ReportFunctions.java:267-269`；记录采用JS数值等值的合理适配，别宣称Java类型级完全保真。 |

## 全局宏及cellSet对象能力补全

`X = /Users/kongweixian/java/src/nop-entropy/nop-kernel/nop-xlang/src/main/java/io/nop/xlang`。这些是报表公式实际可达的纯表达式语义，不移植Java/XLang编译器或平台服务。

| ID | 能力 | 真实语义 / 精确例子 | 证据 | 复用与差距 |
|---|---|---|---|---|
| M01 | `IF(test,yes,no?)` | 2或3参数；宏转IfStatement，懒求所选分支。`IF(false,A1+1,7)`不得读取A1。 | `X/functions/GlobalFunctions.java:338-355`；`X/compile/LexicalScopeAnalysis.java:721-727,774-779` | GAP：`T/packages/expression/src/evaluator.ts:283-289`普通call预求所有arg；报表局部需AST级懒分支，不能仅注册if函数。 |
| M02 | `OR(...expr)` / `AND(...expr)` | 宏转逻辑树；0参→false（连AND()也如此）；1参原样返回；多参短路逻辑。另支持中缀`(1>0) AND (1>2)`→false，OR对应→true。 | `X/functions/GlobalFunctions.java:303-334`；`R/.../expr/ExcelFormulaParser.java:194-207`；`R/src/test/.../TestExcelFormulaLogicKeyword.java:38-52` | 本项目parser已支持AND/OR/not中缀（parser.ts:329,403-430）；需保留短路而不是 eager arg map。 |
| M03 | `SWITCH(value,case1,result1,...,default?)` | 至少3参数；宏构建SwitchStatement，根据value选case，最后落单参数为default。 | `X/functions/GlobalFunctions.java:358-390` | 可借SPL case语义承接，须验证lazy和数值比较适配；不能误判为未定义Excel函数。 |
| M04 | cellSet属性 / 成员 | `value`严格单值；`value(1)`为0-based第2个值、`value(-1)`末值；`get(index)`越界null；firstValue/lastValue、firstCell/lastCell、size/isEmpty、rowCount/colCount、cellRanges、sum、map/filter/flatMap、rowChildSet/colChildSet、realCells均真实存在。 | `R/.../model/ExpandedCellSet.java:60-135,155-226` | GAP：`ReportExpressionParser(ALL)`可用；ExcelFormulaParser仅函数调用特性，不应把全部成员语法混入Excel公式。现SPL成员registry可增加cellSet adapter，保持public contract。 |
| M05 | filter实例view | `e.rp`=rowParent、`e.cp`=colParent、`e.ev`=expandValue、`e.ei`=expandIndex，`rr/cr`为轴根；还可读value/name/rowIndex/colIndex等。真实模板用`e.rp.ev.name=='X2'`。 | `R/.../model/ExpandedCell.java:650-677`；10-导出Excel公式 fixture的E2 | 必须注入只读view与明确权限；把关联作为runtime派生索引，别暴露可变实现类。 |
| M06 | 程序调用入口 | `xptRt.cells(expr)`缓存坐标表达式再动态解析；`evalExcelFormula(text)`返回值，`expandExcelFormula(text)`返回输出Excel公式字符串；空白text→null。 | `R/.../engine/XptRuntime.java:275-280,348-370` | Java调用替换为本项目显式Report runtime API / SPL已注册函数，不复刻xptRt Java对象。 |
| M07 | scalar unwrap与集合迭代分开 | 一元/二元运算取cellSet.value；函数聚合保留cellSet可迭代；成员访问保留cell对象语义。 | `AbstractExcelFormulaParser.java:128-158`；`ExpandedCellSet.java:168-183` | 局部parser/AST节点要保持两条分支；字符串正则重写不足以覆盖嵌套语义。 |

## 真实源码fixtures（已逐个读取ZIP XML）

工作簿内XML通常压成单行，证据用**绝对工作簿路径＋ZIP part＋cell/comment坐标**，不伪造行号；对应Java测试给可定位行号。以下cached `<v>` 是模板已有cache，**不视为重跑Java的验证结果**。

| ID | 本地fixture | 读到的真实语法 / 输入 | 精确验收与证据 |
|---|---|---|---|
| Q01 | `R/src/test/resources/_vfs/nop/report/demo/test-range-formula.xpt.xlsx` | `xl/worksheets/sheet1.xml` A3=`SUM(A1)`，C3=`SUMPRODUCT(A1,B1)`；comments1.xml A1：expandExpr=ds1,expandType=r,field=a；B1 field=b；sheet2.xml B2数据[{a:1,b:2},{a:4,b:4}]。 | 展开后A1值[1,4]、B1=[2,4]；根SUM=5，SUMPRODUCT=18。`TestReportEngine.java:113-125`仅渲染/输出文件，无这两个数值断言，需TS补真断言。 |
| Q02 | `R/src/test/resources/_vfs/nop/report/demo/test-sum-values.xpt.xlsx` | A3=`SUM(A1,3)`，C3=`SUM(A1,B1)`；同Q01数据。 | SUM(A1,3)=8；SUM(A1,B1)=11。`TestReportEngine.java:128-141`同样不是数值oracle。 |
| Q03 | `R/src/test/resources/_vfs/nop/report/demo/test-layer-coordinate.xpt.xlsx` | comments1.xml A1行展开[1,2,3]、B1列展开[1,2,3]；C1 valueExpr=`'R'+(B1.value(1)+B1.value(2))`。 | value(1)=2,value(2)=3，文本R5；已有`TestReportEngine.java:215-221`断言HTML含R5。 |
| Q04 | `R/src/test/resources/_vfs/nop/report/demo/test-expand-excel-formula.xpt.xlsx` | A1行展开[1,2,3]；A2静态3；B1 valueExpr=`xptRt.evalExcelFormula('SUM(A1)+A2')`，processExpr调用expandExcelFormula设置公式。 | `XptModelInitializer.java:259-267`确认B1自动以左侧行展开A1为rowParent，因此B1的三个实例为4、5、6；源A2输出移到A4，导出公式分别`SUM(A1)+A4`、`SUM(A2)+A4`、`SUM(A3)+A4`，不是三个实例都SUM全局A1:A3。`CellRange.java:116-125`确认单格输出不重复端点。`TestReportEngine.java:200-205`仅输出xlsx，以上是源码推导，移植应补数值与公式双断言。 |
| Q05 | `/Users/kongweixian/java/src/nop-entropy/nop-report/nop-report-demo/src/main/resources/_vfs/nop/report/demo/base/10-导出Excel公式.xpt.xlsx` | sheet1.xml E2=`IF(B2="%",SUM(IF("e.rp.ev.name=='X2'",C2:D2))/SUM(IF("e.rp.ev.name=='X3'",C2:D2)),SUM(C2:D2))`。sheet2.xml数据X1=(1,2),X2=(3,4),X3=(4,5),X5=(null,null,unit%)。 | 各行E值[3,7,9,7/9]；真实HTML快照`.../nop-report-demo/_cases/io/nop/report/demo/TestReportDemoBizModel/testExportFilterFormula/output/base/10-导出Excel公式.xpt.xlsx.html:99-102`显示3.00、7.00、9.00、0.78。同时覆盖懒IF、全局range filter、e.rp.ev和分散输出范围。 |
| Q06 | `/Users/kongweixian/java/src/nop-entropy/nop-report/nop-report-demo/src/main/resources/_vfs/nop/report/demo/base/05-同比环比等财务统计表.xpt.xlsx` | comments1.xml D3=`IF(B3.expandIndex > 0,C3/C3[B3:-1],'--')`；F3=`IF(A3.expandIndex>0,C3/C3[A3:-1,B3:+0],'--')`；H3=PROPORTION(C3,A3)，I3=RANK(C3,A3)，J3=RANK(C3)，K3=`NVL(K3[B3:-1],0)+C3`，L3=ACCSUM(C3)。 | 输入2002月1..12金额[100,200,300,400]重复3次（合计3000），2003月1..5金额[100,200,300,400,100]（合计1100），总4100。2002月1：环比/同比'--'、占比1/30、年内rank10、全局rank13、年内累计100、总累计100；2002月2：环比2、年内累计300、总累计300；2003月1：环比'--'、同比1、占比1/11、年内rank4、全局rank13、年内累计100、总累计3100；2003月5：环比0.25、同比1、年内累计1100、总累计4100。`+0`表达保持该月份索引，切换上一年。 |

Q01/Q02/Q04/Q06的推导均应在移植后执行断言，不把源测试仅导出文件等同数值验证。Q06另有保存HTML快照佐证：`.../nop-report-demo/_cases/io/nop/report/demo/TestReportDemoBizModel/testSingleReport/output/base/05-同比环比等财务统计表.xpt.xlsx.html:374-375,385-390`可核对100/300、3000、3100与4100，以及年内/全局排名。所有fixture内Java/XLang常量均归一为相同JSON数据使用，不运行其脚本。

## 原生Excel公式的支持面与输出边界

| ID | 能力 | Nop真实支持面 | 本项目盘点基线 | 结论 / 验收 |
| X01 | native formula保存 / model roundtrip | `E/.../model/_gen/_ExcelCell.java:135-143`单独存formula；`E/.../util/ExcelModelHelper.java:51`copy保留；`E/src/test/.../model/TestExcelWorkbookFormulaModel.java:17-18,45-49,55-99`明确模块内不求值。 | `T/packages/report-contract/src/index.ts:5-8,74-77`单独formula；xlsx reader:102-106保存cell.f。 | 已有局部PASS：文本模型保留不等于数值求值。 |
| X02 | sheet-qualified / quoted / $地址 | `E/.../util/ExcelCellRef.java:70-107`解析`'O''Brien'!$A$1:$B$2`，`ExcelCellRefResolver.java:22-68`读已有物理值，支持括号多引用；这是图表/数据引用resolver。 | dynamic `formula.ts:35`拒绝![]#；静态formula可透传。 | GAP于native动态重定位；**不是Nop report evaluator已支持跨sheet或$语义的证明**。 |
| X03 | report evaluator识别A1 | `CellReferenceHelper.isABString:126-163`要求大写起始；没有正确的$absolute模板语义；`AbstractExcelFormulaParser`只处理单模板格/range/layer。 | native重写regex支持大小写及混合$（formula.ts:15-29,36-38）。 | 两类地址语义不同；保留native `$A$1`,`A$1`,`$A1`重写测试。 |
| X04 | 表达式运算符 | Nop ExcelFormulaParser显式支持`+ - * / = <> < <= > >=`及AND/OR中缀、双引号doubling转义；没有Excel完整operator如`^`、`&`、`%`的此处实现。 | native公式只保存/重写，任意函数text可透传；report表达式普通SPL支持更广运算。 | 不把native可透传text误标为已计算；报表所需纯运算以SPL承接。 |
| X05 | 展开后生成Excel公式 | `ReportFormulaGenerator.java:38-49`执行cellSet选择，将真实输出坐标用CellRangeMerger合并、逗号拼接；empty→`''`；member只有cellSet.value可输出，其余抛not-support；IF/逻辑重新打印Excel形式。 | `formula.ts`只根据rowOrigins/colOrigins改写A1，不能把层次filter映射为不连续ranges。 | GAP：报告值+export formula是同一selector的两个projection；不能各自另写过滤算法。 |
| X06 | 生成时点 | 展开→evaluate→removeHidden/dropRemoved→重新assign物理索引→exportFormula（`ExpandedSheetGenerator.java:152-166,251-281`）。 | current render评估与实例生成一轮；writer:167只写f，跳过v；HTML:22显示公式文字。 | GAP：报表公式同时缓存value、生成公式后写`f+v`，HTML显示value。原生未计算公式仍可声明由Excel重算。 |
| X07 | shared / array / spill / structured / external | nop-excel模型无完整求值引擎证据；本盘点不按模型存在就宣称有eval；不把外部POI潜力计入已移植范围。 | reader:103显式拒绝shared/array；dynamic公式:35拒绝external/structured/spill。 | 明确当前拒绝；未来native保真另列fixture，不影响report公式优先实现。 |
| X08 | plain native A1 copy验收 | 保留独立于report selector的能力。 | 已有`report.test.ts:41-45`：B2*$B$1展开变B2*$B$1、B3*$B$1；SUM(B2:B2)→SUM(B2:B3)。`groups.test.ts:98`二维SUM(B3:B4)、SUM(C3:C4)、SUM(D3:D4)。 | 现能力必须继续通过；不要因新增report parser覆盖这些已有native semantics。 |

## 可复用本项目原语与建议实施顺序

| ID | 本项目原语 | 可以直接复用 | 不能顺手假定的语义 |
|---|---|---|---|
| U01 | `packages/expression/src/evaluator.ts:307-326` compileExpression(source,registry,memberRegistry) | 普通Kon/SPL标量、算术、字段、集合表达式、显式scope执行与编译AST | 原parser没有cellSet的[]层次路径；call默认eager，不可仅regex替换+函数表实现lazy IF。 |
| U02 | `packages/expression/src/registry.ts:3-24` FunctionRegistryBuilder | 渲染局部register的19函数、runtime闭包函数；注册名统一lowercase。 | 不能修改全局builtins而污染SPL既有数字转换规则。 |
| U03 | `packages/expression/src/memberRegistry.ts:1-42` MemberFunctionRegistry | 增加cellSet view的get/value/first/last/sum等adapter，明确值/格两种操作。 | 默认array.count数全元素，非Report COUNT numeric-only；默认sum/avg number-coerce、空数组sum=null，不与Nop一致（235-244,297-332）。 |
| U04 | `packages/report-logic/src/axis.ts:4,74-77` AxisEntry.bindings、ExpansionItem.uid/index/anchor | 复用实例身份、同一展开路径、relative index、row/col origin maps，构建实例索引。 | 当前chain仅保存expandable ancestors，非全量rowParent/colParent；需保留普通父格关联，不能只看物理row/col。 |
| U05 | `packages/report-logic/src/scope.ts` immutableInput / datasetView / scopeFor | 保持外部输入不可变；既有分组/多源交集scope继续作为叶值表达式输入。 | 计算缓存为derived projection；不能将公式value写回caller dataset。 |
| U06 | `packages/report-xlsx-support/src/workbook.ts:163-177` / `html.ts:20-25` | 现有OOXML写入、numberFormat与HTML输出 | 当前formula分支跳过v；需分别有computed cache与uncomputed native语义，不能把formula在UI展成实现说明当报表结果。 |

建议顺序：

1. 保留compiled report来源与formula模式；先用JSON模板归一Q01/Q02/Q06（舍去Java执行配置，保留相同数据）。
2. 完整materialize实例并建`byTemplateName`、row/col parent与descendants、instance state（unvisited/visiting/done）；以U04身份为权威。
3. 做局部cellSet AST / selector；实现F01–F09和N01–N10；普通叶表达式交给U01。
4. 增加19函数局部registry与M01–M03懒分支；Q06财务数值应一次覆盖相对坐标、+0、rank/proportion、recursive累计、ACCSUM。
5. 完成全局filter e-view与Q05；再从相同选择结果生成不连续Excel ranges与f+v，不通过二次正则再解析公式。
6. 验证native X08回归、同一模板多次渲染与不同动态sheet的cache隔离；完整公式能力作为单次sheet-local derived state，不提前引入SPL长期任务治理或企业平台服务。

## DataTopology / authority边界

| node | semantic_role | authority_model | authority owner | transition entries / physical writes | relations | verdict | evidence |
|---|---|---|---|---|---|---|---|
| caller模板、datasets、params | immutable input value | caller-owned value | 调用方 | compile/read；immutableInput clone/freeze | 输入→实例→值 | clean | `T/report-contract:1`；scope.ts immutableInput；render.ts:62 |
| 单次渲染实例表、父子关系、求值state | runtime_control / derived_observation | render-local derived state | render runtime | materialize、evaluate实例；ACCSUM受控局部cache | projects from模板+input；feeds selector | GAP（基线缺公式实例层） | `T/render.ts:77-98`；源`ExpandedSheetEvaluator:109-131` |
| cellSet / computed scalar | derived_observation | recomputable projection | selector/evaluator | selector read、evaluate(cache) | selected实例→cellSet→scalar | clean目标 | `ExpandedCellSet:33-41,168-183` |
| XLSX f / v、HTML | derived_observation | export projection | codec | writeXlsxReport/reportToHtml | selected实例和值→输出，不反写输入 | GAP（基线native f无v） | `T/workbook.ts:167-172`；`html.ts:21-25` |

EventSourcedStateProfile与ReactiveDataGraphProfile：NOT_APPLICABLE；没有canonical事件重放、Signal/Stream证据，不要求为公式依赖图引入这些库。

## 最终风险与裁决

| ID | 风险 | 证据 / 处置 |
|---|---|---|
| RF09 | 注释宣称?通配，但源底层仅首/尾* | `StringHelper.java:2150-2167`；应明确选择兼容源或完整Excel wildcard，不能无说明扩大/缩小。 |
| RF10 | 全局IF宏优先级被遗漏，误用现SPL eager if会求未选分支造成循环/除零 | `GlobalFunctions.java:338-355` + `LexicalScopeAnalysis.java:721-727`；M01 / Q06必须lazy。 |
| RF11 | `+0`丢标志；CellCoordinate.appendTo仅position!=0才打印 | `CellCoordinate.java:25-37`；Q06同比靠B3:+0跨组同位置，AST不能经toString再parse。 |
| RF12 | 本项目f-only输出/HTML公式说明与Nop“已计算报表值”有明显差距 | `workbook.ts:167-172`、`html.ts:22`；补computed value与export_formula分开语义。 |

裁决：GAP（基线未实现Nop cellSet公式）。矩阵覆盖12项核心语义、19函数、7宏/对象能力、8项Excel边界、6组真实fixtures、6个可复用原语；RISK=12。源Java未实际编译/运行；已读取与交叉核对源码、Java现有断言、工作簿ZIP内容及Q05已保存HTML；数值用例标明源码推导或已有断言，不虚报执行验证。

