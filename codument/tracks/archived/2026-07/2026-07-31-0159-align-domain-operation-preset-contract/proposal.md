# 变更：对齐 Domain Operation preset 与标准请求契约

## 背景和动机 (Context And Why)

外部 latest-only ontology XML 规范已经把 `InvocationPreset/RequestJson` 冻结为完整的 `ExecuteOperationRequest v1`，并区分了三层能力事实：

- Operation definition 声明本操作可请求的 capability set；
- RuntimeBinding 声明实际实现支持的 capability set；
- request 的 `execution` 选择本次调用使用的 atomicity 与 observations。

当前 `depa-data-domain-operation-contracts` 仍把 preset 拆成 `subject/payload/execution` 影子字段，Operation definition 缺少静态 `verb`，capability requirement 允许缺省和开放字段，request parser 也没有递归拒绝未知字段。这会破坏“Preview JSON 就是可原样 POST 的对象”以及 XML/host 共用一套 HTTP 语义的目标。

## "要做"和"不做" (Goals / Non-Goals)

**目标:**

- 让 `OperationPresetDto.request` 直接保存完整 `ExecuteOperationRequest v1`，外层只保留 catalog link 和展示 metadata。
- 为 Operation definition 增加稳定 `verb` 和必填 requestable capability set。
- 递归关闭 request envelope；只有业务 `payload` 和 filter selector 的 `where` 保持任意 JSON。
- 固定 ownerRef 条件、duplicate observation、selection/batch、verb 和 capability subset 规则。
- 提供 preset/catalog 纯一致性校验，不引入 runtime 或 transport 依赖。

**非目标:**

- 不实现 RuntimeBinding、current-server capability negotiation 或执行器。
- 不修改 server、IDE、bundle runtime 或 ontology XML validator。
- 不保留旧 preset 影子字段或含糊的 capability requirement 兼容层。
- 不触碰 `packages/depa-orm-capsule/`。

## 变更内容（What Changes）

- **BREAKING** `OperationPresetDto` 改为 `{ key, title?, operationRef, request, metadata? }`。
- **BREAKING** `OperationDefinition` 增加必填 `verb` 和必填 requestable `capabilities`。
- **BREAKING** 移除可选、开放的 `OperationCapabilityRequirementDto`，以闭合 capability set DTO 替代。
- `parseExecuteOperationRequest` 增加递归 exact-key、ownerRef 条件和 duplicate observation 校验。
- `validateOperationCatalogMatch` 增加 apiVersion、verb、requestable capability 和同构 batch item 校验。
- 新增 `validateOperationPresetCatalogMatch`，校验 preset 外层 link、完整 request 与 catalog definition 的一致性。

## 影响范围（Impact）

- 受影响的能力（behaviors）：`domain-operation-contracts/operation-catalog`、`domain-operation-contracts/execute-request`
- 受影响的代码：`packages/domain-operation-contracts/src/index.ts` 及其 request/response contract tests
- 已检索到的生产下游：无；当前引用仅位于该 package 及其测试，因此不引入过渡别名
