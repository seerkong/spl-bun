# SPL Bun workspace

This workspace hosts a TypeScript reimplementation of the esProc core engine with an initial SQLite adapter. Bun is required.

## Web 表格与 Excel 模板报表

网页可导入 CSV/TSV、JSON、XLSX/XLS，导入快照绑定为 Kon 的 `input`：

```kon
(spl_derive :{ in = input cols = {amount = "qty * 10"} })
```

运行后，在“Excel 模板报表”下载当前列模板，使用 Excel 编辑标题、格式、合并格或批注，再选择该模板并渲染。预览与下载来自同一结果；修改源码、数据、模板或参数会使旧报表失效。当前计算结果名为 `result`，原始导入数据名为 `input`。

原生 `spl_window` 现可做分区、稳定排序、rowNumber/rank/denseRank 和独立的累计 sum/avg；IDE 的 Window 示例可直接运行。分组、关联、分区使用保留类型的元组键，字符串按大小写区分，日期按 epoch 比较，不再靠分隔符拼接。语法见 [Kon DSL](packages/kon-spl-dsl/README.md#原生窗口与上传数据)。

模板支持记录行、多行区域、分组、父格与交叉表，保留原 XLSX 样式文件、主题、尺寸和合并。语法、程序化示例、公式重算策略与支持边界见 [报表说明](packages/report-logic/README.md)。CSV 支持引号、转义、多行和 BOM；`001` 等标识字符串保留，普通有限数值转为 number。JSON 合并各行字段，保留后续列。

服务端使用独立 worker，默认执行时限10秒（`SPL_EXECUTION_TIMEOUT_MS`，最多60秒）；数据文件5MiB、模板10MiB，布局默认100,000格。超时/取消结束当前 worker。导入与产物按请求返回。

开发运行：`bun run --filter depa-data-web-server dev` 与 `bun run --filter depa-data-web-ide dev`。回归：`bun test`、`bun run build`、`bun run test:e2e`；E2E使用独立4294/4296端口，可通过 `SPL_E2E_FRONTEND_PORT` / `SPL_E2E_BACKEND_PORT` 覆盖。

HTTP：`POST /api/import-table`（multipart `file`、可选 `sheet`）；`POST /api/execute-kon`（JSON `source`、可选 `scope` / `tables`）；`GET /api/report-template?columns=[...]`；`POST /api/render-report`（multipart `template`、JSON文本 `datasets` / `params`，返回 HTML、XLSX base64 和 sheet 尺寸）。

来源盘点、本批成果与剩余缺口见 [移植交付记录](.depa-analysis/porting-2026-10-22/report/delivery-2026-10-22.md)，执行证据见 [.cdmt-lite](.cdmt-lite/README.md)。旧 codument 保留为历史。

## Setup
- Install Bun (https://bun.sh)
- Install deps: `bun install`

## Scripts
- `bun test` — run all workspace tests (core + sqlite adapter + fixtures)
- `bun run test:e2e` — run Playwright E2E tests
- `bun run build` — build all packages

Notes: TypeScript only; linting is deferred for v1. Naming and directory structure aim to stay close to the original esProc sources where practical.


## Features
- Core dataset ops: projection, filter, aggregate, join (inner/left), window functions (row_number/rank/dense_rank/running_sum/running_avg)
- Expression engine: parse/evaluate esProc-style expressions (math/string/datetime/collection functions) for filters, computed columns, join/window parameters
- SQLite adapter for loading datasets; joins/windows run in-memory


## Examples

### Join datasets
```ts
import { DataSet } from "depa-data-core";

const employees = DataSet.fromRows([
  { id: 1, dept: "eng", name: "alice" },
  { id: 2, dept: "sales", name: "bob" },
]);
const departments = DataSet.fromRows([
  { dept: "eng", manager: "mike" },
  { dept: "sales", manager: "sara" },
]);

const joined = employees.join(departments, { type: "left", leftKeys: ["dept"] });
// joined rows include manager; missing matches are null/undefined
```

### Window functions
```ts
import { DataSet } from "depa-data-core";

const ds = DataSet.fromRows([
  { dept: "eng", salary: 10 },
  { dept: "eng", salary: 20 },
  { dept: "sales", salary: 15 },
]);

const withWindow = ds.window({
  partitionBy: ["dept"],
  orderBy: [{ column: "salary", direction: "desc" }],
  outputs: {
    rowNumber: "row_no",
    rank: "rank",
    runningSum: { column: "salary" },
  },
});
// withWindow rows now include row_no, rank, running_sum_salary
```

### Expression filters & computed columns
```ts
import { DataSet } from "depa-data-core";

const ds = DataSet.fromRows([
  { id: 1, amount: 40, status: "open" },
  { id: 2, amount: 10, status: "closed" },
]);

const computed = ds.withComputedColumns({ gross: "amount * 1.1" });
const filtered = computed.filterExpr("gross > 30 and status = \"open\"");
// filtered rows contain only id 1
```

### Step orchestration
```ts
import { Engine, createComputeStep, createFilterStep, createJoinStep, createWindowStep } from "depa-data-core";
import { createSqliteStep } from "depa-data-sqlite-adapter";

const loadItems = createSqliteStep("items", { dbPath: "./sample.db", sql: "SELECT id, dept, price FROM items" });
const loadDepts = createSqliteStep("depts", { dbPath: "./sample.db", sql: "SELECT dept, manager FROM departments" });
const joinStep = createJoinStep("joined", { type: "inner", leftKeys: ["dept"], leftStep: "items", rightStep: "depts" });
const computeStep = createComputeStep("with_gross", { sourceStep: "joined", columns: { gross: "price * 1.1" } });
const windowStep = createWindowStep("ranked", {
  sourceStep: "with_gross",
  spec: {
    partitionBy: ["dept"],
    orderBy: [{ column: "price", direction: "desc" }],
    outputs: { rowNumber: "row_no", runningSum: { column: "price", expression: "gross" } },
  },
});
const filterStep = createFilterStep("filtered", {
  sourceStep: "ranked",
  expression: "gross > 30",
});

const engine = new Engine();
await engine.run([loadItems, loadDepts, joinStep, computeStep, windowStep, filterStep]);
```
