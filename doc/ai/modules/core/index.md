# core 模块文档

SPL 核心数据操作模块。

## 文档列表

| 文档 | 说明 | 何时阅读 |
|------|------|----------|
| [introduce/](./introduce/index.md) | 模块概念介绍 | 初次了解模块时 |
| [howto/](./howto/index.md) | 操作指南 | 使用 DataSet 时 |
| [example/](./example/index.md) | 代码示例 | 需要参考实现时 |
| [constaint/](./constaint/index.md) | 规则约束 | 设计新功能时 |
| [misc/](./misc/index.md) | 杂项补充 | 了解细节时 |
| [troubleshooting/](./troubleshooting/index.md) | 故障排除 | 遇到问题时 |

## 模块功能

- DataSet 类（数据集操作）
- 投影、过滤、聚合
- Join 操作（inner/left）
- Window 函数
- Step 执行引擎

## 代码位置

```
packages/core/
├── src/
│   ├── index.ts              # 主入口
│   ├── dataset.ts            # DataSet 类
│   ├── execution.ts          # Step 执行引擎
│   └── gather.ts             # 聚合函数
└── __tests__/
    ├── dataset.test.ts       # DataSet 测试
    ├── joinWindow.test.ts    # Join/Window 测试
    ├── engine.test.ts        # 引擎测试
    └── expressionIntegration.test.ts
```

## 核心 API

### DataSet 类

```typescript
class DataSet {
  readonly schema: ColumnSchema[];
  readonly rows: Row[];

  // 创建
  static fromRows(rows: Row[]): DataSet;

  // 投影
  project(columns: string[]): DataSet;

  // 过滤
  filter(predicate: (row: Row) => boolean): DataSet;
  filterExpr(expression: string, scope?: Record<string, unknown>): DataSet;

  // 计算列
  withComputedColumns(columns: Record<string, string>, scope?: Record<string, unknown>): DataSet;

  // 聚合
  aggregate(spec: AggregateSpec): DataSet;
  aggregateWithGather(spec: GatherSpec): DataSet;

  // 连接
  join(other: DataSet, spec: JoinSpec): DataSet;

  // 窗口函数
  window(spec: WindowSpec): DataSet;

  // 转换
  toArray(): Row[];
}
```

### 类型定义

```typescript
type Row = Record<string, unknown>;

interface ColumnSchema {
  name: string;
  type: string;
}

interface JoinSpec {
  type: "inner" | "left";
  leftKeys: string[];
  rightKeys?: string[];
  rightPrefix?: string;
}

interface WindowSpec {
  partitionBy?: string[];
  orderBy: OrderBySpec[];
  outputs: WindowOutputs;
}

interface WindowOutputs {
  rowNumber?: string;
  rank?: string;
  denseRank?: string;
  runningSum?: { column: string; as?: string };
  runningAvg?: { column: string; as?: string };
}
```
