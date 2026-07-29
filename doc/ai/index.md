# SPL-Bun AI 文档索引

SPL-Bun 是 esProc SPL 的 TypeScript 重新实现，提供基于网格的数据处理语言运行时。

## 文档速查表

| 文档 | 说明 | 何时阅读 |
|------|------|----------|
| [MAINTENANCE.md](./MAINTENANCE.md) | 文档维护指南 | 更新文档时 |
| [architecture/](./architecture/index.md) | 系统架构文档 | 了解整体设计时 |
| [framework/](./framework/index.md) | 框架开发实践 | 开发新功能时 |
| [modules/](./modules/index.md) | 业务模块文档 | 了解具体模块时 |

## 项目概述

### 技术栈

- **运行时**: Bun (TypeScript)
- **前端**: Vite + Univerjs (电子表格组件)
- **后端**: Elysia (HTTP 框架)
- **数据库**: SQLite (bun:sqlite)
- **测试**: Bun Test + Playwright (E2E)

### 核心包

| 包名 | 说明 |
|------|------|
| `depa-data-expression` | 表达式解析和求值引擎 |
| `depa-data-core` | DataSet 类和数据操作 |
| `depa-data-spl-flow` | 流程控制和 DSL 执行 |
| `depa-data-sqlite-adapter` | SQLite 数据源适配器 |
| `depa-data-web-ide` | Web IDE 前端 |
| `depa-data-web-server` | 后端 API 服务 |
| `depa-data-web-shared` | 共享类型定义 |

### 关键文件位置

```
spl-bun/
├── packages/
│   ├── expression/src/       # 表达式引擎
│   │   ├── evaluator.ts      # 表达式求值器
│   │   ├── functions.ts      # 内置函数
│   │   ├── types.ts          # 类型定义 (DbHandle, FileHandle 等)
│   │   └── memberRegistry.ts # 成员函数注册
│   ├── core/src/
│   │   ├── dataset.ts        # DataSet 类
│   │   ├── execution.ts      # Step 执行引擎
│   │   └── gather.ts         # 聚合函数
│   ├── spl-flow/src/
│   │   ├── index.ts          # 流程执行器 (evaluateFlow)
│   │   ├── flow/grid.ts      # 网格解析
│   │   └── flow/navigation.ts # 流程导航
│   ├── web-server/src/
│   │   └── server.ts         # API 服务器
│   └── web-ide/src/
│       └── main.ts           # 前端入口
├── codument/
│   ├── archive/              # 已完成的设计文档
│   └── tracks/               # 进行中的设计文档
└── doc/ai/                   # AI 文档 (本目录)
```

## 快速开始

```bash
# 安装依赖
bun install

# 运行测试
bun test

# 启动开发服务器
bun run dev:backend   # 后端 (端口 4176)
bun run dev:frontend  # 前端 (端口 4174)

# 运行 E2E 测试
bun run test:e2e
```

## Python 移植注意事项

本文档旨在为 Python 版本实现提供参考。移植时需注意：

1. **表达式引擎**: 核心解析逻辑在 `packages/expression/src/evaluator.ts`
2. **流程控制**: 网格执行逻辑在 `packages/spl-flow/src/index.ts`
3. **数据结构**: DataSet 类在 `packages/core/src/dataset.ts`
4. **测试用例**: 各包的 `__tests__/` 目录包含完整的行为规范
