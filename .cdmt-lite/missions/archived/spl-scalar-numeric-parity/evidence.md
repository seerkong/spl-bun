# Evidence: SPL标量与精确数字

- E1 — 2026-10-23：对照 Variant、旧迁移记录和公开入口定位差异；源与历史只读。

- E2 — 2026-10-23T02:18:35.425Z：标量/精确数字与JSON安全输入、聚合/键/worker输出已实现；相关385 pass/1176 expects/64 files，最终全量432 pass/1484 expects/79 files，13包构建全部通过。日志 .tmp-scalar-{related,all,build}.log。重新对照原始用户请求/来源与实际 public API，无未验收节点。
- E3 — 全部 Acceptance 命令在最终业务基线 exit 0；负向类型/字段/输入不变、核心无 IO/eval 与 Codument 两项哈希匹配。
