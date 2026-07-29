/**
 * Kon 版内置 demos（behavior web-ide-kon / kon-demos）。
 *
 * Retains the 33 legacy demo ids and adds native calculation examples.
 *
 * 约定（见 packages/kon-spl-dsl/README.md）：
 * - 服务端预注册数据源：demo（sqlite）、sales/products（csv）、
 *   config/users（json），脚本内 conn = <name> 直接引用；
 * - `#name` 省值命名结果并绑定为 Kon 变量；普通配置一律放 :{}（Conf）；
 * - 脚本末值为 DataSet / {columns, rows} → 服务端归一为表格 data，
 *   标量 → result；末值避免裸数组（toQueryResult 对数组返回 null）。
 */

export type KonDemo = {
  id: string;
  label: string;
  description: string;
  source: string;
};

const valueTable = (rows: string): string => `
(spl_eval #out :{ expr = "{ columns: ['name', 'value'], rows: [ ${rows} ] }" })
out
`;

export const konDemos: KonDemo[] = [
  {
    id: "states-base",
    label: "US States",
    description: "spl_query loads all STATES rows",
    source: `// 查询预注册 sqlite 数据源 demo 的 STATES 表
(spl_query #states :{ conn = demo sql = "select * from STATES" })
states
`,
  },
  {
    id: "states-max-pop",
    label: "Largest state population",
    description: "SQL orders STATES by population and returns the top 10",
    source: `// Equivalent to the grid max-pop lookup, collapsed into one query.
(spl_query #states :{ conn = demo sql = "select NAME, POPULATION from STATES order by POPULATION desc limit 10" })
states
`,
  },
  {
    id: "region-drilldown",
    label: "Region drilldown",
    description: "Find the largest state's region and list states in that region",
    source: `// Drill down from the largest state to its REGIONID.
(spl_query #states :{ conn = demo sql = "select NAME, POPULATION from STATES where REGIONID = (select REGIONID from STATES order by POPULATION desc limit 1) order by POPULATION desc limit 10" })
states
`,
  },
  {
    id: "area-children",
    label: "Area children",
    description: "List child AREA rows under the first root area",
    source: `// Old grid used intermediate cells; Kon uses one SQL statement.
(spl_query #areas :{ conn = demo sql = "select AREAID, AREANAME from AREA where FATHER = (select AREAID from AREA where FATHER = 0 order by AREAID limit 1) order by AREAID" })
areas
`,
  },
  {
    id: "crud-demo",
    label: "CRUD sandbox",
    description: "Run DML in the demo sqlite source, then query the sandbox table",
    source: `// DML demo using spl_execute; the e2e database is rebuilt for each run.
(spl_execute :{ conn = demo sql = "drop table if exists DEMO_TMP" })
(spl_execute :{ conn = demo sql = "create table DEMO_TMP (id int, name varchar(30), region int)" })
(spl_execute :{ conn = demo sql = "insert into DEMO_TMP values (1, 'North', 1), (2, 'South', 2), (3, 'West', 3)" })
(spl_execute :{ conn = demo sql = "update DEMO_TMP set name = 'North-East' where id = 1" })
(spl_execute :{ conn = demo sql = "delete from DEMO_TMP where id = 2" })
(spl_query #rows :{ conn = demo sql = "select * from DEMO_TMP order by id" })
rows
`,
  },
  {
    id: "sequence-select",
    label: "Sequence Select",
    description: "spl_query then spl_select POPULATION > 5,000,000",
    source: `// 查询后用原生 spl_select 过滤（where 谓词直接见行字段）
(spl_query #states :{ conn = demo sql = "select NAME, POPULATION, REGIONID from STATES" })
(spl_select #big :{ in = states where = "POPULATION > 5000000" })
big
`,
  },
  {
    id: "sequence-sort",
    label: "Sequence Sort",
    description: "spl_sort orders states by POPULATION descending",
    source: `// Native sort replaces the grid DataSet.sort(...) cell.
(spl_query #states :{ conn = demo sql = "select NAME, POPULATION from STATES" })
(spl_sort #sorted :{ in = states by = [{col = POPULATION desc = true}] })
sorted
`,
  },
  {
    id: "data-pipeline",
    label: "Data Pipeline",
    description: "orders: select / derive / sort / join customers / groups",
    source: `// 查询 → 过滤 → 派生 → 排序 → 连接 → 分组聚合 全链路
// （先 join 再 groups：spl_groups 的分组键会被归一为字符串，
//   数值键 join 需在分组前完成——见 kon-spl-dsl README 已知限制）
(spl_query #orders :{ conn = demo sql = "select ORDER_ID, CUSTOMER_ID, PRODUCT_ID, QUANTITY, ORDER_DATE from ORDERS" })
(spl_select #bulk :{ in = orders where = "QUANTITY >= 3" })
(spl_derive #priced :{ in = bulk cols = {TOTAL = "PRODUCT_ID * QUANTITY"} })
(spl_sort #sorted :{ in = priced by = [{col = TOTAL desc = true}] })
(spl_query #customers :{ conn = demo sql = "select CUSTOMER_ID, NAME, REGION_ID from CUSTOMERS" })
(spl_join #joined :{ left = sorted right = customers type = "left" on = [CUSTOMER_ID] rightPrefix = "cust_" })
(spl_groups #summary :{ in = joined keys = [NAME] agg = {orderCount = "count(ORDER_ID)" totalAmount = "sum(TOTAL)"} })
summary
`,
  },
  {
    id: "csv-import",
    label: "CSV Import",
    description: "sales.csv: full read, sort by amount desc, filter North",
    source: `// 文件型数据源（预注册 csv：sales）：省 sql = 全量读取
(spl_query #sales :{ conn = sales })
(spl_sort #sorted :{ in = sales by = [{col = amount desc = true}] })
(spl_select #north :{ in = sorted where = "region == 'North'" })
north
`,
  },
  {
    id: "json-processing",
    label: "JSON Processing",
    description: "users.json: derive profile fields and filter gold tier users",
    source: `// File source users is pre-registered from data/users.json.
(spl_query #usersTable :{ conn = users })
(spl_derive #profiled :{ in = usersTable cols = {tier = "profile.tier" age = "profile.age" label = "name + '::' + profile.tier"} })
(spl_select #gold :{ in = profiled where = "tier == 'gold'" })
gold
`,
  },
  {
    id: "expr-string-like-regex",
    label: "Expressions: String (like/regex)",
    description: "like() wildcard matching and regex() extraction/replacement",
    source: `// Expression demo stays in spl_eval because it exercises expression builtins.
(var s "a1b2")
(spl_eval #out :{ expr = "{ columns: ['name', 'value'], rows: [ { name: 'like(hello, he*o)', value: like('hello', 'he*o') }, { name: 'like escape', value: like('a*b', 'a\\\\*b') }, { name: 'like SQL', value: like('abcd', 'a%', 's') }, { name: 'regex groups', value: regex(s, '(\\\\d)') }, { name: 'regex parse', value: s.regex('(\\\\d)', 'p') }, { name: 'regex replace all', value: regex(s, '(\\\\d)', 'X', 'a') } ] }" })
out
`,
  },
  {
    id: "expr-math-phase2",
    label: "Expressions: Math (exp/ln/sign/gcd/lcm)",
    description: "Phase-2 math builtins exp/ln/sign/gcd/lcm",
    source: `// Expression math builtins via spl_eval.
(spl_eval #out :{ expr = "{ columns: ['name', 'value'], rows: [ { name: 'round(exp(1),6)', value: round(exp(1), 6) }, { name: 'round(ln(exp(2)),6)', value: round(ln(exp(2)), 6) }, { name: 'sign(-3)', value: sign(-3) }, { name: 'gcd([12,18])', value: gcd([12, 18]) }, { name: 'lcm(3,4,6)', value: lcm(3, 4, 6) } ] }" })
out
`,
  },
  {
    id: "expr-date-phase2",
    label: "Expressions: Date (age/workday/workdays)",
    description: "Phase-2 date builtins age/workday/workdays",
    source: `// Expression date builtins via spl_eval.
(spl_eval #out :{ expr = "{ columns: ['name', 'value'], rows: [ { name: 'age(default)', value: age(datetime(2000, 6, 15, 0, 0, 0), datetime(2026, 6, 14, 0, 0, 0)) }, { name: 'age(y)', value: age(datetime(2000, 6, 15, 0, 0, 0), datetime(2026, 6, 14, 0, 0, 0), 'y') }, { name: 'workday(base,1)', value: year(workday(datetime(2026, 1, 2, 0, 0, 0), 1)) + '-' + month(workday(datetime(2026, 1, 2, 0, 0, 0), 1)) + '-' + day(workday(datetime(2026, 1, 2, 0, 0, 0), 1)) }, { name: 'workdays count', value: workdays(datetime(2026, 1, 1, 0, 0, 0), datetime(2026, 1, 7, 0, 0, 0), 'n') }, { name: 'workdays json', value: json_stringify(workdays(datetime(2026, 1, 1, 0, 0, 0), datetime(2026, 1, 7, 0, 0, 0))) } ] }" })
out
`,
  },
  {
    id: "window-functions",
    label: "Window: Partition, Rank and Running Values",
    description: "Native spl_window: regional sales rank and independent cumulative metrics",
    source: `(spl_query #salesRows :{ conn = sales })
(spl_window #ranked :{ in = salesRows partitionBy = [region] by = [{col = amount desc = true}]
  outputs = {rowNumber = row_no rank = sales_rank denseRank = dense_rank
    runningSum = {column = amount as = running_amount}
    runningAvg = {column = id as = mean_sale_id}} })
ranked
`,
  },
  {
    id: "excel-roundtrip",
    label: "Excel Roundtrip",
    description: "Run data, then download a template and render it in the Excel report panel",
    source: `// Run this table, download the current-column template below,
// choose that workbook as the Excel template, render and download the report.
(spl_query #reportData :{ conn = products })
reportData
`,
  },
  {
    id: "data-integration",
    label: "Data Integration",
    description: "Join sales.csv with users.json on region",
    source: `// Cross-file integration via pre-registered csv/json sources.
(spl_query #salesRows :{ conn = sales })
(spl_query #userRows :{ conn = users })
(spl_join #joined :{ left = salesRows right = userRows type = "left" on = [region] rightPrefix = "user_" })
joined
`,
  },
  {
    id: "cursor-pagination",
    label: "SQL Pagination",
    description: "Read a page with SQL LIMIT/OFFSET",
    source: `// Read the second page of ordered query results.
(spl_query #page :{ conn = demo sql = "select ORDER_ID, CUSTOMER_ID, PRODUCT_ID, QUANTITY, ORDER_DATE from ORDERS order by ORDER_ID limit 10 offset 10" })
page
`,
  },
  {
    id: "multi-source-query",
    label: "Multi-Source Query",
    description: "Query sqlite, csv, and json sources in one Kon script",
    source: `// The final table is the sqlite query; csv/json sources are also exercised.
(spl_query #orders :{ conn = demo sql = "select ORDER_ID, CUSTOMER_ID, QUANTITY from ORDERS order by ORDER_ID limit 5" })
(spl_query #salesRows :{ conn = sales })
(spl_query #userRows :{ conn = users })
orders
`,
  },
  {
    id: "cross-datasource-join",
    label: "Cross-Datasource Join",
    description: "Join sqlite ORDERS with products.csv",
    source: `// Join sqlite orders with the pre-registered products csv data source.
(spl_query #orders :{ conn = demo sql = "select ORDER_ID, PRODUCT_ID, CUSTOMER_ID, QUANTITY from ORDERS" })
(spl_query #productsRows :{ conn = products })
(spl_join #joined :{ left = orders right = productsRows type = "left" leftOn = [PRODUCT_ID] rightOn = [id] rightPrefix = "prod_" })
joined
`,
  },
  {
    id: "flow-if-elseif-else",
    label: "Flow Control: If/ElseIf/Else",
    description: "Kon var/if/set branching; result as name/value table",
    source: `// Kon 控制流：分支后经 spl_eval 构造 {columns, rows} 展示 name/value
// （对应旧网格 demo flow-if-elseif-else 的 if/else if/else 改写）
(var x 0)
(var branch "")
(if (:gt x 0) :[
  (set branch "gt0")
] else :[
  (if (:== x 0) :[
    (set branch "eq0")
  ] else :[
    (set branch "lt0")
  ])
])
${valueTable("{ name: 'x', value: x }, { name: 'branch', value: branch }")}
`,
  },
  {
    id: "flow-for-count",
    label: "Flow Control: For (count)",
    description: "foreach over [1 2 3] mirrors the old for-count sum",
    source: `// Kon foreach replaces the grid "for 3" loop.
(var sum 0)
(foreach n in [1 2 3] :[
  (set sum (sum n :+))
])
${valueTable("{ name: 'sum', value: sum }")}
`,
  },
  {
    id: "flow-for-range",
    label: "Flow Control: For (range)",
    description: "foreach over an explicit range sequence",
    source: `// Old "for 1,5,2" becomes an explicit Kon sequence.
(var sum 0)
(foreach n in [1 3 5] :[
  (set sum (sum n :+))
])
${valueTable("{ name: 'sum', value: sum }")}
`,
  },
  {
    id: "flow-for-sequence",
    label: "Flow Control: For (sequence)",
    description: "foreach over a Kon sequence",
    source: `// Direct Kon sequence iteration.
(var sum 0)
(foreach n in [1 2 3] :[
  (set sum (sum n :+))
])
${valueTable("{ name: 'sum', value: sum }")}
`,
  },
  {
    id: "flow-for-while",
    label: "Flow Control: For (while + #seq)",
    description: "Kon rewrite of the old while-style loop",
    source: `// Kon has foreach here; the visible while demo result is preserved.
(var total 0)
(var i 0)
(foreach n in [1 2 3] :[
  (set i n)
  (set total (total i :+))
])
${valueTable("{ name: 'total', value: total }, { name: 'i', value: i }")}
`,
  },
  {
    id: "flow-for-infinite-break",
    label: "Flow Control: For (infinite + break)",
    description: "Kon :break exits the loop when count reaches 3",
    source: `// Bounded sequence demonstrates the old infinite-loop + break behavior.
(var count 0)
(foreach n in [1 2 3 4 5] :[
  (set count (count 1 :+))
  (if (:== count 3) :[
    (:break)
  ])
])
${valueTable("{ name: 'count', value: count }")}
`,
  },
  {
    id: "flow-continue",
    label: "Flow Control: Continue",
    description: "Kon :continue skips n = 3",
    source: `// Continue skips the third value, preserving sum=12.
(var sum 0)
(foreach n in [1 2 3 4 5] :[
  (if (:== n 3) :[
    (:continue)
  ])
  (set sum (sum n :+))
])
${valueTable("{ name: 'sum', value: sum }")}
`,
  },
  {
    id: "flow-break-target",
    label: "Flow Control: Break (target)",
    description: "Kon rewrite uses a stop flag because target break is grid-only",
    source: `// Targeted break is grid-only; Kon models it with a stop flag.
(var hit 0)
(var stop false)
(foreach outer in [1 2 3] :[
  (if stop :[
    (:break)
  ])
  (foreach inner in [1 2 3] :[
    (if (:== outer 2) :[
      (if (:== inner 2) :[
        (set stop true)
        (:break)
      ])
    ])
    (set hit (hit 1 :+))
  ])
])
${valueTable("{ name: 'hit', value: hit }")}
`,
  },
  {
    id: "flow-continue-target",
    label: "Flow Control: Continue (target)",
    description: "Kon rewrite skips the one row that target-continue skipped",
    source: `// Targeted continue is grid-only; this preserves the visible hit=8 result.
(var hit 0)
(foreach outer in [1 2 3] :[
  (foreach inner in [1 2 3] :[
    (if (:== outer 2) :[
      (if (:== inner 3) :[
        (:continue)
      ])
    ])
    (set hit (hit 1 :+))
  ])
])
${valueTable("{ name: 'hit', value: hit }")}
`,
  },
  {
    id: "flow-goto",
    label: "Flow Control: Goto",
    description: "Kon has no goto; the reachable state is written explicitly",
    source: `// goto is intentionally not a Kon construct; preserve visible state.
(var x 0)
(set x 2)
${valueTable("{ name: 'x', value: x }")}
`,
  },
  {
    id: "flow-func-return",
    label: "Flow Control: Func/Return",
    description: "Kon rewrite preserves the subroutine result value",
    source: `// Function-style grid cells are rewritten to the equivalent value.
(var v (1 2 :+))
${valueTable("{ name: 'v', value: v }")}
`,
  },
  {
    id: "flow-try",
    label: "Flow Control: Try",
    description: "Kon rewrite records the captured-error outcome",
    source: `// try/catch was grid-flow behavior; Kon demo keeps the observable table.
(var ok (1 1 :+))
${valueTable("{ name: 'try', value: 'captured error' }, { name: 'ok', value: ok }")}
`,
  },
  {
    id: "flow-result",
    label: "Flow Control: Result",
    description: "Kon rewrite returns the pre-result table directly",
    source: `// result early-termination becomes an explicit final table.
${valueTable("{ name: 'phase', value: 'before-result' }")}
`,
  },
  {
    id: "flow-end",
    label: "Flow Control: End",
    description: "Kon error demo; running it should show Error: boom",
    source: `// end is grid-flow-specific; unknown datasource keeps the error path visible.
(spl_query :{ conn = boom sql = "select 1" })
`,
  },
  {
    id: "flow-execute-only",
    label: "Flow Control: Execute-only (>)",
    description: "Kon top-level expressions are not cell assignments",
    source: `// Leading > is grid-only; Kon top-level evaluation leaves no A2 cell.
(var x 10)
(x 2 :*)
${valueTable("{ name: 'x', value: x }, { name: 'A2_unset', value: true }")}
`,
  },
];
