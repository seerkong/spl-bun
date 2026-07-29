# SPL 流程控制 - TypeScript 移植指南

## 1. 移植优先级

### P0 - 核心流程控制 (必须实现)
| 功能 | Java 实现 | 复杂度 | 说明 |
|------|----------|--------|------|
| if/elseif/else | `runIfCmd`, `toElseCmd` | 中 | 条件分支 |
| for (整数) | `IntForCmdCode` | 低 | `for n` 或 `for start,end,step` |
| for (序列) | `SequenceForCmdCode` | 低 | `for A` 遍历序列 |
| break | `runBreakCmd` | 低 | 跳出循环 |
| next | `runContinueCmd` | 低 | 继续下一次循环 |
| return/result | `runReturnCmd` | 低 | 返回值 |

### P1 - 扩展功能 (建议实现)
| 功能 | Java 实现 | 复杂度 | 说明 |
|------|----------|--------|------|
| func | `FuncInfo`, `executeFunc` | 中 | 函数定义 |
| for (条件) | `BoolForCmdCode` | 低 | while 循环 |
| for (游标) | `CursorForCmdCode` | 中 | 游标遍历 |
| try | `runTryCmd`, `goCatch` | 中 | 异常处理 |
| goto | `runGotoCmd` | 低 | 跳转 |

### P2 - 高级功能 (可选实现)
| 功能 | Java 实现 | 复杂度 | 说明 |
|------|----------|--------|------|
| fork | `runForkCmd`, `ForkJob` | 高 | 并行执行 |
| channel | `runChannelCmd` | 高 | 管道 |
| reduce | - | 高 | 分布式归约 |

## 2. 架构设计建议

### 2.1 简化方案：线性脚本模式

不完全复制 Java 的网格模型，而是采用更传统的脚本执行方式：

```typescript
// 语句类型
enum StatementType {
  IF = 'if',
  ELSE = 'else',
  ELSEIF = 'elseif',
  FOR = 'for',
  BREAK = 'break',
  NEXT = 'next',
  FUNC = 'func',
  RETURN = 'return',
  TRY = 'try',
  EXPRESSION = 'expression',
}

// 语句节点
interface Statement {
  type: StatementType;
  condition?: Expression;      // if/elseif/for 的条件
  body?: Statement[];          // 代码块
  elseBody?: Statement[];      // else 分支
  label?: string;              // break/next 的目标标签
  returnExpr?: Expression;     // return 的表达式
}

// 执行上下文
interface ExecutionContext {
  variables: Map<string, any>;
  callStack: StackFrame[];
  loopStack: LoopFrame[];
}

// 循环帧
interface LoopFrame {
  label?: string;
  iterator: Iterator<any>;
  currentValue: any;
  currentIndex: number;
}
```

### 2.2 完整方案：网格模型

如果需要完全兼容 SPL 网格语法：

```typescript
// 单元格类型
enum CellType {
  BLANK = 0x01,
  CONST = 0x02,
  CALCULABLE = 0x04,      // =
  EXECUTABLE = 0x08,      // >
  NOTE = 0x10,            // /
  COMMAND = 0x20,         // if/for/func...
  CALCULABLE_BLOCK = 0x40, // ==
  EXECUTABLE_BLOCK = 0x80, // >>
  NOTE_BLOCK = 0x100,     // //
}

// 程序单元格
class PgmCell {
  row: number;
  col: number;
  expString: string;
  cellType: CellType;
  value: any;
  command?: Command;
  expression?: Expression;
}

// 程序网格
class PgmCellSet {
  cells: PgmCell[][];
  currentLocation: { row: number; col: number };
  stack: CmdCode[];
  context: Context;
  
  run(): any;
  runNext(): CellLocation | null;
  setNext(row: number, col: number, checkStack: boolean): void;
  getCodeBlockEndRow(row: number, col: number): number;
}

// 命令代码（堆栈帧）
interface CmdCode {
  type: CommandType;
  row: number;
  col: number;
  blockEndRow: number;
}

// 循环命令代码
interface ForCmdCode extends CmdCode {
  seq: number;
  hasNextValue(): boolean;
  nextValue(): any;
  endValue(): any;
  close(): void;
}
```

## 3. 核心算法实现

### 3.1 代码块边界计算

```typescript
/**
 * 计算代码块的结束行
 * SPL 使用缩进（列位置）来界定代码块
 */
function getCodeBlockEndRow(
  cells: PgmCell[][],
  startRow: number,
  startCol: number
): number {
  const totalRows = cells.length;
  
  for (let row = startRow + 1; row < totalRows; row++) {
    // 检查该行在 startCol 及之前的列是否有非空单元格
    for (let col = 0; col < startCol; col++) {
      const cell = cells[row][col];
      if (cell && !cell.isBlank()) {
        return row - 1;
      }
    }
  }
  
  return totalRows - 1;
}
```

