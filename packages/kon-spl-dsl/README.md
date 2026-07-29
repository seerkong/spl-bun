# depa-data-kon-spl-dsl

为 spl-bun 引擎提供 kunun Kon 语言内的 `spl_*` DSL：在 kunun 运行时上注册 `spl_connect / spl_query / spl_execute / spl_eval / spl_flow` 五个基础 word，以及 `spl_derive / spl_select / spl_groups / spl_sort / spl_join / spl_top / spl_window` 七个原生数据运算 word，让 Kon 脚本可以同步连接数据源、执行 SQL、透传 SPL 表达式、整体运行 FlowCell 网格脚本，并以 Conf 键结构化表达高频数据运算（kunun 仓库零改动）。

## 前置条件

本包通过正式依赖 `kunun@1.0.4` 消费 Kunun 的 parser、runtime 和类型系统根导出。在 spl-bun workspace 根目录安装依赖后即可运行：

```sh
bun test packages/kon-spl-dsl
```

`bun install` 会从 npm registry 解析依赖，不需要本机 Kunun 仓库或 TypeScript path alias。测试 helper 仅检查已声明的包是否可解析。

## 快速开始

```ts
import { RuntimeInterpreter } from "kunun";
import { EnableSplDsl, createSplContext } from "depa-data-kon-spl-dsl";

const runtime = RuntimeInterpreter.CreateRuntime();
const ctx = createSplContext({
  workspaceRoot: "/path/to/data",   // 文件型数据源与 sqlite path 的沙箱根
  scope: {},                        // 可选：spl_eval / spl_flow 的初始变量
});
EnableSplDsl(runtime, ctx);

const result = RuntimeInterpreter.EvalBlockSourceWithRuntimeSync(runtime, `
  (spl_connect #db :{ type = "sqlite" path = "orders.db" })
  (spl_query #rows :{ conn = db sql = "select * from orders" })
  rows
`);
```

## 基础五个 word 的语法

所有 word 同一书写形态：`(spl_xxx [#name] [@选项糖] :{ 普通配置 } [#opt = 选项串])`（`@选项糖` / `#opt` 仅 `spl_eval` 接受，见下文原生 word 说明）。

| word | 形态示例 | Conf 键 | 返回值 |
| --- | --- | --- | --- |
| `spl_connect` | `(spl_connect #db :{ type = "sqlite" path = "orders.db" })` | `type`（`"sqlite" \| "csv" \| "json"`）、`path`（相对 workspaceRoot，越界报错）；csv 可选 `delimiter` / `hasHeader` / `encoding`；名字取 `#name`（同时用作注册名，供 `conn =` 引用）或 `name` 键 | 数据源句柄（SyncDataSource） |
| `spl_query` | `(spl_query #orders :{ conn = db sql = "select ..." params = [1] })` | `conn`（数据源名或句柄）、`sql`（文件型数据源可省 = 全量读取；sqlite 必填）、`params?` | DataSet |
| `spl_execute` | `(spl_execute :{ conn = db sql = "delete from t where id = ?" params = [1] })` | `conn`、`sql`（必填）、`params?`；仅 sqlite 支持（文件型无 execute 通道报错） | `{ changes: 变更行数 }` |
| `spl_eval` | `(spl_eval #g :{ expr = "orders.derive({gross: 'amount*' + rate})" with = { rate = 1.1 } })` | `expr`（SPL 表达式字符串，交 `depa-data-expression` 同步求值）、`with?`（显式变量映射）；scope 依序合并：`ctx.scope ⊕ Kon 环境可见变量 ⊕ with`（后覆盖前） | 表达式值（DataSet / `{rows, schema}` / 标量等） |
| `spl_flow` | `(spl_flow #r :{ cells = [ { row = 1 col = "A" expr = "..." } ... ] })` | `cells`（FlowCell 数组：`row` 正整数 / `col` 字符串 / `expr` 字符串），经 `evaluateFlowSync` 整体执行；SplContext 中的 sqlite 数据源自动映射为网格 connections + 同步 adapter（csv/json 不进 connections，网格内用 `T()` 直接读文件） | 网格 result（`result` 命令值 → lastQuery → 最后有值的格；任一格 error 则抛错） |

`conn` 的解析顺序：SplContext 数据源注册表 → Kon 环境中绑定的句柄变量 → conn 本身已是句柄对象 → 皆无则报"未知数据源"。

## 七个原生数据运算 word 的语法

原生 word 直接调 DataSet API（不经 SPL 表达式字符串），把 SPL 的 `; :` 结构映射为 Conf 键 + map 配对，消除字符串透传的 `:alias` 与内层 scope 限制（列/谓词表达式可直接引用 `with` 与 Kon 环境变量）。

| word | 形态示例 | Conf 键 | 返回值 |
| --- | --- | --- | --- |
| `spl_derive` | `(spl_derive #priced :{ in = orders cols = {gross = "amount*rate"} with = {rate = 1.1} })` | `in`、`cols`（`{列名 = 行表达式}` map，新列不存在则追加、同名则覆盖值）、`with?` | 带新列的 DataSet |
| `spl_select` | `(spl_select #big :{ in = priced where = "gross > 150" })` | `in`、`where`（谓词表达式字符串）、`with?` | 过滤后的 DataSet（schema 不变） |
| `spl_groups` | `(spl_groups #byRegion :{ in = orders keys = [region] agg = {total = "sum(amount)" cnt = "count(id)"} })` | `in`、`keys?`（分组列名数组；空数组或缺省 = 全表单组；空输入保持零行）、`agg`（`{输出列 = "聚合函数(表达式)"}`，函数面 sum / count / avg / min / max / median，内层表达式可引用 with/env 变量如 `"sum(amount*rate)"`）、`with?` | 每组一行的 DataSet |
| `spl_sort` | `(spl_sort #s :{ in = t by = [{col = amount desc = true} "id"] })` | `in`、`by`（单列名简写 `by = "amount"`，或数组：项为列名或 `{col, desc}` map，`desc` 缺省 false 升序）；稳定排序（并列保持输入相对序） | 排序后的新 DataSet（输入不被就地修改） |
| `spl_join` | `(spl_join #j :{ left = emp right = dept type = "left" on = [dept] })` | `left` / `right`、`type?`（`"inner" \| "left"`，缺省 inner）、`on`（同名键数组）或 `leftOn` + `rightOn`（异名键，须成对且等长）、`rightPrefix?`（右表同名列前缀，缺省 `"right_"`） | 连接结果 DataSet（left join 未匹配行的右表列为 undefined） |
| `spl_top` | `(spl_top #t2 :{ in = t n = 2 by = "amount" desc = true })` | `in`、`n`（正数；超行数返回全部）、`by`（单列名）、`desc?`（缺省 false = 升序取最小 n 行，对齐 SPL `A.top(n,x)` 缺省；true 取最大 n 行） | 前 n 行 DataSet |

公共约定：

- **输入数据集**经 `in`（join 为 `left` / `right`）键给出，解析顺序：值本身是 DataSet → 直接用；字符串名（裸标识符归一）→ 查 Kon 环境绑定 → 回退 `ctx.scope` → 皆无则报错含名字。
- **表达式 scope** 合并序与 `spl_eval` 一致（`ctx.scope ⊕ Kon 环境快照 ⊕ with`），且引擎逐行求值时行字段最优先——最终优先级：行字段 > `with` > Kon 环境 > `ctx.scope`。
- **透传 vs 原生的选择**：结构化行级/集合运算（派生、过滤、分组聚合、排序、连接、topN）优先用原生 word（Conf 键自文档化、表达式直接见 with/env 变量）；需要 SPL `func@选项`、任意表达式形态或更全的引擎函数面时用 `spl_eval` 透传。

## knot 书写约定

- **普通配置一律放 `:{}`（Conf）**；不用根层级 `:tag = value` 具名槽位承载普通配置；`#key = value` 保留给系统级元数据（如 `#opt`）。
- **`#name` 省值命名结果**：如 `(spl_query #orders :{...})` —— 结果 push 到操作数栈的同时，在当前环境定义同名变量，后续 Kon 表达式与 `spl_eval` 的 `expr` 都可直接引用（`spl_connect` 的 `#name` 兼作数据源注册名）。
- **原生数据运算 word 不接受 `#opt` / `@` 糖**：其模式一律经 Conf 键表达（如 `desc = true`、`type = "left"`）；在 `spl_derive` 等原生 word 上写 `#opt = x` 或 `@x` 会报错，并提示改用 Conf 键或改走 `spl_eval` 透传——`#opt` 语义保留给透传层，避免同一记号两义。
- **SPL `func@sub` 选项写法**（作用于 `spl_eval`）：
  - `#opt = 选项串` 为权威形态（Metadata），如 `(spl_eval :{ expr = "age(a, b)" } #opt = y)` → 实际执行 `age@y(a, b)`；
  - 省值 `@x` 为单选项糖形态（Attr），可叠加多个：`@a @b` 等价 `#opt = ab`；
  - 优先级：`#opt`（Metadata）优先于 `@x`（Attr）；
  - 选项被改写进表达式**最外层函数调用**（最外层须是 call / member call，否则报错引导内联写 `func@opt(...)`）；表达式串内已含 `@选项` 且与声明相同则幂等、不同则抛冲突错。
- **Next 链合并**（parser 行为，使用者无需处理但需知晓）：同一 knot 内 Attr（`@x`）出现后再写 `:{}`，parser 会把 Conf 分裂到下一节点——本包的读取器已沿 Next 链合并 Conf / Metadata / Attr，两种书写顺序均可用。
- **Kon 注释是 `//`**（不是 `;`）；注释外的非 ASCII 字符会导致 Lexer 报错。

## 已知限制

- **成员行表达式与原生 word 可衔接**：`orders.derive(amount*rate:gross,gross+1:next)` 和旧字符串 map 都使用调用者 with/env；成员表值可直接作为后续原生 word 的 in。未适配的参数组/选项会明确报错。
- **分组/关联/分区使用类型化元组键**：保留原始键与 schema 类型；number/string、null/undefined、分隔符字符串互不混淆；字符串区分大小写，Date 按 epoch 比较，其他对象按引用身份。需要忽略大小写时显式使用 upper/lower 表达式键。
- **SPL真值与计数**：只有false/null/undefined为假，0与空串为真。`spl_groups count(expr)`、全局`count(sequence)`和成员`count(field?)`共用规则；`count()`统计记录数。`icount`按类型键去重，Date按epoch、对象按引用。字符串成员count仍返回长度。
- **聚合表达式使用AST**：`agg={ratio="sum(amount)/sum(cost)"}`支持复合标量表达式和懒IF。sum/avg/min/max/median忽略null/undefined/NaN与无效数值；目标语言延续数值字符串/布尔的显式Number转换，不等同报表Number-only规则。无有效数值返回null；全表空聚合仍一行，分组空表零行，列定义保留。
- **同批派生列顺序可见**：`cols={a="x+1" b="a+1"}`中b读取新a，覆盖已有同名列亦如此；core与member同契约。已知表schema的表达式引用未知字段会报出字段和表达式，已声明稀疏字段合法，行字段优先于外部scope。普通自由表达式scope保持原有缺失读取行为。
- **文件导入类型一致**：CSV/JSON的同步Kon与异步flow使用同一解析和临时SQL适配；001保留文本，普通数字保留数值，JSON后行新增列不丢，空查询保留表头。JSON嵌套对象经SQL时为JSON文本；无列空文件不能建立SQL表并给出明确诊断。
- **`with` 的 map 值不能引用 Kon 变量**：Conf map 值中的裸标识符归一为字符串字面量（`with = {rate = rate}` 得到 `"rate"` 字符串而非变量取值）。要把 Kon 变量传进表达式，直接依赖 scope 合并（`#name` 绑定后自动可见），或经 `createSplContext({scope})` 注入。
- **全同步执行**：kunun 解释器为同步 dispatch，async 数据源不可接（`spl_flow` 底层的 `evaluateFlowSync` 遇真异步 adapter 会抛 `FlowAsyncValueError`）——需要 async 数据源请直接在 TS 侧使用 `depa-data-spl-flow` 的 `evaluateFlow`。

## 示例

完整示例见 [`examples/basic.kon`](./examples/basic.kon)：`spl_connect → spl_query → spl_eval 选项糖（age@y）→ Kon if 控制流 → spl_derive/spl_select 原生运算（含透传写法对照注释）→ spl_groups 分组聚合 → 命名结果输出`。对应的端到端一致性测试（与等价 FlowCell 网格脚本结果逐位对齐，groups 结果另与手工计算对照）见 `__tests__/e2e.test.ts`。

## 注意事项（kunun 扩展点用法）

- 展开器回值必须用 `rt.addOpDirectly(RuntimeOpCode.PushValue, v)`，opcode 必须用枚举（字符串会报 `Instruction handler not found`）。
- 展开器签名 `(runtime, { knot, sourceNodeId }) => void`；`#tag` 省值落在 `knot.Name`（取 `.Value`）。
- 本包同时支持 Bun 源码直跑和严格 TypeScript build；构建只消费 `kunun@1.0.4` 发布的声明文件，并已纳入 workspace 根 build 链。

## 原生窗口与上传数据

`runSplKon(source, { tables: { input: { columns: ["dept", "amount", "cost"], rows: [{dept: "E", amount: 10, cost: 4}] } } })` 将上传快照克隆为本次运行的命名 DataSet；可直接用 `in = input`，空表仍保留列定义。与 scope 同名的表绑定会报冲突。

```kon
(spl_window #ranked :{ in = input partitionBy = [dept]
  by = [{col = amount desc = true}]
  outputs = {rowNumber = rn rank = r denseRank = dr
    runningSum = {column = amount as = cumulative_amount}
    runningAvg = {column = cost as = cumulative_cost_avg}} })
ranked
```

`by` 复用 spl_sort 语法；也可使用 `orderBy = [{column = amount direction = desc}]`。`partitionBy` 可省略；`outputs` 支持上面五种指标。累计指标可带 `expression`，其变量通过 `with`、Kon env、初始 scope 注入，行字段优先。不同列/表达式的 sum、avg 独立计算。重复输出别名、未知字段和未支持指标报错；同名覆盖已有列时 schema 保持唯一。每次执行独立，不保留前次绑定。lag/lead、任意滑动 frame 与完整 SPL 窗口函数族仍在后续范围。

## 表转换与关联

```kon
(spl_pivot #wide :{in=input keys=[customer] category=month value=amount reducer=sum})
(spl_unpivot :{in=wide keys=[customer] columns=[Jan Feb]})
(spl_join :{left=orders right=customers on=[id] type=full})
(spl_rename :{in=input mapping={amount=total}})
(spl_alter :{in=input columns=[{name=amount type=number} {name=status type=string defaultValue="new"}]})
(spl_group_rows :{in=input keys=[customer] adjacent=true})
(spl_groupc :{in=input keys=[customer] values=[month amount]})
(spl_groupi :{in=input columns=[customer month product]})
```

这些word与DataSet同名方法、表达式成员共用纯表值处理器。pivot的列按类别首次遇到顺序；可用`columns=[{value="Jan" as=January}]`显式映射。类别/分组键保留类型，1与"1"不会合并；若自动生成的列名碰撞会报错，需明确不同别名。默认重复格报错；reducer支持sum/count/icount/avg/min/max/median/first/last。无值格为null，空输入可以用显式columns保留表头。unpivot默认跳过null，`includeNulls=true`保留空格。

join支持inner/left/right/full/semi/anti，保留重复匹配的笛卡尔数量；semi/anti只出左表。null与missing分开且各自可匹配，这是类型键契约；需要SQL null不匹配时先显式过滤。inner/left/full按左方遇到顺序，full最后追加右孤儿，right按右方顺序。缺侧字段为undefined，schema完整，右侧重名列加rightPrefix，二次碰撞报错。

rename/alter返回新表；alter按列声明投影、添加默认值和显式转换（unknown/string/number/boolean/date），坏转换报错。原记录不反写。`spl_index #idx :{in=input keys=[id] unique=true}`产生只读浅快照索引，`spl_eval`可用`idx.lookup([1])`取得只读record数组；需要表外观可接`.select("true")`。Date键按epoch，对象键按引用；没有外键持久索引或服务容器。

`group_rows`输出每组的key和rows数组；adjacent=true只合并相邻同键。`groupc`按完整key分组，把组内values列依次铺成`month_1/amount_1/month_2/amount_2`等列，`as`可明确指定全部列名；`ungroupc`显式给`blocks=[[month_1 amount_1] [month_2 amount_2]]`和`values=[month amount]`反转，默认保留null块，可设includeNulls=false。`groupi`按dimensions排序后生成嵌套维值数组；ordered=true信任现有顺序并按相邻段解释。它们是Java对应业务语义的目标spec适配，不解析原Java参数/option糖。

真实游标与流式CSV/SQLite通过异步host或`evaluateFlow`使用，同步Kon会在消耗游标前明确拒绝。`file().import/export`提供真实工作区IO；生命周期、原子写入和示例见[Flow说明](../spl-flow/README.md)。SPL序列的`&/^/\\/|`分别为并/交/差/连列，保留配对重复数量；named成员union/isect/diff/conj处理序列的序列，global union另按多参distinct处理。数值/日期与来源缺陷适配见[最终SPL矩阵](../../.depa-analysis/report-parity-2026-10-22/spl-acceptance-matrix.md)。

窗口现由共享纯处理器执行，新增 lag/lead 列表与 frames ROWS 配置；null 不计入平均分母，long/decimal 累计不降精度。Kon Conf 的 null/Unknown 归一为 JS null。详见 [expression 协议](../expression/README.md)。
