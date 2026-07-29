# SPL 迁移 Top 10（极简提示词）

## 一页版目的

- 只覆盖最常见的 10 类"从 Python/SQL 到 SPL"的迁移模式。
- 用最少上下文，快速把需求翻译成可执行 SPL 思路。

## 复制即用提示词

```text
你是 SPL 迁移助手。请把我的需求转换成 SPL 写法，并按下面格式输出：
1) 先给出 SPL 结果（可直接执行）
2) 再给出 Python/Pandas 或 SQL 对照
3) 明确说明使用了哪些 SPL 语法特性（@ 选项 / ; 分组 / : 配对 / ~ 占位符）
4) 给出 1 条边界条件提醒（空值、排序稳定性、分组后字段名等）

请优先用这 10 类迁移模式进行匹配：
M1 过滤：A.select(cond)
M2 排序：A.sort(F1,-F2)
M3 分组聚合：A.groups(K;aggExpr:NewName)
M4 TopN：A.top(-N;Metric)
M5 去重：A.id()/A.group@1(...)
M6 位置/检索：A.pos()/A.pos@a()
M7 条件映射：if(c1:r1,c2:r2,rd)
M8 映射替换：A.switch(K,Map:V;...)
M9 日期间隔：interval()/interval@y()/interval@m()
M10 链式处理：A.xxx(...).yyy(...).zzz(...)

如果需求不在 Top10 里，也要先给最接近模式，再给补充写法。
```

## Top 10 迁移模式速查

| 模式 | SPL 模板 | Python/Pandas 对照 | SQL 对照 |
| --- | --- | --- | --- |
| M1 过滤 | `A.select(cond)` | `df.query(...)` / 布尔筛选 | `WHERE ...` |
| M2 排序 | `A.sort(F1,-F2)` | `sort_values([F1,F2], ascending=[True,False])` | `ORDER BY F1 ASC, F2 DESC` |
| M3 分组聚合 | `A.groups(K;sum(V):S,count(~):C)` | `groupby(K).agg(...)` | `GROUP BY K` + 聚合 |
| M4 TopN | `A.top(-N;Metric)` | `nlargest(N, Metric)` | `ORDER BY Metric DESC LIMIT N` |
| M5 去重 | `A.id(F)` | `drop_duplicates(F)` | `SELECT DISTINCT F` |
| M6 检索位置 | `A.pos(x)` / `A.pos@a(x)` | `next(...)` / 列表推导 | `LIMIT 1` / 全量 |
| M7 条件映射 | `if(c1:r1,c2:r2,rd)` | `np.select` / `if-elif-else` | `CASE WHEN ...` |
| M8 键值映射 | `A.switch(K,T:V)` | `map` / `merge` | `JOIN` |
| M9 日期间隔 | `interval@y(A,B)` | 日期差并换算 | `DATEDIFF(...)` |
| M10 链式管道 | `A.f1(...).f2(...).f3(...)` | `df.pipe(...).assign(...)` | CTE 多段 |

## 快速阅读规则

1. 先看 `@`：函数模式是什么
2. 再按 `;`：参数分了哪些角色组
3. 组内看 `,`：普通参数
4. 最后看 `:`：配对绑定参数

## 常见坑（最短版）

- `@a` 与 `@1` 常互斥，不要同时用。
- `:` 是配对，不等同于统一"命名参数"。
- `groups(...;...)` 后字段名建议显式命名，避免后续引用歧义。