### 3.2 条件分支执行

```typescript
function runIfStatement(
  ctx: ExecutionContext,
  stmt: IfStatement
): void {
  const conditionValue = evaluate(stmt.condition, ctx);
  
  if (isTruthy(conditionValue)) {
    // 执行 if 代码块
    executeBlock(stmt.body, ctx);
  } else if (stmt.elseIfBranches) {
    // 检查 elseif 分支
    for (const branch of stmt.elseIfBranches) {
      const branchValue = evaluate(branch.condition, ctx);
      if (isTruthy(branchValue)) {
        executeBlock(branch.body, ctx);
        return;
      }
    }
    // 执行 else 分支
    if (stmt.elseBody) {
      executeBlock(stmt.elseBody, ctx);
    }
  } else if (stmt.elseBody) {
    executeBlock(stmt.elseBody, ctx);
  }
}
```

### 3.3 循环执行

```typescript
function runForStatement(
  ctx: ExecutionContext,
  stmt: ForStatement
): void {
  const loopValue = evaluate(stmt.loopExpr, ctx);
  const iterator = createIterator(loopValue);
  
  // 创建循环帧
  const loopFrame: LoopFrame = {
    label: stmt.label,
    iterator,
    currentValue: undefined,
    currentIndex: 0,
  };
  ctx.loopStack.push(loopFrame);
  
  try {
    while (true) {
      const next = iterator.next();
      if (next.done) break;
      
      loopFrame.currentValue = next.value;
      loopFrame.currentIndex++;
      
      // 设置循环变量
      if (stmt.varName) {
        ctx.variables.set(stmt.varName, next.value);
      }
      
      try {
        executeBlock(stmt.body, ctx);
      } catch (e) {
        if (e instanceof BreakException) {
          if (!e.label || e.label === stmt.label) {
            break;
          }
          throw e; // 传播到外层循环
        }
        if (e instanceof ContinueException) {
          if (!e.label || e.label === stmt.label) {
            continue;
          }
          throw e;
        }
        throw e;
      }
    }
  } finally {
    ctx.loopStack.pop();
    iterator.close?.();
  }
}

function createIterator(value: any): Iterator<any> {
  if (typeof value === 'number') {
    // for n: 1 到 n
    return rangeIterator(1, value, 1);
  }
  if (Array.isArray(value)) {
    // for sequence
    return value[Symbol.iterator]();
  }
  if (typeof value === 'boolean') {
    // for condition (while)
    return {
      next: () => ({ value: true, done: !value }),
    };
  }
  if (isCursor(value)) {
    // for cursor
    return cursorIterator(value);
  }
  throw new Error('Invalid for loop value');
}

function* rangeIterator(
  start: number,
  end: number,
  step: number
): Generator<number> {
  if (step > 0) {
    for (let i = start; i <= end; i += step) {
      yield i;
    }
  } else {
    for (let i = start; i >= end; i += step) {
      yield i;
    }
  }
}
```

### 3.4 跳转语句

```typescript
class BreakException extends Error {
  constructor(public label?: string) {
    super('break');
  }
}

class ContinueException extends Error {
  constructor(public label?: string) {
    super('continue');
  }
}

class ReturnException extends Error {
  constructor(public value: any) {
    super('return');
  }
}

function runBreakStatement(stmt: BreakStatement): never {
  throw new BreakException(stmt.label);
}

function runContinueStatement(stmt: ContinueStatement): never {
  throw new ContinueException(stmt.label);
}

function runReturnStatement(
  ctx: ExecutionContext,
  stmt: ReturnStatement
): never {
  const value = stmt.expr ? evaluate(stmt.expr, ctx) : undefined;
  throw new ReturnException(value);
}
```

### 3.5 函数定义与调用

```typescript
interface FuncInfo {
  name: string;
  params: string[];
  body: Statement[];
  defaultValues?: any[];
}

function defineFunction(
  ctx: ExecutionContext,
  stmt: FuncStatement
): void {
  const funcInfo: FuncInfo = {
    name: stmt.name,
    params: stmt.params,
    body: stmt.body,
    defaultValues: stmt.defaultValues,
  };
  ctx.functions.set(stmt.name, funcInfo);
}

function callFunction(
  ctx: ExecutionContext,
  funcInfo: FuncInfo,
  args: any[]
): any {
  // 创建新的作用域
  const localCtx: ExecutionContext = {
    variables: new Map(ctx.variables),
    callStack: [...ctx.callStack],
    loopStack: [],
    functions: ctx.functions,
  };
  
  // 绑定参数
  for (let i = 0; i < funcInfo.params.length; i++) {
    const value = args[i] ?? funcInfo.defaultValues?.[i];
    localCtx.variables.set(funcInfo.params[i], value);
  }
  
  // 执行函数体
  try {
    executeBlock(funcInfo.body, localCtx);
    return undefined;
  } catch (e) {
    if (e instanceof ReturnException) {
      return e.value;
    }
    throw e;
  }
}
```

