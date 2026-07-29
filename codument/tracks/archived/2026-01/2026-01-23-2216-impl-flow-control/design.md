## 上下文

现状（TypeScript）：
- `packages/spl-flow/src/index.ts` 的 `evaluateFlow()` 采用“排序后线性遍历”的方式执行单元格。
- 单元格内容统一当作 expression 交给 `depa-data-expression` 求值。
- 没有：命令单元格（if/for/...）识别、缩进块边界、执行栈、跳转/循环/函数。

目标（对齐 Java SPL）：
- 复刻 Java `PgmCellSet` 的核心机制：网格定位、`setNext` 导航、块边界计算、执行栈（for/try 等）。
- 让 flow-control 作为脚本层能力落在 `spl-flow`。

约束：
- Web-IDE 输入默认不带 `=` 前缀。
- 本 track 不做 fork/reduce/channel。

## 方案概览

1. 解析层：从 FlowCell[] 构建“可执行网格”
- 输入：`FlowCell[]`（row + col + expr）。
- 标准化：
  - col 统一大写（A/B/C...）。
  - cellRef = `${col}${row}`。
- 构建矩阵/索引：
  - `Map<cellRef, Cell>` + 便于 row/col 遍历的结构。
- Cell 分类（TypeScript 兼容策略）：
  - 默认：表达式格（无需 `=`）。
  - 如果以关键词开头：命令格（if/for/func/...）。
  - 兼容 Java 前缀：`=`/`>`（可选支持）。
  - 注释格：仅当单元格 trim 后以 `//` 开头才视为注释格；并且该注释格右侧同一行的所有单元格都将被忽略（等价于行内注释）。
  - 行约束：除注释格外，每一行（row）最多允许出现一个“有值且可执行”的单元格（command/expression）；否则应报错（便于 AST 与结构化语言同构）。

2. 执行层：PgmCellSet-like 执行引擎
- 维护运行时状态：
  - `cur`（当前行列位置）
  - `stack`（for/try 等结构的执行栈帧）
  - `scope`（变量 + cellRef 值）
  - `result`（result/end 的终态输出）
- 关键算法：
  - `getCodeBlockEndRow(row, col)`：按“同列或更左出现非空即结束”确定块边界。
  - `setNext(row, col, checkStack)`：按 Java 逻辑跳过空白/注释/常数格，并在换行时触发栈检查（for 回跳、try 出栈等）。

3. 语句执行：最小语义子集对齐 Java
- if / elseif / else
  - if 条件为真：进入其缩进块。
  - 条件为假：寻找对应 elseif/else 分支（后续同列）。
  - else/elseif 在“非跳转进入”的情况下应当跳过其块。
- for
  - 统一用 `ForFrame` 表示循环：存储 (row,col,endRow, iterator/seq)
  - 每次迭代更新 `scope[forCellRef]` 为当前值
  - 支持 `#<cellRef>` 在表达式中读取对应循环的序号（1-based）
- break / continue
  - 无参数：作用于最近一层循环
  - 带参数：根据 cellRef 定位外层循环
- goto
  - `goto <cellRef>` 跳转
  - 安全约束：禁止跳入更深缩进块/循环内部
- func / return / result / end
  - func 表示子程序（master cell + 缩进块）；子程序不会在顶层顺序执行时自动运行
  - 子程序调用使用 expression 函数：`func(<masterCell>, x1, x2, ...)`（Java SPL 语义）
    - 需要在 `packages/expression` 对 `func(...)` 做特殊处理：第一个参数如果是形如 `A1` 的 cellRef，应作为 cellRef 传递，而不是取 `scope.A1` 的值
    - 调用时把参数从 master cell 开始按列写入（x1→master cell, x2→右侧同一行下一格...），然后执行该块，直到 return 或块结束
    - 若块内未执行 return，则返回该块内最后一个表达式格的值（若不存在则返回 null）
  - return 只在子程序调用栈中生效（返回到调用点）
  - result 终止整个 flow 执行并返回指定值
  - end 终止执行（可带错误信息）
- try
  - try 压栈；执行块内出现异常时捕获，写入 try cell 值，然后跳到块后继续

## 影响范围与修改点（Impact）
- `packages/spl-flow/src/index.ts`：
  - `buildFlowAst` / `evaluateFlow` 将不再是简单线性 loop，需要引入 grid + navigation + command dispatch。
- 可能新增：
  - `packages/spl-flow/src/flow/*`（解析/模型/执行拆分，避免 index.ts 继续膨胀）。
- 可选（仅当必要）：
  - `packages/expression/src/parser.ts`（如果需要支持 Java 级别的表达式语法符号，例如 `#A1` 等）。

## 决策
- 决策：采用“完整网格模型”而非“单列脚本缩进/括号块”模式。
- 原因：SPL 的 if/for/func/try 语义与块边界强依赖“缩进列”，同时 break/continue 的目标定位也依赖 cellRef。

## 风险 / 权衡
- 风险：Web-IDE 当前仅采集 A 列，短期内无法在 UI 侧直接编写多列缩进块。
  - 缓解：先在 `spl-flow` 通过单元测试覆盖多列语义；UI 后续再逐步扩展采集范围。
- 风险：flow 引擎需要 async 支持（现有 evaluateFlow 已支持 Promise）。
  - 缓解：执行引擎的每一步对 expression 求值都使用 `await` 统一处理。

## 兼容性设计
- 兼容现有 demo：默认表达式格无需 `=` 前缀，保持现有行为。
- 兼容 Java 示例：表达式格允许可选前缀 `=` 或 `>`（解析时剥离前缀再求值）。本 track 内不区分“可计算/可执行”的写回行为：表达式格一律写入 `scope[cellRef]`。
- 注释格：仅 `//` 开头的单元格视为注释；并且该注释格右侧同一行内容将被忽略（行内注释）。

## 迁移计划
- 先引入执行引擎（保持“没有命令关键字时等价于原线性执行”）。
- 再逐步加入 if/for/break/continue/goto/func/return/result/end/try。

## 待解决问题
- `result` 是否需要与 `web-server` 的返回值（目前基于 lastQuery）做强绑定？建议：新增 flow-level returnValue，并在 server 侧优先返回它。
  - 结论：在本 track 内实现，并在 `evaluateFlow` 返回值中暴露该 result。
