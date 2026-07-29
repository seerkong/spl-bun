# 数据源系统

## 概述

spl-flow 支持多种数据源，包括 SQLite 数据库、CSV 文件、JSON 文件和 Excel 文件。

## 数据源配置

### 类型定义

```typescript
type DataSourceConfig = SqliteConfig | CsvConfig | JsonConfig;

interface SqliteConfig {
  type: "sqlite";
  name: string;
  path: string;
}

interface CsvConfig {
  type: "csv";
  name: string;
  path: string;
  hasHeader?: boolean;
}

interface JsonConfig {
  type: "json";
  name: string;
  path: string;
}
```

### 注册数据源

在 `FlowExecutionContext` 中配置：

```typescript
const ctx: FlowExecutionContext = {
  dataSourceConfigs: [
    { type: "sqlite", name: "demo", path: "./data/demo.db" },
    { type: "csv", name: "sales", path: "./data/sales.csv", hasHeader: true },
    { type: "json", name: "config", path: "./data/config.json" },
  ],
};
```

## 数据库操作

### connect() 函数

```
connect("name")                    // 按名称连接
connect("sqlite", "path/to/db")    // 直接连接 SQLite
```

### 查询方法

```
db.query("SELECT * FROM users")              // 查询
db.query("SELECT * FROM users WHERE id = ?", 1)  // 参数化查询
db.execute("INSERT INTO logs VALUES (?)", msg)   // 执行
db.commit()                                  // 提交
db.rollback()                                // 回滚
```

### 示例

```
   A
1  db = connect("demo")
2  users = db.query("SELECT * FROM users")
3  db.execute("INSERT INTO logs (msg) VALUES (?)", "hello")
```

## 文件操作

### T() 函数

通用文件读写函数，根据扩展名自动处理：

| 扩展名 | 读取 | 写入 |
|--------|------|------|
| .csv | 解析为表格 | 不支持 |
| .json | 解析为对象/数组 | 不支持 |
| .xlsx/.xls | 解析为表格 | 支持 |

### CSV 读取

```
data = T("./data/sales.csv")
// 返回: { rows: [...], schema: [...] }
```

### JSON 读取

```
config = T("./data/config.json")
// 返回: { rows: [...], schema: [...] } 或原始对象
```

### Excel 读写

```
// 读取（默认第一个 sheet）
data = T("./data/scores.xlsx")

// 读取指定 sheet（使用分号语法）
data = T("./data/scores.xlsx"; "School2")
data = T("./data/scores.xlsx"; 2)  // 1-based 索引

// 无表头读取（@b 选项）
data = T@b("./data/no_header.xlsx")
// 列名为 #1, #2, #3, ...

// 写入
T("./out/export.xlsx", data)
T("./out/export.xlsx", data; "Sheet1")  // 指定 sheet 名
```

### 测试用例参考

```typescript
// packages/spl-flow/__tests__/excel.test.ts

// 读取 Excel
const res = await run([{ row: 1, col: "A", expr: 'T("./scores.xlsx")' }], tmpDir);
const data = res.scope.A1 as { rows: Record<string, unknown>[] };
expect(data.rows[0].Name).toBe("Alice");

// 指定 sheet
const res2 = await run([{ row: 1, col: "A", expr: 'T("./multi.xlsx"; "School2")' }], tmpDir);

// 写入并重新读取
const flow: FlowCell[] = [
  { row: 1, col: "A", expr: 'data = [{ id: 1, name: "alpha" }]' },
  { row: 2, col: "A", expr: 'T("./out/export.xlsx", data)' },
  { row: 3, col: "A", expr: 'T("./out/export.xlsx")' },
];
```

## file() 函数

读取文件内容为字符串：

```
content = file("./data/template.txt").read()
```

## csv() 函数

解析 CSV 字符串：

```
content = file("./data/sales.csv").read()
data = csv(content)
```

## 工作区路径安全

所有文件路径都相对于 `workspaceRoot` 解析，禁止访问工作区外的文件：

```typescript
// 允许
T("./data/file.csv")
T("data/file.csv")

// 禁止（会抛出错误）
T("../secrets.csv")
T("/etc/passwd")
```

错误信息：`Path escapes workspace root`
