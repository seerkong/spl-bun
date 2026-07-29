# Reference Alignment

## depa-ontology.ts org-timeline

参考 demo 使用 Department、Employee、Team 与 temporal `belongs_to`/`manages` 关系，按多个时间点 link/unlink，并提供 snapshot、headcount 和 entity timeline query。可继承的思想：

- identity 与随时间变化的关系分开；
- as-of snapshot 是一等查询；
- 同一关系可沿时间发生多次变化；
- timeline/history 与当前邻接查询并列。

本 mission 的完善点：

- 传统关系数据库 typed tables，而非通用 ontology edge relation；
- business valid time 与 system recorded time 分离；
- 组织调整作为 draft/validate/approve/apply aggregate；
- cycle、overlap、single-primary-assignment 等组织约束；
- atomic/best-effort、统一 Operation API、完整 preset 与 Workbench evidence。

## CozoDB validity

Cozo 核心把 `ValidityTs(Reverse<i64>)` 与 assert flag 放在 validity key 中，存储 scan 根据 `valid_at` 选择目标时间前最新版本，retraction 控制可见性。depa-ontology 的 `getNeighborsAsOf` 使用 relation `@ $as_of`，edge history 则读取 validity 与 transaction time。

关系库转换只保留可观察语义：

| Cozo | 本 mission |
| --- | --- |
| validity timestamp + assert/retract | explicit `[validFrom, validTo)` |
| latest key at `valid_at` | indexed interval predicate |
| transaction time in relation history | `[recordedFrom, recordedTo)` + execution recordedAt |
| temporal generic edge | typed hierarchy/assignment period tables |
| engine-enforced visibility | domain validator + SQL predicate + transaction |

不复制的部分：reverse key encoding、microsecond business precision、Datalog `@ timestamp` grammar、storage-engine skip scan 和通用 ontology EAV schema。

## Existing Host Workbench

Host 现有稳定约束继续成立：

- Operation 用 owner/behavior/subject/invocation/effect 五维；timeline 不扩张 identity 枚举。
- Preset 保存完整 request，definition/binding/server/request 分别拥有静态、实际、环境和本次选择事实。
- 每个 execute request 使用 fresh seeded SQLite 并完整 destroy。
- Runtime 只依赖 depa ORM public package roots。
- Production server 组合 trusted registrations；UI 只依赖 public DTO/client。
- Kon model relation metadata 只在 typed Property，Field 只保存物理列信息。

这些约束优先于参考项目的 demo 便利写法；发现冲突时由本 mission 写 replan evidence，不直接把参考实现当规范。
