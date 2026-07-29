# Mission: 天级组织管理与组织调整工作台

## 背景和动机

当前 workspace 已经具备可运行的 `DomainContextBundle`、完整 Operation preset、统一 HTTP execute API、每请求 fresh seeded SQLite 运行时和通用 Domain Workbench。现有参考 bundle 证明了 BO、association、lifecycle、constraint、process、selection 与 batch，但没有一个把时间轴作为顶层业务概念的关系型领域。

兄弟项目 `depa-ontology.ts` 的 org-timeline demo 证明了 Department、Employee、Team 关系可以按时间查询；CozoDB 的 validity key 证明了 assertion/retraction 与 as-of 读取的存储语义。本 mission 不复制 Cozo storage engine，而是把这些思想转化为传统关系数据库中可检查、可约束、可事务化的天级双时间模型，并用组织调整这一高时间敏感领域验证标准 app bundle 与 API。

## 目标

- 在标准 `ExecuteOperationRequest` 中增加可选顶层 `timeline`，由 Operation definition 声明所需 mode，支持天级 `as-of`、`effective-on` 与 `range`。
- 在 depa ORM domain runtime 中提供关系型时间 predicate、系统记录时间和 read-only effect guard，不把组织逻辑写入 runtime。
- 新增一个组织管理与组织调整 DomainContext app bundle，使用 Property-first Kon DSL、关系型 SQLite、确定性历史 seed、标准 catalog/operations/presets/bindings/probes。
- 建模组织单元版本、组织层级期间、人员任职期间、调整单/明细与审计事件，并区分业务有效时间、系统记录时间和工作流状态。
- 支持组织快照、事实历史、日期区间差异、调整影响预览、校验、审批、原子应用和批量人员调动。
- 通过现有 web-server routes 和 Domain Workbench 完成请求预览、时间日期调整、执行、结果/变化/诊断查看。

## 非目标

- 不修改 `depa-ontology.ts` 或 CozoDB；它们仅是设计证据。
- 不引入 Cozo assertion/retraction 存储引擎或通用 ontology runtime。
- 不改变已接受的每请求 fresh seeded SQLite 策略，不在本 mission 中建立共享持久 session。
- 不支持小时、分钟或时区化业务有效时间；业务轴固定为日。
- 不建设认证授权系统。Workbench 视为可信开发工具，`actorRef` 只用于审计。
- 不把审计事件声明为 event-sourcing/replay authority，也不从页面快照反写数据库。

## 为什么需要 Mission

该目标同时改变公共 request/catalog contract、depa ORM runtime query/effect boundary、领域关系模型、事务状态机、production bundle registration、HTTP 集成和浏览器交互。任何单独 track 都无法对双时间 authority、跨包依赖和端到端行为负责，因此 mission 只承担控制面和跨 track 编排，真实代码、行为规范与测试由三条真实 track 落地。

## 成功判据

1. 非时间 Operation request 继续通过；时间 Operation 在缺失/非法日期、未知 mode 或不匹配 definition 时，于 SQLite allocation 前返回 path-aware diagnostics。
2. 组织关系只在 typed Property 的 `orm :relation` NamedConf 上定义，外键 Field 只保存平坦列配置。
3. `2025-06-30` 与 `2025-07-01` 的组织快照存在可验证差异，history 与 range diff 从关系型时间事实派生。
4. 调整单只能按 `DRAFT -> VALIDATED -> APPROVED -> APPLIED` 推进，前三态可取消；apply 在提交前重验。
5. apply 在一个 datasource transaction 中关闭旧系统版本、写 replacement/open periods、追加 audit event 和更新状态；中途失败时 committed 为 none 且 before/after 相同。
6. 组织树无环、有效区间不重叠、每人单一主任职、目标在生效日有效等约束均有正反例。
7. 批量人员调动的 atomic 和 best-effort 语义、item mapping 与 diagnostic paths 均可验证。
8. 相同 preset 连续和并发执行从相同 seed 开始，execution id 不同且无跨请求状态泄漏。
9. 生产 server 列出新 context，GET preset request 与实际 POST body 深相等；Workbench 在 desktop/mobile 完成选择、改日期、预览、执行和错误查看。
10. 三条真实 track 均通过独立验证并归档，最终 mission gap loop 对全部 success criteria 给出客观证据。
