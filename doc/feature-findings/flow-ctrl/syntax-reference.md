# SPL 流程控制 - 语法参考

## 1. 条件分支

### if 语句
```spl
if condition
    =expression1
    =expression2
```

### if-else 语句
```spl
if condition
    =expr_true
else
    =expr_false
```

### if-elseif-else 语句
```spl
if condition1
    =expr1
else if condition2
    =expr2
else
    =expr_default
```

**同行写法**（Java 支持）:
```spl
A1: if x>0    B1: =x*2    C1: else    D1: =0
```

## 2. 循环

### for 整数循环
```spl
for n                    // 循环 n 次，循环变量为 1,2,...,n
    =A1 * 2              // A1 是循环变量

for start,end            // 从 start 到 end
    =A1

for start,end,step       // 指定步长
    =A1
```

### for 序列遍历
```spl
for sequence             // 遍历序列中的每个元素
    =A1.field            // A1 是当前元素
```

### for 条件循环 (while)
```spl
for condition            // 当条件为真时循环
    =process()
    >condition = check()
```

### for 无限循环
```spl
for                      // 无限循环，需要 break 退出
    if done
        break
```

### for 游标遍历
```spl
for cursor               // 每次取默认数量
    =process(A1)

for cursor,count         // 每次取 count 条
    =process(A1)

for cursor;groupExpr     // 按分组表达式取
    =process(A1)
```

## 3. 跳转语句

### break
```spl
for 100
    if A1 > 10
        break            // 跳出当前循环
    =process(A1)
```

### break 指定循环
```spl
for 10                   // 外层循环 A1
    for 10               // 内层循环 B1
        if condition
            break A1     // 跳出外层循环
```

### next (continue)
```spl
for sequence
    if skip_condition
        next             // 跳过本次，继续下一次
    =process(A1)
```

### next 指定循环
```spl
for 10                   // 外层循环 A1
    for 10               // 内层循环 B1
        if condition
            next A1      // 继续外层循环的下一次
```

### goto
```spl
A1: =start
A2: =process()
A3: if not_done
A4:     goto A2          // 跳转到 A2
A5: =result
```

## 4. 函数定义

### 基本函数
```spl
func myFunc(arg1, arg2)
    =arg1 + arg2
    return A1
```

### 带选项的函数
```spl
func@i myFunc(arg1)      // @i: 非递归模式（不复制网格）
    =process(arg1)
    return A1

func@m myFunc(arg1)      // @m: 宏模式
    =macro_expr

func@o myFunc(arg1)      // @o: 选项作为第一个参数
    =process(arg1)
```

### 函数调用
```spl
=myFunc(1, 2)            // 直接调用
=call(A1, arg1, arg2)    // 通过单元格引用调用
```

## 5. 返回值

### return
```spl
func myFunc(n)
    if n <= 0
        return 0         // 提前返回
    =process(n)
    return A1            // 返回计算结果
```

### result
```spl
=data.select(condition)
result A1                // 设置网格返回值
```

### 多值返回
```spl
return val1, val2, val3  // 返回序列
```

## 6. 异常处理

### try
```spl
try
    =risky_operation()
    =more_operations()
// try 块结束后，如果发生异常，错误信息存入 try 所在单元格
=A1                      // 获取错误信息（如果有）
```

### end (终止执行)
```spl
if fatal_error
    end                  // 终止网格执行

end "error message"      // 带错误信息终止
```

## 7. 并行执行

### fork
```spl
fork sequence            // 并行处理序列中的每个元素
    =process(A1)
// A1 的值是所有并行结果组成的序列
```

### fork 多参数
```spl
fork seq1, seq2          // 并行处理多个序列
    =process(A1(1), A1(2))
```

### fork 分布式
```spl
fork sequence;hosts      // 分布式并行
    =process(A1)
```

### reduce
```spl
fork sequence
    =partial_result(A1)
reduce
    =merge_results(A1)   // 合并并行结果
```

## 8. 管道 (channel)

```spl
cursor cs
    =cs.select(condition)
    =A1.derive(newField:expr)
// 管道操作会附加到游标上
```

## 9. SQL 语句

### 基本查询
```spl
$(db) select * from table
```

### 带参数
```spl
$(db) select * from table where id=?; id_value
```

### 选项
```spl
$@1(db) select ...       // @1: 只返回第一条
$@c(db) select ...       // @c: 返回游标
```

## 10. 其他语句

### clear
```spl
clear A1                 // 清除单元格值
clear A1:B10             // 清除区域
clear A1:                // 清除代码块
```

## 11. 单元格类型前缀

| 前缀 | 类型 | 说明 |
|------|------|------|
| `=` | 计算格 | 计算表达式，返回值 |
| `==` | 计算块 | 计算表达式，跳过子格 |
| `>` | 执行格 | 执行表达式，不返回值 |
| `>>` | 执行块 | 执行表达式，跳过子格 |
| `/` | 注释格 | 单行注释 |
| `//` | 注释块 | 块注释，跳过子格 |
| `'` | 字符串常量 | 字符串值 |
| 无前缀 | 常量/语句 | 常量值或流程控制语句 |

## 12. 代码块规则

SPL 使用**缩进（列位置）**来界定代码块，而非花括号：

```
    A           B           C           D
1   for 10      =A1*2                       ← B1 属于 A1 的代码块
2               =B1+1                       ← B2 属于 A1 的代码块
3               if B2>50    =B2             ← C3 属于 B3 的代码块
4                           =C3*2           ← D4 属于 B3 的代码块
5   =result                                 ← A5 结束 A1 的代码块
```

**规则**:
- 代码块从语句所在列的下一列开始
- 代码块在遇到同列或更左列的非空单元格时结束
- 空白格、注释格不影响代码块边界

## 13. 循环序号引用

在循环中可以使用 `#` 引用循环序号：

```spl
for sequence
    =#A1                 // 当前循环序号 (1, 2, 3, ...)
    =A1                  // 当前元素值
```

## 14. 示例程序

### 斐波那契数列
```spl
A1: func fib(n)
B1:     if n<=2
C1:         return 1
B2:     return fib(n-1)+fib(n-2)
A3: =fib(10)
```

### 数据处理
```spl
A1: =file("data.csv").import@t()
A2: =A1.select(amount>100)
A3: =A2.groups(category; sum(amount):total)
A4: =A3.sort(total:-1)
A5: result A4
```

### 并行计算
```spl
A1: =directory("data/").list()
A2: fork A1
B2:     =file(A2).import@t()
B3:     =B2.select(valid)
B4:     =B3.sum(value)
A5: =A2.sum()
```
