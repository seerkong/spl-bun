# 技术栈详解

## 运行时

### Bun

SPL-Bun 使用 Bun 作为 JavaScript/TypeScript 运行时：

- 内置 TypeScript 支持
- 内置测试框架 (`bun:test`)
- 内置 SQLite 支持 (`bun:sqlite`)
- 高性能包管理器

### TypeScript

项目使用 TypeScript 5.4，配置位于 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true
  }
}
```

## 前端

### Vite

前端构建工具，配置位于 `packages/web-ide/vite.config.ts`。

### Univerjs

电子表格组件，用于 Web IDE 的网格编辑器：

```typescript
import { Univer } from "@univerjs/core";
import { UniverSheetsPlugin } from "@univerjs/sheets";
```

### AG-Grid

数据表格组件，用于显示查询结果。

## 后端

### Elysia

轻量级 HTTP 框架：

```typescript
import { Elysia } from "elysia";
import cors from "@elysiajs/cors";

const app = new Elysia()
  .use(cors())
  .get("/api/health", () => ({ status: "ok" }))
  .post("/api/execute", async ({ body }) => {
    // 处理请求
  });
```

### bun:sqlite

内置 SQLite 支持：

```typescript
import { Database } from "bun:sqlite";

const db = new Database("./data/demo.db");
const rows = db.prepare("SELECT * FROM users").all();
```

## 测试

### Bun Test

单元测试框架：

```typescript
import { describe, expect, test } from "bun:test";

describe("module", () => {
  test("feature", () => {
    expect(1 + 1).toBe(2);
  });
});
```

### Playwright

E2E 测试框架：

```typescript
import { test, expect } from "@playwright/test";

test("loads page", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("SPL");
});
```

## 包管理

### Bun Workspaces

Monorepo 配置在根 `package.json`：

```json
{
  "workspaces": ["packages/*"]
}
```

### 包引用

使用 `workspace:*` 引用本地包：

```json
{
  "dependencies": {
    "depa-data-expression": "workspace:*"
  }
}
```

## 外部依赖

| 包 | 用途 |
|-----|------|
| `xlsx` | Excel 文件读写 |
| `@elysiajs/cors` | CORS 中间件 |
| `@univerjs/presets` | 电子表格组件 |
| `@playwright/test` | E2E 测试 |
