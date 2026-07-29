# 变更：增加天级 Timeline Operation 契约与运行时边界

## 背景和动机

组织调整 mission 需要 as-of、effective-on、range 与系统记录时间，但当前标准 request 没有顶层时间上下文，runtime query 也只有 equality `where`。若把日期塞进任意 payload 并由组织 handler 在内存过滤，会形成领域特例、影子契约和不可扩展的全表读取。

## 目标

- Additive 扩展 `ExecuteOperationRequest` 与 `OperationDefinition`，表达 day timeline。
- Exact parser 验证 closed shape、真实日历日、range 和 recordedAt；catalog matcher 在 runtime allocation 前校验 required/mode/granularity。
- 扩展 trusted `RuntimeQuery`，以封闭 predicate AST 投影 depa ORM public SQL AST。
- Runtime 每次 execution 捕获一个 system-owned `recordedAt` 并传给 parent/child handlers。
- `effect=read-only` 的 handler 调用 write 时 fail closed 并保证事务零提交。

## 非目标

- 不实现组织 BO、调整状态机、时间事实表、event 或 UI。
- 不把 predicate AST 暴露为 HTTP query language。
- 不支持 raw SQL、任意函数、join、subquery、order/paging 或 sub-day business time。
- 不改变五维 Operation identity、fresh DB lifecycle、atomicity intersection 或 response envelope。

## 变更范围

- `packages/domain-operation-contracts/src` 与 request/catalog tests。
- `packages/depa-orm-domain-runtime/src` 与 query/lifecycle/transaction tests。
- 对应 behavior deltas 和 Codument evidence。

## 成功判据

- Timeline positive/negative contract cases 全部通过，旧 requests 无需 timeline。
- Predicate 只支持 scalar comparison、null、AND/OR；所有值走 `Literal`，无 SQL 拼接。
- 双时间半开 predicate 可被 public AST 精确表达。
- Recorded clock 每 execution 调用一次，child 共享，request 不可控制。
- Read-only write 返回稳定 diagnostic，before/after 相同且 committed none。
- 规划前实际运行的 315 个 affected-package baseline tests 与新增测试全部通过；相关 build/import guards 通过。
