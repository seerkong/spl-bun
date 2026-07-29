# SPL 流程控制实现分析

> 分析日期: 2026-01-23
> 
> 源码位置: `esProc/src/main/java/com/scudata/cellset/datamodel/`

## 1. 概述

SPL (Structured Process Language) 的流程控制实现基于**网格计算模型 (CellSet)**，与传统编程语言的线性执行不同，SPL 使用二维网格作为代码组织单元，通过缩进（列位置）来表示代码块的层级关系。

### 核心设计理念

- **网格即程序**: 每个单元格可以是表达式、语句或注释
- **缩进即作用域**: 代码块通过列位置（缩进）而非花括号来界定
- **堆栈式执行**: 使用 `LinkedList<CmdCode>` 作为执行堆栈，管理嵌套的控制结构

## 2. 核心类结构

### 2.1 主要类文件

| 文件 | 职责 |
|------|------|
| `PgmCellSet.java` | 程序网格，执行引擎核心，包含所有流程控制的执行逻辑 |
| `PgmNormalCell.java` | 程序单元格，解析和存储单元格内容（表达式/语句/注释） |
| `Command.java` | 语句解析器，定义所有语句类型和解析逻辑 |

### 2.2 类关系图

```
PgmCellSet (执行引擎)
├── cellMatrix: Matrix<PgmNormalCell>  // 单元格矩阵
├── stack: LinkedList<CmdCode>         // 执行堆栈
├── curLct: CellLocation               // 当前执行位置
└── fnMap: HashMap<String, FuncInfo>   // 函数映射表

PgmNormalCell (单元格)
├── expStr: String                     // 表达式字符串
├── sign: int                          // 单元格类型标志
├── command: Command                   // 解析后的语句对象
└── expRef: SoftReference<Expression>  // 表达式缓存

Command (语句)
├── type: byte                         // 语句类型
├── lctStr: String                     // 跳转目标位置
└── expStr: String                     // 参数表达式
```

## 3. 语句类型定义

在 `Command.java` 中定义了所有流程控制语句类型：

```java
// 条件分支
public static final byte IF = 1;
public static final byte ELSE = 2;
public static final byte ELSEIF = 3;

// 循环控制
public static final byte FOR = 4;
public static final byte CONTINUE = 5;  // 对应 SPL 的 "next"
public static final byte BREAK = 6;

// 函数定义与调用
public static final byte FUNC = 8;
public static final byte RETURN = 9;
public static final byte END = 10;
public static final byte RESULT = 11;

// 其他控制
public static final byte SQL = 12;
public static final byte CLEAR = 13;
public static final byte FORK = 15;     // 并行执行
public static final byte REDUCE = 16;
public static final byte GOTO = 17;
public static final byte CHANNEL = 18;  // 管道
public static final byte TRY = 19;      // 异常捕捉
```

### 关键字映射

```java
keyMap.put("if", IF);
keyMap.put("else", ELSE);
keyMap.put("elseif", ELSEIF);
keyMap.put("for", FOR);
keyMap.put("next", CONTINUE);    // SPL 用 next 而非 continue
keyMap.put("break", BREAK);
keyMap.put("func", FUNC);
keyMap.put("return", RETURN);
keyMap.put("end", END);
keyMap.put("result", RESULT);
keyMap.put("goto", GOTO);
keyMap.put("try", TRY);
keyMap.put("fork", FORK);
keyMap.put("reduce", REDUCE);
keyMap.put("cursor", CHANNEL);
```

## 4. 单元格类型

`PgmNormalCell` 根据表达式前缀识别单元格类型：

| 前缀 | 类型 | 说明 |
|------|------|------|
| `=` | `TYPE_CALCULABLE_CELL` | 计算格，返回值 |
| `==` | `TYPE_CALCULABLE_BLOCK` | 计算块，返回值，跳过子格 |
| `>` | `TYPE_EXECUTABLE_CELL` | 执行格，不返回值 |
| `>>` | `TYPE_EXECUTABLE_BLOCK` | 执行块，不返回值，跳过子格 |
| `/` | `TYPE_NOTE_CELL` | 注释格 |
| `//` | `TYPE_NOTE_BLOCK` | 注释块 |
| 语句关键字 | `TYPE_COMMAND_CELL` | 语句格 (if/for/func等) |
| 其他 | `TYPE_CONST_CELL` | 常数格 |
| 空 | `TYPE_BLANK_CELL` | 空白格 |

## 5. 执行引擎机制

### 5.1 执行入口