## 4. 语法解析建议

### 4.1 语句识别

```typescript
function parseStatement(line: string): Statement {
  const trimmed = line.trim();
  
  // 检查前缀
  if (trimmed.startsWith('=')) {
    return { type: 'expression', expr: trimmed.slice(1) };
  }
  if (trimmed.startsWith('==')) {
    return { type: 'expression_block', expr: trimmed.slice(2) };
  }
  if (trimmed.startsWith('>')) {
    return { type: 'execute', expr: trimmed.slice(1) };
  }
  if (trimmed.startsWith('//')) {
    return { type: 'comment_block' };
  }
  if (trimmed.startsWith('/')) {
    return { type: 'comment' };
  }
  
  // 检查关键字
  const keyword = trimmed.split(/\s+/)[0].replace(/@.*/, '');
  switch (keyword) {
    case 'if':
      return parseIfStatement(trimmed);
    case 'else':
      return parseElseStatement(trimmed);
    case 'elseif':
      return parseElseIfStatement(trimmed);
    case 'for':
      return parseForStatement(trimmed);
    case 'break':
      return parseBreakStatement(trimmed);
    case 'next':
      return parseContinueStatement(trimmed);
    case 'func':
      return parseFuncStatement(trimmed);
    case 'return':
    case 'result':
      return parseReturnStatement(trimmed);
    case 'try':
      return parseTryStatement(trimmed);
    case 'goto':
      return parseGotoStatement(trimmed);
    default:
      return { type: 'const', value: parseConstValue(trimmed) };
  }
}
```

### 4.2 for 语句解析

```typescript
function parseForStatement(line: string): ForStatement {
  // for n
  // for start,end
  // for start,end,step
  // for sequence
  // for cursor;count
  // for cursor;groupExpr
  
  const match = line.match(/^for\s+(.+)$/);
  if (!match) {
    return { type: 'for', infinite: true }; // 无限循环
  }
  
  const expr = match[1];
  
  // 检查是否有分号（游标语法）
  if (expr.includes(';')) {
    const [cursorExpr, countOrGroup] = expr.split(';');
    return {
      type: 'for',
      cursorExpr,
      fetchCount: countOrGroup,
    };
  }
  
  // 检查是否有逗号（范围语法）
  if (expr.includes(',')) {
    const parts = expr.split(',').map(s => s.trim());
    return {
      type: 'for',
      start: parts[0],
      end: parts[1],
      step: parts[2] || '1',
    };
  }
  
  // 单个表达式
  return {
    type: 'for',
    loopExpr: expr,
  };
}
```

## 5. 测试用例建议

```typescript
// 条件分支测试
test('if-else', () => {
  const script = `
    if x > 0
      =x * 2
    else
      =0
  `;
  expect(execute(script, { x: 5 })).toBe(10);
  expect(execute(script, { x: -1 })).toBe(0);
});

// 循环测试
test('for loop', () => {
  const script = `
    =0
    for 10
      =A1 + A2
    return A1
  `;
  expect(execute(script)).toBe(55); // 1+2+...+10
});

// 序列遍历测试
test('for sequence', () => {
  const script = `
    for [1,2,3,4,5]
      >sum += A1
    return sum
  `;
  expect(execute(script)).toBe(15);
});

// break 测试
test('break', () => {
  const script = `
    for 100
      if A1 > 5
        break
    return A1
  `;
  expect(execute(script)).toBe(6);
});

// 函数测试
test('function', () => {
  const script = `
    func factorial(n)
      if n <= 1
        return 1
      return n * factorial(n-1)
    =factorial(5)
  `;
  expect(execute(script)).toBe(120);
});
```

## 6. 文件结构建议

```
packages/expression/src/
├── flow/
│   ├── index.ts           # 导出
│   ├── types.ts           # 类型定义
│   ├── parser.ts          # 语句解析
│   ├── executor.ts        # 执行引擎
│   ├── context.ts         # 执行上下文
│   ├── statements/
│   │   ├── if.ts          # if/elseif/else
│   │   ├── for.ts         # for 循环
│   │   ├── break.ts       # break/next
│   │   ├── func.ts        # 函数定义
│   │   ├── return.ts      # return/result
│   │   └── try.ts         # 异常处理
│   └── iterators/
│       ├── range.ts       # 整数范围迭代器
│       ├── sequence.ts    # 序列迭代器
│       └── cursor.ts      # 游标迭代器
└── __tests__/
    └── flow/
        ├── if.test.ts
        ├── for.test.ts
        └── func.test.ts
```
