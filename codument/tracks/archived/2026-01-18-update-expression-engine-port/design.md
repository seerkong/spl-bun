## 上下文
- 本 track 需继续迁移 Java `com.scudata.expression` 到 Bun/TypeScript。
- 目标是补齐聚合生命周期（含 regather/finish）与 IO/表函数缺口，并保持与 Java 结果一致。
- 参考缺口：`doc/brainstorm/port-expression-engine/act_1/feature-diff-20260116.md`。

## 方案概览
1. 聚合生命周期完善
  - 识别 Java 聚合的 regather/finish 语义与触发条件
  - 在 TS Gather/aggregateWithGather 中补齐多阶段逻辑
  - 覆盖高级聚合与窗口相关的缺口
2. IO 与表/记录函数补齐
  - 基于 Java FunctionLib/MemberFunction 注册表映射缺失函数
  - 分阶段实现 IO（DB/File/Cursor）与表/记录成员函数
3. 验证与差异追踪
  - 新增单元与集成测试覆盖新功能
  - 测试通过后生成 act_2 diff/summary 文档（yyyyMMdd_HHmm）
  - 发现新缺口，追加到本 track 的 plan.xml

## 影响范围与修改点（Impact）
- 受影响的文件/模块：
  - `packages/expression/src/*`（函数库、成员函数、类型系统、评估器）
  - `packages/core/src/gather.ts`、`packages/core/src/dataset.ts`
  - `packages/spl-flow/src/index.ts`（如涉及 IO 解析/执行）
  - 测试与文档目录

## 决策
- 决策：优先补齐聚合生命周期与高级聚合，再实现 IO/表函数，避免一次性扩展过大。
- 考虑的替代方案：
  - 先做 IO/表函数再补齐聚合生命周期（否，偏离 prologue 要求）。

## 风险 / 权衡
- 风险：Java 与 TS 行为细节差异可能导致结果不一致。
  - 缓解：针对差异点补充测试与对比样例。

## 兼容性设计
- 本 track 只要求结果一致，不强制错误信息文本一致。

## 迁移计划
- 分阶段补齐聚合生命周期 → IO/表函数 → 测试与差异文档。

## 待解决问题
- Java 侧高级聚合与 IO/表函数的优先级清单细化。
