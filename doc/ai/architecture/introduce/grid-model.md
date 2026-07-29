# 网格执行模型

## 概述

SPL 使用二维网格作为代码组织方式，类似于电子表格。每个单元格可以包含表达式或命令。

## 单元格寻址

### CellRef 格式

单元格通过列字母 + 行号引用：

- `A1` - 第 1 行，第 1 列
- `B2` - 第 2 行，第 2 列
- `AA10` - 第 10 行，第 27 列

### 列索引转换

```typescript
// 列字母转索引 (A=1, B=2, ..., Z=26, AA=27)
function colToIndex(col: string): number {
  let index = 0;
  for (const char of col.toUpperCase()) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index;
}

// 索引转列字母
function indexToCol(index: number): string {
  let col = "";
  while (index > 0) {
    const remainder = (index - 1) % 26;
    col = String.fromCharCode(65 + remainder) + col;
    index = Math.floor((index - 1) / 26);
  }
  return col;
}
```

## 单元格类型

### 1. 表达式单元格 (expression)

普通的表达式，求值后存入 scope：

```
A1: 1 + 2           // scope.A1 = 3
A2: x = 10          // scope.x = 10, scope.A2 = 10
A3: A1 + A2         // scope.A3 = 13
```

### 2. 命令单元格 (command)

以关键字开头的流程控制语句：

```
A1: if x > 0        // 条件判断
A2: for 3           // 循环
A3: goto A5         // 跳转
A4: func            // 子程序定义
```

### 3. 空白单元格 (blank)

空内容或仅包含空白字符，执行时跳过。

### 4. 注释单元格 (comment)

以 `//` 开头，执行时跳过。注释单元格会截断同行右侧的所有单元格。

```
A1: x = 1
B1: // 这是注释
C1: x = 2           // 不会执行，被 B1 截断
```

## 缩进和代码块

列位置表示代码块层级：

```
   A              B              C
1  if x > 0                              // 条件开始
2                 y = 1                  // if 块内
3                 if y > 0               // 嵌套条件
4                                z = 2   // 嵌套 if 块内
5  else                                  // else 分支
6                 y = -1                 // else 块内
7  result y                              // 条件结束后
```

规则：
- 命令单元格右侧的单元格属于该命令的代码块
- 代码块结束于遇到同列或更左列的非空单元格
- 每行只能有一个可执行单元格

## 执行顺序

1. 从 A1 开始，按行优先顺序扫描
2. 跳过空白和注释单元格
3. 遇到命令单元格时，根据命令类型处理代码块
4. 表达式单元格直接求值
5. 结果存入 `scope[cellRef]`

## 作用域

所有单元格共享同一个 scope 对象：

```typescript
interface FlowEvaluationResult {
  cells: FlowCellEvaluation[];  // 每个单元格的执行结果
  lastQuery?: unknown;          // 最后一个查询结果
  result?: unknown;             // result 命令的返回值
  scope: Record<string, unknown>; // 所有变量
}
```

变量来源：
- 单元格引用: `scope.A1`, `scope.B2`
- 显式赋值: `x = 10` → `scope.x`
- 循环变量: `for` 单元格的当前值
- 外部传入: `evaluateFlow(cells, { scope: { x: 1 } })`
