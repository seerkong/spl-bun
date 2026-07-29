# Temporal Relational Model

## 两条时间轴

组织领域同时区分：

| 时间轴 | 语义 | 精度 | 客户端是否可指定 |
| --- | --- | --- | --- |
| valid time | 组织事实在哪些业务日期成立 | day | 是，通过 `timeline` |
| recorded time | 该事实版本何时进入/退出系统知识 | UTC instant | query 可选，write 由 runtime 提供 |

业务日期使用严格 `YYYY-MM-DD`，不得接受时间、时区、`YYYY-MM`、不存在的日期或非零填充形式。系统记录时间使用 ISO 8601 UTC instant；一次 operation execution 捕获一个稳定 `recordedAt`，同一事务内所有 replacement/event 共享它。

## 半开区间

所有类型化时间事实都包含：

```text
validFrom     inclusive business day
validTo       exclusive business day, null = +infinity
recordedFrom  inclusive system instant
recordedTo    exclusive system instant, null = +infinity
```

某 row 在 `(asOf, recordedAt)` 可见，当且仅当：

```text
validFrom <= asOf
AND (validTo IS NULL OR asOf < validTo)
AND recordedFrom <= recordedAt
AND (recordedTo IS NULL OR recordedAt < recordedTo)
```

`recordedAt` 缺省时只读 `recordedTo IS NULL` 的当前系统知识。ISO 日字符串的字典顺序只有在 strict parser 已证明 canonical 后才可用作 SQL 比较。

## 事实版本化

时间事实禁止 delete。修订一个当前系统版本时：

1. 找到 `recordedTo IS NULL` 的当前 row；
2. 校验 replacement 集在 valid time 上不重叠且完整表达目标变化；
3. 把旧 row 的 `recordedTo` 设置为 execution `recordedAt`；
4. 插入一个或多个 `recordedFrom=recordedAt, recordedTo=null` 的 replacement rows；
5. 在同一事务追加对应 `OrganizationChangeEvent` audit row。

这不是 event sourcing。Temporal fact rows 是已应用事实的查询/历史 authority；audit event 只回答谁在何时通过哪个 adjustment 产生了哪类变化，不参与 live state fold 或事实重建。

## 关系表

本 mission 使用类型化关系表，不使用通用 EAV temporal relation primitive：

- `OrganizationUnitVersion`：单位名称、类型、状态等随 valid time 变化的属性。
- `OrganizationHierarchyPeriod`：child unit 到 parent unit 的有向期间关系。
- `PersonAssignmentPeriod`：person 到 organization unit 的任职期间，含 role、manager、allocation、primary flag。

稳定 identity 留在 `OrganizationUnit` 与 `Person`。关系 authority 由这些 BO 上的 typed navigation Property 声明，期间表中的 `unitId/personId/parentUnitId` 只承担物理 join column。

## Cozo 语义转换

Cozo validity 把 timestamp 与 assert/retract 作为 key 的最后部分，并在 scan 时选择指定 `valid_at` 之前的最新 assertion/retraction。关系库版本不复制 storage-key 或 scan 算法，而采用：

- assertion/retraction 的可见性思想 -> 显式 valid interval；
- `@ timestamp` as-of -> 双轴 SQL predicate；
- transaction-time trace -> recorded interval + adjustment/event audit；
- engine-level validity -> domain-owned typed tables + constraints + transaction。

## 边界与索引

目标 schema 至少为每类时间事实准备以下逻辑索引要求；SQLite demo 可由 ORM schema 能力支持的部分落地，缺失时在报告中明确：

- identity + `recordedTo`；
- identity + `validFrom` + `validTo`；
- hierarchy `childUnitId` + valid/recorded bounds；
- assignment `personId` + primary flag + valid/recorded bounds。

数据库约束负责基本非空与 identity；跨 row interval overlap、组织树 cycle、单一主任职等由 apply 前 validator 和事务内 revalidation 共同负责。
