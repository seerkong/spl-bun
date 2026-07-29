# spl-flow 模块文档

SPL 流程控制和执行引擎。

## 文档列表

| 文档 | 说明 | 何时阅读 |
|------|------|----------|
| [introduce/](./introduce/index.md) | 模块概念介绍 | 初次了解模块时 |
| [howto/](./howto/index.md) | 操作指南 | 使用流程控制时 |
| [example/](./example/index.md) | 代码示例 | 需要参考实现时 |
| [constaint/](./constaint/index.md) | 规则约束 | 设计新功能时 |
| [misc/](./misc/index.md) | 杂项补充 | 了解细节时 |
| [troubleshooting/](./troubleshooting/index.md) | 故障排除 | 遇到问题时 |

## 模块功能

- 网格解析和单元格分类
- 流程控制语句执行 (if/for/goto/func/try)
- 数据源连接和查询
- 文件操作 (CSV/JSON/Excel)

## 代码位置

```
packages/spl-flow/
├── src/
│   ├── index.ts              # 主入口，evaluateFlow()
│   ├── flow/
│   │   ├── grid.ts           # 网格解析
│   │   └── navigation.ts     # 流程导航
│   ├── connection/
│   │   ├── registry.ts       # 连接注册
│   │   └── handle.ts         # 数据源句柄
│   └── datasource/
│       ├── factory.ts        # 数据源工厂
│       └── types.ts          # 类型定义
└── __tests__/
    ├── if.test.ts            # 条件测试
    ├── for.test.ts           # 循环测试
    ├── goto.test.ts          # 跳转测试
    ├── func.test.ts          # 子程序测试
    ├── try.test.ts           # 异常测试
    ├── result-end.test.ts    # 终止测试
    └── excel.test.ts         # Excel 测试
```

## 核心 API

```typescript
// 执行流程
async function evaluateFlow(
  cells: FlowCell[],
  ctx: FlowExecutionContext
): Promise<FlowEvaluationResult>

// 流程单元格
interface FlowCell {
  row: number;
  col: string;
  expr: string;
}

// 执行上下文
interface FlowExecutionContext {
  scope?: Record<string, unknown>;
  connections?: Map<string, DBConnection>;
  dataSourceConfigs?: DataSourceConfig[];
  defaultDbPath?: string;
  workspaceRoot?: string;
  adapters?: {
    sqliteQuery?: (options: QueryOptions) => unknown | Promise<unknown>;
    sqliteExecute?: (options: QueryOptions) => unknown | Promise<unknown>;
  };
}

// 执行结果
interface FlowEvaluationResult {
  cells: FlowCellEvaluation[];
  lastQuery?: unknown;
  result?: unknown;
  scope: Record<string, unknown>;
}
```
