# 变更：继续迁移 Expression 引擎（聚合生命周期 + IO/表函数）

## 背景和动机 (Context And Why)
当前 TypeScript 版本的 expression 引擎仍缺少 Java 版本中的聚合生命周期完善阶段（含 regather/finish）以及 IO 与表/记录相关函数。补齐这些能力是实现 esProc 核心能力迁移的关键步骤，并直接影响数据相关 APP 的表达式兼容性。

## “要做”和“不做” (Goals / Non-Goals)
**目标:**
- 补齐聚合生命周期与高级聚合缺口，实现结果与 Java 版本一致
- 分阶段补齐 IO（DB/File/Cursor）与表/记录成员函数能力
- 补充单元与集成测试覆盖新增能力
- 测试通过后进行 Java vs TS 对比，生成 act_2 diff/summary 文档并将新发现缺口补充到 plan.xml

**非目标:**
- 不要求完全对齐错误信息文本
- 不引入与表达式引擎无关的重构或 UI 变更

## 变更内容（What Changes）
- 扩展 Gather 生命周期（含 regather/finish）并补齐高级聚合能力
- 实现缺失的 IO 与表/记录成员函数（按阶段推进）
- 增加表达式单元测试与核心集成测试
- 生成 act_2 下新的 diff 与 summary 文档（yyyyMMdd_HHmm）
- 发现新缺口时更新本 track 的 plan.xml

## 影响范围（Impact）
- 受影响的功能规范：expression 解析/执行、dataset 聚合与函数库
