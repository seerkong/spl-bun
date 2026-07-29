# 内置函数

## 数学函数

| 函数 | 说明 | 示例 |
|------|------|------|
| `abs(x)` | 绝对值 | `abs(-5)` → `5` |
| `pow(x, y)` | 幂运算 | `pow(2, 3)` → `8` |
| `sqrt(x)` | 平方根 | `sqrt(9)` → `3` |
| `sin(x)` | 正弦 | `sin(0)` → `0` |
| `cos(x)` | 余弦 | `cos(0)` → `1` |
| `tan(x)` | 正切 | `tan(0)` → `0` |
| `exp(x)` | e^x | `exp(1)` → `2.718...` |
| `log(x)` | 自然对数 | `log(e)` → `1` |
| `log10(x)` | 常用对数 | `log10(100)` → `2` |
| `ln(x)` | 自然对数 (同 log) | `ln(e)` → `1` |
| `ceil(x)` | 向上取整 | `ceil(1.2)` → `2` |
| `floor(x)` | 向下取整 | `floor(1.8)` → `1` |
| `round(x, d?)` | 四舍五入 | `round(3.14159, 2)` → `3.14` |
| `sign(x)` | 符号 | `sign(-5)` → `-1` |
| `gcd(...)` | 最大公约数 | `gcd(12, 18)` → `6` |
| `lcm(...)` | 最小公倍数 | `lcm(4, 6)` → `12` |
| `rand()` | 随机数 [0,1) | `rand()` → `0.xxx` |

## 字符串函数

| 函数 | 说明 | 示例 |
|------|------|------|
| `len(s)` | 长度 | `len("hello")` → `5` |
| `upper(s)` | 大写 | `upper("hello")` → `"HELLO"` |
| `lower(s)` | 小写 | `lower("HELLO")` → `"hello"` |
| `trim(s)` | 去空白 | `trim("  hi  ")` → `"hi"` |
| `substr(s, start, len?)` | 子串 | `substr("hello", 1, 3)` → `"ell"` |
| `replace(s, old, new)` | 替换 | `replace("hello", "l", "x")` → `"hexxo"` |
| `pos(s, sub)` | 位置 (1-based) | `pos("hello", "el")` → `2` |
| `split(s, sep)` | 分割 | `split("a,b,c", ",")` → `["a","b","c"]` |
| `left(s, n)` | 左截取 | `left("hello", 2)` → `"he"` |
| `right(s, n)` | 右截取 | `right("hello", 2)` → `"lo"` |
| `mid(s, start, len)` | 中间截取 | `mid("hello", 2, 3)` → `"ell"` |
| `concat(...)` | 连接 | `concat("a", "b", "c")` → `"abc"` |

## 模式匹配函数

### like(value, pattern, options?)

通配符匹配：

- `*` 匹配任意字符（SQL 模式用 `%`）
- `?` 匹配单个字符（SQL 模式用 `_`）

选项：
- `@c` - 忽略大小写
- `@s` - SQL 模式（使用 `%` 和 `_`）

```
like("hello", "he*o")      // true
like("Hello", "h*", "c")   // true (忽略大小写)
like@s("hello", "he%o")    // true (SQL 模式)
```

### regex(str, pattern, replacement?, options?)

正则表达式匹配/替换：

选项：
- `@c` - 忽略大小写
- `@a` - 替换所有
- `@w` - 完整匹配
- `@u` - Unicode 模式
- `@p` - 解析捕获组

```
regex("hello", "l+")                    // "hello" (匹配成功返回原串)
regex("hello", "(l+)", "p")             // ["ll"] (提取捕获组)
regex("hello", "l", "x")                // "hexlo" (替换第一个)
regex@a("hello", "l", "x")              // "hexxo" (替换所有)
```

## 日期函数

