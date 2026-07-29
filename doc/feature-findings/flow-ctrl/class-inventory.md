# SPL 流程控制 - 核心类清单

## 1. 主要源文件

### 执行引擎
| 文件路径 | 类名 | 职责 |
|---------|------|------|
| `src/main/java/com/scudata/cellset/datamodel/PgmCellSet.java` | `PgmCellSet` | 程序网格执行引擎，包含所有流程控制执行逻辑 |
| `src/main/java/com/scudata/cellset/datamodel/PgmNormalCell.java` | `PgmNormalCell` | 程序单元格，解析表达式/语句 |
| `src/main/java/com/scudata/cellset/datamodel/Command.java` | `Command` | 语句解析器，定义语句类型常量 |
| `src/main/java/com/scudata/cellset/datamodel/SqlCommand.java` | `SqlCommand` | SQL语句特化类 |
| `src/main/java/com/scudata/cellset/datamodel/CellSet.java` | `CellSet` | 网格基类 |
| `src/main/java/com/scudata/cellset/datamodel/NormalCell.java` | `NormalCell` | 单元格基类 |

### 执行上下文
| 文件路径 | 类名 | 职责 |
|---------|------|------|
| `src/main/java/com/scudata/dm/Context.java` | `Context` | 计算上下文，管理变量、参数、堆栈 |
| `src/main/java/com/scudata/dm/ComputeStack.java` | `ComputeStack` | 计算堆栈 |
| `src/main/java/com/scudata/dm/Current.java` | `Current` | 当前记录引用（用于循环中访问当前元素） |
| `src/main/java/com/scudata/dm/Param.java` | `Param` | 参数定义 |
| `src/main/java/com/scudata/dm/ParamList.java` | `ParamList` | 参数列表 |

### 并行执行
| 文件路径 | 类名 | 职责 |
|---------|------|------|
| `src/main/java/com/scudata/thread/ThreadPool.java` | `ThreadPool` | 线程池 |
| `src/main/java/com/scudata/thread/Job.java` | `Job` | 任务基类 |
| `src/main/java/com/scudata/thread/CursorLooper.java` | `CursorLooper` | 游标循环任务 |
| `src/main/java/com/scudata/dm/ParallelCaller.java` | `ParallelCaller` | 并行调用器（分布式fork） |

### 表达式引擎
| 文件路径 | 类名 | 职责 |
|---------|------|------|
| `src/main/java/com/scudata/expression/Expression.java` | `Expression` | 表达式解析和求值 |
| `src/main/java/com/scudata/expression/IParam.java` | `IParam` | 参数接口 |
| `src/main/java/com/scudata/expression/ParamParser.java` | `ParamParser` | 参数解析器 |
| `src/main/java/com/scudata/expression/FunctionLib.java` | `FunctionLib` | 函数注册库 |

## 2. PgmCellSet 内部类

### 循环控制类
```java
// 基类
private static class CmdCode {
    byte type;           // 语句类型
    int row, col;        // 位置
    int blockEndRow;     // 代码块结束行
}

// 循环基类
private static abstract class ForCmdCode extends CmdCode {
    int seq;             // 循环序号
    abstract boolean hasNextValue();
    abstract Object nextValue();
}

// 具体循环实现
private static class EndlessForCmdCode extends ForCmdCode     // 无限循环
private static class IntForCmdCode extends ForCmdCode         // 整数循环
private static class SequenceForCmdCode extends ForCmdCode    // 序列循环
private static class BoolForCmdCode extends ForCmdCode        // 条件循环
private static class CursorForCmdCode extends ForCmdCode      // 游标循环
```

### 并行执行类
```java
private static class ForkCmdCode extends CmdCode {
    int seq;             // fork线程序号
}

private static class ForkJob extends Job {
    PgmCellSet pcs;      // 执行网格
    int row, col, endRow;
}

private class SubForkJob extends Job {
    IParam param;
    Context ctx;
}
```

