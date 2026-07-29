# Proposal: temporal organization context bundle

## 背景

Mission G2 已把 day timeline、双时间 predicate、system recordedAt 与 read-only effect guard 提升为公共 contract/runtime 能力。G3 需要用这些能力建立一个真实的关系型组织管理与调整 DomainContext bundle，而不是把 Cozo 的通用边表或 validity 存储机制照搬进 depa ORM。

现有 `depa-data-domain-context-bundles` 已提供 immutable catalog/seed/bindings/probes、完整 preset request、operation-ref registry 与每请求 fresh SQLite。新组织域必须沿用这套 app bundle authority，并继续遵循 Property-first Kon 建模。

## 变更内容

- 新增独立 `organization-adjustment` bundle 模块及公开 package-root exports，但本 track 不接入 production server registration。
- 建模 `OrganizationUnit`、`OrganizationUnitVersion`、`Person`、`OrganizationHierarchyPeriod`、`PersonAssignmentPeriod`、`OrganizationAdjustment`、`OrganizationAdjustmentItem` 与 `OrganizationChangeEvent`。
- 关系只在 typed Property 上声明；`...Id` Field 仅保留平坦物理列配置。
- 以 deterministic seed 提供 `2025-06-30` 与 `2025-07-01` 边界前后的单位版本、层级和人员主任职事实，以及 DRAFT/VALIDATED/APPROVED/APPLIED/invalid adjustments。
- 实现 snapshot/history/compare/preview/validate/mark-validated/approve/apply/transfer-batch operation 与完整 presets/probes。
- 私有 `OrganizationAdjustmentWriter` 是 bundle 内唯一 `context.write` 调用者；apply 在 outer transaction 内重验并原子写 temporal replacements、audit event 与 adjustment status。
- 为 runtime 补充公开 `DomainOperationExecutionError` 边界，使可信 handler 的业务约束 code/path 不被压平为通用 execution failure，同时仍由 runtime 事务回滚。
- 验证 hierarchy cycle、missing target、primary assignment overlap、非法状态、rollback、atomic/best-effort batch 和 fresh isolation。

## 影响范围

- `packages/domain-context-bundles/src/index.ts`
- `packages/domain-context-bundles/src/organization-adjustment.ts`（新增）
- `packages/domain-context-bundles/__tests__/organization-*.test.ts`（新增）
- `packages/domain-context-bundles/__tests__/package-boundary.test.ts`
- `packages/depa-orm-domain-runtime/src/index.ts`
- `packages/depa-orm-domain-runtime/__tests__/temporal-runtime.test.ts`
- `codument/behaviors/domain-context-reference-bundles.xml`（归档时由 delta 提升）
- `codument/behaviors/depa-orm-domain-runtime.xml`（归档时由 delta 提升）

不修改 `packages/web-server`、`packages/web-ide`、`packages/depa-orm-capsule` 或外部参考项目。生产 registration、HTTP 和 UI 属于 mission G4。
