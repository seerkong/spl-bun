# expression 模块文档

SPL 表达式解析和求值引擎。

## 文档列表

| 文档 | 说明 | 何时阅读 |
|------|------|----------|
| [introduce/](./introduce/index.md) | 模块概念介绍 | 初次了解模块时 |
| [howto/](./howto/index.md) | 操作指南 | 使用表达式时 |
| [example/](./example/index.md) | 代码示例 | 需要参考实现时 |
| [constaint/](./constaint/index.md) | 规则约束 | 设计新功能时 |
| [misc/](./misc/index.md) | 杂项补充 | 了解细节时 |
| [troubleshooting/](./troubleshooting/index.md) | 故障排除 | 遇到问题时 |

## 模块功能

- 表达式解析（词法分析、语法分析）
- 表达式求值
- 内置函数（数学、字符串、日期、集合）
- 类型句柄（数据库、文件、游标）
- 成员函数注册

## 代码位置

```
packages/expression/
├── src/
│   ├── index.ts              # 主入口
│   ├── evaluator.ts          # 解析和求值
│   ├── ast.ts                # AST 节点定义
│   ├── functions.ts          # 内置函数
│   ├── types.ts              # 类型句柄
│   ├── registry.ts           # 函数注册构建器
│   ├── memberRegistry.ts     # 成员函数注册
│   ├── paramParser.ts        # 参数解析
│   ├── paramFunctions.ts     # ifp/casep 函数
│   ├── macro.ts              # 宏替换
│   └── utils.ts              # 工具函数
└── __tests__/
    ├── expression.test.ts    # 表达式测试
    ├── like.test.ts          # like 函数测试
    ├── regex.test.ts         # regex 函数测试
    ├── datePhase2.test.ts    # 日期函数测试
    └── mathPhase2.test.ts    # 数学函数测试
```

## 核心 API

```typescript
// 编译表达式（可重用）
function compileExpression(
  expression: string,
  functions?: FunctionRegistry,
  memberRegistry?: MemberFunctionRegistry
): CompiledExpression

// 直接求值
function evaluateExpression(
  expression: string,
  scope: Record<string, unknown>
): unknown

// 编译后的表达式
interface CompiledExpression {
  evaluate(scope: Record<string, unknown>): unknown;
}

// 函数注册表
type FunctionRegistry = Record<string, (...args: unknown[]) => unknown>;

// 内置函数
const builtins: FunctionRegistry;

// 自定义函数
function withCustomFunctions(overrides: FunctionRegistry): FunctionRegistry;
```
