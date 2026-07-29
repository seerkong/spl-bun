# 流程控制语句

## 概述

spl-flow 支持完整的流程控制语句，包括条件、循环、跳转、子程序和异常处理。

## 表达式前缀

在网格表达式中，前缀用于区分计算格与执行格：

- `=` 前缀：计算格，执行后将结果写入 `scope[cellRef]`。
- `>` 前缀：执行格，执行后不写入 `scope[cellRef]`，但会记录执行结果并可更新 `lastQuery`。

前缀仅适用于表达式格；命令格（if/for/try 等）不使用前缀。

参考资料：
- https://doc.esproc.com/esproc/tutorial/dyglx.html (Executable cell)
- http://doc.raqsoft.com.cn/esproc/tutorial/dyglx.html (执行格)

## 条件语句 (if/elseif/else)

### 语法

```
if <condExpr>
elseif <condExpr>   // 或 else if <condExpr>
else
```

### 行为

1. 评估 `if` 条件，如果为真则执行其代码块
2. 如果为假，依次评估 `elseif` 条件
3. 如果所有条件都为假，执行 `else` 块（如果存在）
4. 执行完一个分支后，跳过其余分支

### 示例

```
   A              B
1  if x > 0
2                 result "positive"
3  elseif x == 0
4                 result "zero"
5  else
6                 result "negative"
```

### 测试用例参考

```typescript
// packages/spl-flow/__tests__/if.test.ts
const cells: FlowCell[] = [
  { row: 1, col: "A", expr: "if x > 0" },
  { row: 2, col: "B", expr: "x * 2" },
  { row: 3, col: "A", expr: "else if x == 0" },
  { row: 4, col: "B", expr: "100" },
  { row: 5, col: "A", expr: "else" },
  { row: 6, col: "B", expr: "-1" },
];

const res = await evaluateFlow(cells, { scope: { x: 0 } });
expect(res.scope.B4).toBe(100);
```

## 循环语句 (for)

### 语法变体

| 语法 | 说明 | 循环变量值 |
|------|------|-----------|
| `for` | 无限循环 | 迭代序号 (1, 2, 3, ...) |
| `for n` | 计数循环 | 1 到 n |
| `for start,end` | 范围循环 | start 到 end |
| `for start,end,step` | 步进循环 | start, start+step, ... |
| `for [a,b,c]` | 序列循环 | 当前元素 |
| `for condition` | 条件循环 | 条件值 |

### 循环序号

使用 `#<cellRef>` 获取循环的当前迭代序号（1-based）：

```
   A              B
1  total = 0
2  for 3
3                 total += #A2    // #A2 = 1, 2, 3
4  total                          // = 6
```

### break 和 continue

- `break` - 退出最近的循环
- `continue` - 跳到下一次迭代
- `break <cellRef>` - 退出指定的外层循环
- `continue <cellRef>` - 继续指定的外层循环

### 示例

```
   A              B              C              D
1  hit = 0
2  for 3                                              // 外层循环
3                 for 3                               // 内层循环
4                                if A2 == 2 and B3 == 2
5                                               break A2  // 退出外层
6                                hit += 1
7  hit                                                // = 4
```

### 测试用例参考

```typescript
// packages/spl-flow/__tests__/for.test.ts

// 计数循环
const cells: FlowCell[] = [
  { row: 1, col: "A", expr: "sum = 0" },
  { row: 2, col: "A", expr: "for 3" },
  { row: 3, col: "B", expr: "sum += A2" },
  { row: 4, col: "A", expr: "sum" },
];
const res = await evaluateFlow(cells, {});
expect(res.scope.A4).toBe(6);  // 1 + 2 + 3

// 序列循环
const cells2: FlowCell[] = [
  { row: 1, col: "A", expr: "sum = 0" },
  { row: 2, col: "A", expr: "for [1,2,3]" },
  { row: 3, col: "B", expr: "sum += A2" },
  { row: 4, col: "A", expr: "sum" },
];
const res2 = await evaluateFlow(cells2, {});
expect(res2.scope.A4).toBe(6);
```

## 跳转语句 (goto)

### 语法

```
goto <cellRef>
```

### 行为

1. 跳转到目标单元格继续执行
2. 禁止跳入更深的缩进层级（如循环体内）

### 示例

```
   A
1  x = 0
2  goto A4
3  x = 1        // 跳过
4  x = 2        // 从这里继续
```

### 测试用例参考

```typescript
// packages/spl-flow/__tests__/goto.test.ts
const cells: FlowCell[] = [
  { row: 1, col: "A", expr: "x = 0" },
  { row: 2, col: "A", expr: "goto A4" },
  { row: 3, col: "A", expr: "x = 1" },
  { row: 4, col: "A", expr: "x = 2" },
];

const res = await evaluateFlow(cells, {});
expect(res.scope.A4).toBe(2);
expect("A3" in res.scope).toBe(false);
```

## 子程序 (func/return)

### 语法

```
func                    // 定义子程序
return <expr>           // 返回值
func(<masterCell>, args...)  // 调用子程序
```

### 行为

1. `func` 单元格定义子程序，其代码块在正常流程中不执行
2. 通过 `func(masterCell, arg1, arg2, ...)` 调用
3. 参数从 masterCell 开始向右分配
4. `return` 返回值并退出子程序
5. 无 `return` 时返回最后一个表达式的值

### 示例

```
   A              B
1  func                         // 子程序定义
2                 return A1 + B1
3  func(A1, 1, 2)               // 调用，A1=1, B1=2，返回 3
```

### 测试用例参考

```typescript
// packages/spl-flow/__tests__/func.test.ts
const cells: FlowCell[] = [
  { row: 1, col: "A", expr: "func" },
  { row: 2, col: "B", expr: "return A1 + B1" },
  { row: 3, col: "A", expr: "func(A1, 1, 2)" },
];

const res = await evaluateFlow(cells, {});
expect(res.scope.A3).toBe(3);
```

## 异常处理 (try)

### 语法

```
try
    <可能出错的代码>
```

### 行为

1. 执行 try 块中的代码
2. 如果发生错误，捕获错误消息存入 try 单元格
3. 如果成功，try 单元格值为 null
4. 无论成功失败，继续执行 try 块后的代码

### 示例

```
   A              B
1  try
2                 unknownFunc()    // 错误被捕获
3  1 + 1                           // 继续执行
```

### 测试用例参考

```typescript
// packages/spl-flow/__tests__/try.test.ts
const cells: FlowCell[] = [
  { row: 1, col: "A", expr: "try" },
  { row: 2, col: "B", expr: "unknownFunc()" },
  { row: 3, col: "A", expr: "1 + 1" },
];

const res = await evaluateFlow(cells, {});
expect(typeof res.scope.A1).toBe("string");  // 错误消息
expect(res.scope.A3).toBe(2);  // 继续执行
```

## 终止语句 (result/end)

### result

```
result <expr>
```

设置流程返回值并终止执行。返回值在 `FlowEvaluationResult.result` 中。

### end

```
end              // 静默终止
end "message"    // 抛出错误终止
```

### 测试用例参考

```typescript
// packages/spl-flow/__tests__/result-end.test.ts

// result
const cells1: FlowCell[] = [
  { row: 1, col: "A", expr: "result 1 + 1" },
  { row: 2, col: "A", expr: "x = 1" },  // 不执行
];
const res1 = await evaluateFlow(cells1, {});
expect(res1.result).toBe(2);

// end with message
const cells2: FlowCell[] = [
  { row: 1, col: "A", expr: 'end "boom"' },
];
await expect(evaluateFlow(cells2, {})).rejects.toThrow(/boom/);
```