| 函数 | 说明 | 示例 |
|------|------|------|
| `now()` | 当前时间 | `now()` |
| `date(s)` | 解析日期 | `date("2024-01-01")` |
| `datetime(y,m,d,h?,min?,s?)` | 构造日期 | `datetime(2024,1,1)` |
| `year(d)` | 年份 | `year(d)` → `2024` |
| `month(d)` | 月份 | `month(d)` → `1` |
| `day(d)` | 日期 | `day(d)` → `1` |
| `hour(d)` | 小时 | `hour(d)` → `0` |
| `minute(d)` | 分钟 | `minute(d)` → `0` |
| `second(d)` | 秒 | `second(d)` → `0` |
| `dateadd(d, days)` | 加天数 | `dateadd(d, 1)` |
| `datediff(d1, d2)` | 天数差 | `datediff(d1, d2)` → `1` |
| `datevalue(d)` | 时间戳 | `datevalue(d)` → `1704067200000` |
| `format(d, fmt?)` | 格式化 | `format(d, "date")` → `"2024-01-01"` |
| `age(start, end?, opts?)` | 年龄 | `age(birthday)` → `30` |
| `workday(d, n, off?)` | 工作日偏移 | `workday(d, 5)` |
| `workdays(start, end, off?, opts?)` | 工作日列表/计数 | `workdays@n(d1, d2)` → `5` |

## 聚合函数

| 函数 | 说明 | 示例 |
|------|------|------|
| `sum(arr)` | 求和 | `sum([1,2,3])` → `6` |
| `avg(arr)` | 平均值 | `avg([1,2,3])` → `2` |
| `min(arr)` | 最小值 | `min([1,2,3])` → `1` |
| `max(arr)` | 最大值 | `max([1,2,3])` → `3` |
| `median(arr)` | 中位数 | `median([1,2,3])` → `2` |
| `count(...)` | 计数 (truthy) | `count(1, 0, "a")` → `2` |
| `icount(arr)` | 去重计数 | `icount([1,1,2])` → `2` |
| `top(n, arr, expr?)` | 前 N 个 | `top(2, [1,2,3])` → `[2,3]` |

## 控制流函数

| 函数 | 说明 | 示例 |
|------|------|------|
| `if(cond, then, else?)` | 条件 | `if(x>0, "yes", "no")` |
| `case(val, k1, v1, ...)` | 匹配 | `case(x, 1, "one", 2, "two")` |
| `nvl(val, default)` | 空值替换 | `nvl(null, 0)` → `0` |

## 转换函数

| 函数 | 说明 | 示例 |
|------|------|------|
| `json(val)` | JSON 解析/序列化 | `json('{"a":1}')` → `{a:1}` |
| `json_parse(s)` | JSON 解析 | `json_parse('{"a":1}')` |
| `json_stringify(obj)` | JSON 序列化 | `json_stringify({a:1})` |
| `parse(s, opts?)` | 字面量解析 | `parse("42")` → `42` |

## 序列成员函数

数组和表格支持的成员函数：

| 函数 | 说明 | 示例 |
|------|------|------|
| `.count()` | 长度 | `arr.count()` |
| `.sum()` | 求和 | `arr.sum()` |
| `.avg()` | 平均值 | `arr.avg()` |
| `.min()` | 最小值 | `arr.min()` |
| `.max()` | 最大值 | `arr.max()` |
| `.first()` | 第一个 | `arr.first()` |
| `.last()` | 最后一个 | `arr.last()` |
| `.calc(expr)` | 映射 | `arr.calc("_ * 2")` |
| `.fetch(n)` | 取前 N 个 | `arr.fetch(2)` |
| `.skip(n)` | 跳过前 N 个 | `arr.skip(2)` |
| `.select(expr)` | 过滤 | `tab.select("amount > 10")` |
| `.sort(col, dir?)` | 排序 | `tab.sort("amount", "desc")` |
| `.derive(cols)` | 派生列 | `tab.derive({ gross: "amount * 1.1" })` |
| `.group(spec)` | 分组聚合 | `tab.group({ groupBy: ["cat"], aggregates: {...} })` |
| `.join(right, spec)` | 连接 | `tab.join(other, { type: "left", leftKeys: ["id"] })` |

## 数据库成员函数

DbHandle 支持的成员函数：

| 函数 | 说明 |
|------|------|
| `.query(sql, ...params)` | 执行查询 |
| `.execute(sql, ...params)` | 执行语句 |
| `.commit()` | 提交事务 |
| `.rollback()` | 回滚事务 |

## 文件成员函数

FileHandle 支持的成员函数：

| 函数 | 说明 |
|------|------|
| `.read()` | 读取内容 |
| `.write(data)` | 写入内容 |
| `.import()` | 导入为表格 |
| `.export(data)` | 导出表格 |

## 游标成员函数

CursorHandle 支持的成员函数：

| 函数 | 说明 |
|------|------|
| `.fetch(n)` | 获取 N 条记录 |
| `.skip(n)` | 跳过 N 条记录 |