```java
// PgmCellSet.java
public void run() {
    while (true) {
        if (isInterrupted) {
            isInterrupted = false;
            break;
        }
        
        if (runNext2() == null) {
            break;
        } else if (hasReturn()) {
            runFinished();
            break;
        }
    }
}
```

### 5.2 核心执行循环 (`runNext2`)

```java
private CellLocation runNext2() {
    // 1. 初始化：首次执行时设置起始位置
    if (curLct == null) {
        curLct = new CellLocation();
        setNext(1, 1, false);
        return curLct;
    }

    // 2. 获取当前单元格
    PgmNormalCell cell = getPgmNormalCell(curLct.getRow(), curLct.getCol());
    Command command = cell.getCommand();

    // 3. 执行逻辑
    if (command == null) {
        // 普通表达式格：计算并移动到下一格
        cell.calculate();
        setNext(curLct.getRow(), curLct.getCol() + 1, false);
    } else {
        // 语句格：根据类型分发执行
        switch (command.getType()) {
            case Command.IF:      runIfCmd(cell, command); break;
            case Command.FOR:     runForCmd(cell, command); break;
            case Command.BREAK:   runBreakCmd(command); break;
            case Command.CONTINUE: runContinueCmd(command); break;
            case Command.GOTO:    runGotoCmd(command); break;
            case Command.RETURN:  runReturnCmd(command); break;
            case Command.FORK:    runForkCmd(command, ctx); break;
            case Command.TRY:     runTryCmd(cell, command); break;
            // ... 其他语句类型
        }
    }
    
    return curLct;
}
```

### 5.3 位置移动逻辑 (`setNext`)

```java
public void setNext(int row, int col, boolean isCheckStack) {
    // 1. 列溢出时换行
    if (col > colCount) {
        row++;
        col = 1;
        isCheckStack = true;
    }

    // 2. 检查堆栈（处理循环和代码块边界）
    if (isCheckStack) {
        while (stack.size() > 0) {
            CmdCode cmd = stack.getFirst();
            if (row > cmd.blockEndRow) {
                if (cmd.type == Command.FOR) {
                    // 循环：跳回循环头
                    curLct.set(cmd.row, cmd.col);
                    return;
                } else {
                    // 其他代码块：弹出堆栈
                    stack.removeFirst();
                }
            } else {
                break;
            }
        }
    }

    // 3. 跳过空白格、注释格、常数格
    PgmNormalCell cell = getPgmNormalCell(row, col);
    if (cell.isBlankCell() || cell.isNoteCell() || cell.isConstCell()) {
        setNext(row, col + 1, false);
    } else if (cell.isNoteBlock()) {
        setNext(getCodeBlockEndRow(row, col) + 1, 1, true);
    } else {
        curLct.set(row, col);
    }
}
```

## 6. 流程控制详解

### 6.1 条件分支 (if/elseif/else)

**执行逻辑** (`runIfCmd`):

```java
private void runIfCmd(NormalCell cell, Command command) {
    Expression exp = command.getExpression(this, ctx);
    Object value = exp.calculate(ctx);
    cell.setValue(value);
    
    if (Variant.isTrue(value)) {
        // 条件为真：执行下一格（代码块内容）
        setNext(curLct.getRow(), curLct.getCol() + 1, false);
    } else {
        // 条件为假：跳转到 else/elseif 分支
        toElseCmd();
    }
}
```

**分支查找** (`toElseCmd`):
1. 在同一行查找 `else` 或 `elseif`
2. 如果找到 `elseif`，递归执行条件判断
3. 如果找到 `else`，执行 else 代码块
4. 如果都没找到，跳过整个 if 代码块

**SPL 语法示例**:
```
A1: if condition1    B1: =expr1
A2:                  B2: =expr2
A3: else if cond2    B3: =expr3
A4: else             B4: =expr4
A5: =next_statement
```

### 6.2 循环 (for)

**循环类型** (通过内部类实现):

| 类 | 触发条件 | 说明 |
|---|---------|------|
| `EndlessForCmdCode` | `for` (无参数) | 无限循环 |
| `IntForCmdCode` | `for n` 或 `for start,end,step` | 整数范围循环 |
| `SequenceForCmdCode` | `for sequence` | 序列遍历 |
| `BoolForCmdCode` | `for boolean_expr` | 条件循环 (while) |
| `CursorForCmdCode` | `for cursor` | 游标遍历 |

**执行逻辑** (`runForCmd`):