### 函数信息类
```java
public class FuncInfo {
    String fnName;           // 函数名
    String option;           // 选项 (@i/@m/@o)
    PgmNormalCell cell;      // 所在单元格
    String[] argNames;       // 参数名
    boolean[] macroSigns;    // 宏参数标记
    Object[] defaultValues;  // 默认值
    String macroExp;         // 宏表达式
    int endRow;              // 函数体结束行
}
```

## 3. 关键方法索引

### PgmCellSet 执行方法
| 方法 | 行号(约) | 功能 |
|------|---------|------|
| `run()` | 2349 | 主执行循环 |
| `runNext2()` | 2195 | 执行下一单元格 |
| `setNext(row, col, isCheckStack)` | 2098 | 设置下一执行位置 |
| `getCodeBlockEndRow(row, col)` | 2146 | 计算代码块结束行 |

### 流程控制方法
| 方法 | 行号(约) | 功能 |
|------|---------|------|
| `runIfCmd(cell, command)` | 999 | 执行 if 语句 |
| `toElseCmd()` | 877 | 跳转到 else/elseif |
| `skipCodeBlock()` | 866 | 跳过代码块 |
| `runForCmd(cell, command)` | 1044 | 执行 for 循环 |
| `runBreakCmd(command)` | 1248 | 执行 break |
| `runContinueCmd(command)` | 1216 | 执行 next (continue) |
| `runGotoCmd(command)` | 1281 | 执行 goto |
| `runReturnCmd(command)` | 1846 | 执行 return/result |
| `runForkCmd(param, row, col, endRow, ctx)` | 1632 | 执行 fork |
| `runTryCmd(cell, command)` | 1962 | 执行 try |
| `goCatch(error)` | 2316 | 异常捕获处理 |

### 函数相关方法
| 方法 | 行号(约) | 功能 |
|------|---------|------|
| `getFunctionMap()` | 3207 | 获取函数映射表 |
| `getFuncInfo(fnName)` | 2556 | 根据名称获取函数信息 |
| `executeFunc(funcInfo, args, ctx)` | 2596 | 执行函数 |
| `executeFunc(row, col, endRow, args)` | 2723 | 执行函数（内部） |

### PgmNormalCell 方法
| 方法 | 行号(约) | 功能 |
|------|---------|------|
| `setExpString(exp)` | 61 | 设置表达式，解析单元格类型 |
| `calculate()` | 145 | 计算单元格 |
| `getCommand()` | 283 | 获取语句对象 |
| `getExpression()` | 240 | 获取表达式对象 |

### Command 方法
| 方法 | 行号(约) | 功能 |
|------|---------|------|
| `isCommand(cmdStr)` | 230 | 判断是否是语句 |
| `parse(cmdStr)` | 252 | 解析语句字符串 |
| `getParam(cs, ctx)` | 153 | 获取语句参数 |
| `getExpression(cs, ctx)` | 167 | 获取参数表达式 |

## 4. 语句类型常量 (Command.java)

```java
// 条件分支
IF = 1, ELSE = 2, ELSEIF = 3

// 循环
FOR = 4, CONTINUE = 5 (next), BREAK = 6

// 函数
FUNC = 8, RETURN = 9, END = 10, RESULT = 11

// SQL
SQL = 12

// 其他
CLEAR = 13, FORK = 15, REDUCE = 16, GOTO = 17, CHANNEL = 18, TRY = 19
```

## 5. 单元格类型常量 (INormalCell 接口)

```java
TYPE_BLANK_CELL = 0x01        // 空白格
TYPE_CONST_CELL = 0x02        // 常数格
TYPE_CALCULABLE_CELL = 0x04   // 计算格 (=)
TYPE_EXECUTABLE_CELL = 0x08   // 执行格 (>)
TYPE_NOTE_CELL = 0x10         // 注释格 (/)
TYPE_COMMAND_CELL = 0x20      // 语句格
TYPE_CALCULABLE_BLOCK = 0x40  // 计算块 (==)
TYPE_EXECUTABLE_BLOCK = 0x80  // 执行块 (>>)
TYPE_NOTE_BLOCK = 0x100       // 注释块 (//)
```
