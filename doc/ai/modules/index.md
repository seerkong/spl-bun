# 模块文档

SPL-Bun 核心模块的详细文档。

## 文档列表

| 文档 | 说明 | 何时阅读 |
|------|------|----------|
| [expression/](./expression/index.md) | 表达式引擎模块 | 了解表达式解析和求值时 |
| [spl-flow/](./spl-flow/index.md) | 流程控制模块 | 了解流程执行逻辑时 |
| [core/](./core/index.md) | 核心数据模块 | 了解 DataSet 操作时 |

## 模块概览

### expression 模块

负责解析和求值 SPL 表达式，包括：
- 算术、逻辑、比较运算
- 函数调用（内置函数和成员函数）
- 变量引用和赋值
- 类型句柄（数据库、文件、游标）

### spl-flow 模块

负责执行 SPL 流程，包括：
- 网格解析和导航
- 流程控制语句（if/for/goto/func/try）
- 数据源连接和查询
- 文件操作（CSV/JSON/Excel）

### core 模块

负责数据集操作，包括：
- DataSet 类（投影、过滤、聚合）
- Join 操作（inner/left）
- Window 函数（row_number/rank/running_sum）
- Step 执行引擎
