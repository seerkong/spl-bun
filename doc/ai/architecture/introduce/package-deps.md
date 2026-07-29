# 包依赖关系

## 依赖图

```
                    ┌─────────────────┐
                    │   web-ide       │
                    │   (前端)        │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   web-server    │
                    │   (后端)        │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │ web-shared  │  │  spl-flow   │  │sqlite-adapter│
    │ (类型定义)  │  │ (流程执行)  │  │ (数据源)    │
    └─────────────┘  └──────┬──────┘  └─────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │    core     │  │ expression  │  │    xlsx     │
    │  (DataSet)  │  │  (表达式)   │  │  (外部库)   │
    └──────┬──────┘  └─────────────┘  └─────────────┘
           │
           ▼
    ┌─────────────┐
    │ expression  │
    └─────────────┘
```

## 包说明

### depa-data-expression

表达式解析和求值引擎，无外部依赖。

**导出**:
- `compileExpression()` - 编译表达式
- `evaluateExpression()` - 直接求值
- `builtins` - 内置函数注册表
- `FunctionRegistryBuilder` - 函数注册构建器
- 类型句柄: `makeDbHandle`, `makeFileHandle`, `makeCursorHandle`

### depa-data-core

数据集操作，依赖 expression。

**导出**:
- `DataSet` - 数据集类
- `Engine` - 步骤执行引擎
- 步骤创建函数: `createComputeStep`, `createFilterStep`, `createJoinStep`, `createWindowStep`

### depa-data-spl-flow

流程控制执行器，依赖 core 和 expression。

**导出**:
- `evaluateFlow()` - 执行流程
- `buildFlowAst()` - 构建 AST
- `buildFlowScope()` - 构建作用域
- 数据源类型: `DataSourceConfig`, `SqliteConfig`, `CsvConfig`, `JsonConfig`

### depa-data-sqlite-adapter

SQLite 数据源适配器。

**导出**:
- `createSqliteStep()` - 创建 SQLite 加载步骤

### depa-data-web-shared

共享类型定义，依赖 core。

**导出**:
- API 路由常量
- 请求/响应类型: `ExecuteRequest`, `ExecuteResponse`
- 单元格类型: `CellDefinition`, `SqlCell`, `FilterCell` 等

### depa-data-web-server

后端 API 服务，依赖 spl-flow 和 web-shared。

**导出**:
- `createApp()` - 创建 Elysia 应用

### depa-data-web-ide

前端应用，依赖 web-shared。

## 构建顺序

由于包之间的依赖关系，构建必须按以下顺序：

```bash
1. depa-data-expression
2. depa-data-spl-flow
3. depa-data-core
4. depa-data-sqlite-adapter
5. depa-data-web-shared
6. depa-data-composer
7. depa-data-web-ide
8. depa-data-web-server
9. depa-data-test-utils
```

这个顺序在 `package.json` 的 `build` 脚本中定义。