```java
private void runForCmd(NormalCell cell, Command command) {
    int row = curLct.getRow();
    int col = curLct.getCol();
    
    // 检查是否是循环继续（堆栈中已有此循环）
    if (stack.size() > 0) {
        CmdCode cmd = stack.getFirst();
        if (cmd.row == row && cmd.col == col) {
            ForCmdCode forCmd = (ForCmdCode) cmd;
            if (forCmd.hasNextValue()) {
                // 继续下一次迭代
                cell.setValue(forCmd.nextValue());
                setNext(row, col + 1, false);
            } else {
                // 循环结束
                stack.removeFirst();
                endForCommand(forCmd);
                setNext(cmd.blockEndRow + 1, 1, true);
            }
            return;
        }
    }

    // 首次进入循环：创建循环控制对象
    ForCmdCode cmdCode = createForCmdCode(command, row, col, endRow, ctx);
    
    if (cmdCode != null && cmdCode.hasNextValue()) {
        cell.setValue(cmdCode.nextValue());
        stack.addFirst(cmdCode);  // 压入堆栈
        setNext(row, col + 1, false);
    } else {
        setNext(endRow + 1, 1, true);  // 跳过循环
    }
}
```

**SPL 语法示例**:
```
A1: for 10           B1: =A1*2        // 循环10次，A1依次为1-10
A2: for A            B2: =A2.name     // 遍历序列A
A3: for i=1,100,2    B3: =i*i         // i从1到100，步长2
A4: for cursor;1000  B4: >process(A4) // 每次取1000条
```

### 6.3 跳转语句

#### break
```java
private void runBreakCmd(Command command) {
    CellLocation forLct = command.getCellLocation(getContext());
    
    // 查找目标循环（可指定跳出哪个循环）
    for (int i = 0; i < stack.size(); ++i) {
        CmdCode cmd = stack.get(i);
        if (cmd.type == Command.FOR) {
            if (forLct == null || matches(forLct, cmd)) {
                // 弹出所有内层循环
                for (int j = 0; j <= i; ++j) {
                    stack.removeFirst();
                }
                // 跳到循环后
                setNext(cmd.blockEndRow + 1, 1, true);
                return;
            }
        }
    }
}
```

#### next (continue)
```java
private void runContinueCmd(Command command) {
    // 类似 break，但跳回循环头而非循环后
    CmdCode cmd = stack.getFirst();
    setNext(cmd.row, cmd.col, false);  // 回到 for 语句
}
```

#### goto
```java
private void runGotoCmd(Command command) {
    CellLocation lct = command.getCellLocation(getContext());
    
    // 检查跳转合法性（不能跳入循环内部）
    // 弹出必要的堆栈帧
    // 设置新位置
    setNext(lct.getRow(), lct.getCol(), false);
}
```

### 6.4 函数定义与调用

**函数定义** (`func`):
```java
// func fnName(arg1, arg2, ...)
// 函数体通过缩进界定
```

**函数信息** (`FuncInfo`):
```java
public class FuncInfo {
    private String fnName;           // 函数名
    private String option;           // 选项 (@i=非递归, @m=宏模式, @o=选项参数)
    private PgmNormalCell cell;      // 函数所在单元格
    private String[] argNames;       // 参数名列表
    private Object[] defaultValues;  // 默认值
    private int endRow;              // 函数体结束行
}
```

**函数执行** (`executeFunc`):
```java
public Object executeFunc(FuncInfo funcInfo, Object[] args, Context ctx) {
    if (funcInfo.isRecursiveMode()) {
        // 递归模式：复制网格，独立执行
        PgmCellSet pcs = newCalc(ctx);
        // 复制函数体单元格
        // 设置参数
        return pcs.executeFunc(row, col, endRow, null);
    } else {
        // 非递归模式：保存/恢复现场
        CellLocation oldLct = curLct;
        LinkedList<CmdCode> oldStack = stack;
        stack = new LinkedList<CmdCode>();
        
        try {
            return executeFunc(row, col, endRow, args);
        } finally {
            curLct = oldLct;
            stack = oldStack;
        }
    }
}
```

### 6.5 并行执行 (fork)

