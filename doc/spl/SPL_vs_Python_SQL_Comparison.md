# SPL vs Python/SQL 对照表

## 核心结论

- SPL 的函数调用更像一个"数据计算 DSL"，强调紧凑表达和参数分层。
- `@` 在 SPL 中通常是**函数选项**，不是函数别名。
- `;` 用于按角色分组参数，适合复杂聚合、映射和多阶段操作。

## 语法对照（高频）

| 主题 | SPL | Python/Pandas 常见写法 | SQL 常见写法 | 关键差异 |
| --- | --- | --- | --- | --- |
| 函数模式切换 | `interval@y(A,B)` | 常用不同函数名或参数开关 | 常用不同函数或表达式 | SPL 用 `@` 在同一函数名下切模式 |
| 多选项组合 | `A.pos@az(2)` | 多个参数组合控制行为 | 多子句组合（`ORDER BY`/`LIMIT`） | SPL 选项可组合，且兼容时顺序无关 |
| 参数分组 | `A.groups(K;sum(V):S)` | `groupby().agg()` 分步骤 | `GROUP BY` + 聚合列表 | SPL 在一次调用内用 `;` 划分角色组 |
| 成对参数 | `if(c1:r1,c2:r2,rd)` | `r1 if c1 else ...` | `CASE WHEN c1 THEN r1 ...` | SPL 用 `:` 绑定成对语义 |
| 省略默认参数 | `f(x)`（其余默认） | 默认参数或关键字参数 | 默认行为由数据库定义 | SPL 大量函数默认参数可省略 |
| 序列占位符 | `A.select(~>10)` | `filter(lambda x: x>10, A)` | `WHERE col>10` | SPL 用 `~` 表示当前成员 |
| 数据对象方法风格 | `A.sort(F1,-F2)` | `sort_values([F1,F2], ascending=[True,False])` | `ORDER BY F1 ASC, F2 DESC` | SPL 常把排序规则写进一个表达式列表 |
| 首个/全部结果切换 | `A.pos(2)` / `A.pos@a(2)` | `next(...)` / 列表推导 | `LIMIT 1` / 全量查询 | SPL 常用 `@1` / `@a` 这类选项切换 |
| 映射替换 | `A.switch(K,T:V)` | `map`/`merge`/`replace` | `JOIN` 或 `CASE` | SPL 把映射关系内嵌到函数参数中 |
| 表达式执行环境 | `A1,B1,~` 等上下文符号 | 显式变量名与作用域 | 列名与别名作用域 | SPL 对"当前上下文"的语法更浓 |

## 你关心的 `;` 参数分组（再解释一次）

把函数调用先按 `;` 拆成"参数块"，每个块负责不同角色。

示例：`A.groups(STATEID;sum(POPULATION):Population)`

- 块 1（分组块）：`STATEID`
- 块 2（聚合块）：`sum(POPULATION):Population`

可理解为：

`groups(分组定义; 聚合定义)`

## 同一任务三种写法（直观对比）

任务：统计各州人口总数，取前 5 名。

### SPL

```spl
A.groups(STATEID;sum(POPULATION):Population).top(-5;Population)
```

### Python/Pandas

```python
(df.groupby("STATEID", as_index=False)["POPULATION"]
   .sum()
   .rename(columns={"POPULATION": "Population"})
   .nlargest(5, "Population"))
```

### SQL

```sql
SELECT STATEID, SUM(POPULATION) AS Population
FROM CITIES
GROUP BY STATEID
ORDER BY Population DESC
LIMIT 5;
```

## 实战速记

读 SPL 复杂函数时建议按这个顺序：

1. 先看 `@`：函数处于什么模式
2. 再按 `;`：参数分了几组、各组职责是什么
3. 组内按 `,`：有哪些参数
4. 最后看 `:`：哪些是成对绑定参数

## 表达能力对比结论（补充）

### 结论先看

- 没有绝对"最强"，取决于任务场景。
- 做复杂数据处理脚本（多步、分组、顺序计算、条件映射）时，SPL 往往比 SQL 更完整、比 Pandas 更紧凑。
- 做通用编程与生态整合（ML、服务开发、第三方库）时，Python 最强。
- 做数据库内大规模关系查询时，SQL 最强（优化器、索引、执行计划）。

### 三者差异（聚焦表达能力）

- SPL：数据处理 DSL + 过程能力，`@` 选项、`: , ;` 分层参数、序列计算表达很强。
- Python/Pandas：通用能力最强，灵活度高，但复杂数据链路常更长、样板代码更多。
- SQL：声明式集合计算最强，查询/聚合/Join 很强；但复杂流程控制与跨阶段状态处理不自然。

### 如何更准确比较"表达能力"

- 复杂逻辑可表达性：Python ≈ SPL > SQL
- 数据处理代码紧凑度：SPL ≈ SQL（纯查询场景）> Pandas
- 生态与可扩展性：Python >>> SPL > SQL

### 直观示例（分组聚合后取 TopN）

- SPL：`A.groups(STATEID;sum(POPULATION):Population).top(-5;Population)`
- Pandas：`groupby + sum + rename + nlargest`（步骤更多）
- SQL：`GROUP BY + ORDER BY DESC + LIMIT`

这个例子里 SQL/SPL 都简洁；如果后续还要串联多轮规则判断、文件落地、游标流式处理，SPL 通常更连贯。
