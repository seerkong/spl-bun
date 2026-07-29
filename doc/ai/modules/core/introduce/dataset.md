# DataSet 类

## 概述

DataSet 是 SPL 的核心数据结构，表示一个带有 schema 的行集合。

## 创建 DataSet

```typescript
import { DataSet } from "depa-data-core";

// 从行数组创建
const ds = DataSet.fromRows([
  { id: 1, name: "alice", dept: "eng" },
  { id: 2, name: "bob", dept: "sales" },
]);

// 直接构造
const ds2 = new DataSet(
  [{ name: "id", type: "number" }, { name: "name", type: "string" }],
  [{ id: 1, name: "alice" }]
);
```

## 投影 (project)

选择指定列：

```typescript
const projected = ds.project(["id", "name"]);
// 只保留 id 和 name 列
```

## 过滤 (filter/filterExpr)

```typescript
// 函数过滤
const filtered = ds.filter(row => row.dept === "eng");

// 表达式过滤
const filtered2 = ds.filterExpr("dept == 'eng'");
const filtered3 = ds.filterExpr("amount > threshold", { threshold: 100 });
```

## 计算列 (withComputedColumns)

```typescript
const computed = ds.withComputedColumns({
  gross: "amount * 1.1",
  fullName: "concat(firstName, ' ', lastName)"
});
```

## 聚合 (aggregate)

```typescript
const aggregated = ds.aggregate({
  groupBy: ["dept"],
  aggregates: {
    total: rows => rows.reduce((sum, r) => sum + r.amount, 0),
    count: rows => rows.length
  }
});
```

## 连接 (join)

```typescript
const employees = DataSet.fromRows([
  { id: 1, dept: "eng", name: "alice" },
  { id: 2, dept: "sales", name: "bob" },
]);

const departments = DataSet.fromRows([
  { dept: "eng", manager: "mike" },
  { dept: "sales", manager: "sara" },
]);

// Inner join
const joined = employees.join(departments, {
  type: "inner",
  leftKeys: ["dept"]
});

// Left join
const leftJoined = employees.join(departments, {
  type: "left",
  leftKeys: ["dept"],
  rightPrefix: "dept_"  // 重名列前缀
});
```

## 窗口函数 (window)

```typescript
const withWindow = ds.window({
  partitionBy: ["dept"],
  orderBy: [{ column: "salary", direction: "desc" }],
  outputs: {
    rowNumber: "row_no",
    rank: "rank",
    denseRank: "dense_rank",
    runningSum: { column: "salary", as: "cumulative_salary" },
    runningAvg: { column: "salary", as: "avg_salary" }
  }
});
```

## 测试用例参考

```typescript
// packages/core/__tests__/dataset.test.ts

// 过滤
const ds = DataSet.fromRows([
  { id: 1, amount: 40 },
  { id: 2, amount: 10 },
]);
const filtered = ds.filterExpr("amount > 30");
expect(filtered.rows.length).toBe(1);

// 计算列
const computed = ds.withComputedColumns({ gross: "amount * 1.1" });
expect(computed.rows[0].gross).toBeCloseTo(44);

// packages/core/__tests__/joinWindow.test.ts

// Join
const left = DataSet.fromRows([{ id: 1, val: "a" }]);
const right = DataSet.fromRows([{ id: 1, name: "x" }]);
const joined = left.join(right, { type: "inner", leftKeys: ["id"] });
expect(joined.rows[0].name).toBe("x");

// Window
const ds = DataSet.fromRows([
  { dept: "a", salary: 10 },
  { dept: "a", salary: 20 },
]);
const windowed = ds.window({
  partitionBy: ["dept"],
  orderBy: [{ column: "salary", direction: "asc" }],
  outputs: { rowNumber: "rn", runningSum: { column: "salary" } }
});
expect(windowed.rows[1].running_sum_salary).toBe(30);
```