**执行逻辑** (`runForkCmd`):
```java
private void runForkCmd(IParam param, int row, int col, int endRow, Context ctx) {
    // 1. 解析参数，确定并行数
    int mcount = determineParallelCount(args);
    
    // 2. 为每个并行任务创建独立网格
    ForkJob[] jobs = new ForkJob[mcount];
    for (int i = 0; i < mcount; ++i) {
        PgmCellSet pcs = newForkPgmCellSet(row, col, endRow, ctx, true);
        pcs.forkCmdCode = new ForkCmdCode(row, col, endRow, i + 1);
        pcs.getPgmNormalCell(row, col).setValue(args[i]);
        jobs[i] = new ForkJob(pcs, row, col, endRow);
        pool.submit(jobs[i]);
    }
    
    // 3. 等待所有任务完成，收集结果
    Sequence result = new Sequence(mcount);
    for (int i = 0; i < mcount; ++i) {
        jobs[i].join();
        result.add(jobs[i].getResult());
    }
    
    getPgmNormalCell(row, col).setValue(result);
}
```

### 6.6 异常处理 (try)

```java
private void runTryCmd(NormalCell cell, Command command) {
    int row = cell.getRow();
    int col = cell.getCol();
    int endRow = getCodeBlockEndRow(row, col);
    
    // 将 try 块压入堆栈
    CmdCode cmdCode = new CmdCode(Command.TRY, row, col, endRow);
    stack.addFirst(cmdCode);
    setNext(row, col + 1, false);
}

// 异常捕获逻辑在 runNext2 的 catch 块中
private boolean goCatch(String error) {
    while (stack.size() > 0) {
        CmdCode cmd = stack.getFirst();
        if (cmd.type == Command.TRY) {
            stack.removeFirst();
            setNext(cmd.blockEndRow + 1, 1, true);
            getPgmNormalCell(cmd.row, cmd.col).setValue(error);
            return true;  // 异常已处理
        } else {
            stack.removeFirst();
        }
    }
    return false;  // 未找到 try 块，异常继续传播
}
```

## 7. 代码块边界计算

SPL 使用缩进（列位置）来界定代码块，核心方法：

```java
public int getCodeBlockEndRow(int prow, int pcol) {
    int totalRow = getRowCount();
    for (int row = prow + 1; row <= totalRow; ++row) {
        // 检查该行在 pcol 及之前的列是否有非空单元格
        for (int c = 1; c <= pcol; ++c) {
            PgmNormalCell cell = getPgmNormalCell(row, c);
            if (!cell.isBlankCell()) {
                return row - 1;  // 找到边界
            }
        }
    }
    return totalRow;  // 到文件末尾
}
```

**示例**:
```
A1: for 10           // 代码块开始
    B1: =A1*2        // 属于 A1 的代码块
    B2: =B1+1        // 属于 A1 的代码块
A3: =result          // A1 代码块结束（A3 在 A1 同列有内容）
```

## 8. 执行堆栈管理

### CmdCode 结构
```java
private static class CmdCode {
    protected byte type;        // 语句类型
    protected int row;          // 语句行号
    protected int col;          // 语句列号
    protected int blockEndRow;  // 代码块结束行
}

private static abstract class ForCmdCode extends CmdCode {
    protected int seq = 0;      // 循环序号
    
    abstract boolean hasNextValue();
    abstract Object nextValue();
    Object endValue() { return null; }
    void close() {}
}
```

### 堆栈操作
- **压栈**: 进入 for/try 代码块时
- **弹栈**: 
  - 正常退出代码块
  - break/goto 跳出
  - 异常处理时查找 try 块

## 9. 与 TypeScript 实现的对比

### 当前 TS 实现状态
- ✅ 表达式解析和求值
- ✅ 内置函数和成员函数
- ❌ **流程控制语句 (if/for/break/continue/goto)**
- ❌ **网格执行模型**
- ❌ **函数定义 (func)**
- ❌ **并行执行 (fork)**
- ❌ **异常处理 (try)**

### 移植建议

1. **核心架构**
   - 实现 `PgmCellSet` 对应的执行引擎类
   - 实现单元格类型识别和解析
   - 实现执行堆栈管理

2. **优先级排序**
   - P0: if/else/elseif (条件分支)
   - P0: for (循环，至少支持整数和序列)
   - P0: break/next (循环控制)
   - P1: func/return (函数定义)
   - P1: try (异常处理)
   - P2: goto (跳转)
   - P2: fork (并行执行)

3. **简化方案**
   - 可以先实现线性脚本执行，不依赖网格模型
   - 使用缩进或花括号界定代码块
   - 逐步添加网格特性

## 10. 参考文件

| 文件 | 行数 | 说明 |
|------|------|------|
| `PgmCellSet.java` | ~3300 | 执行引擎核心 |
| `PgmNormalCell.java` | ~480 | 单元格实现 |
| `Command.java` | ~430 | 语句解析 |
| `CellSet.java` | - | 基类，网格基础功能 |
