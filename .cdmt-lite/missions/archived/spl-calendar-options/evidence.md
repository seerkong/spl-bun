# Evidence: SPL日历与日期选项

- E1 — 2026-10-23：对照 Variant、旧迁移记录和公开入口定位差异；源与历史只读。

- E2 — 2026-10-23T02:26:12.996Z：calendar共享实现与所有公开入口完成；相关319 pass/971 expects/44 files，全量436 pass/1511 expects/80 files，13包构建通过；实际Java方法在3个时区共4728项数值一致并验证BigDecimal。日志 .tmp-calendar-{related,all,build}.log。重新对照原始用户请求/来源与实际 public API，无未验收节点。
- E3 — 全部 Acceptance 命令在最终业务基线 exit 0；负向类型/字段/输入不变、核心无 IO/eval 与 Codument 两项哈希匹配。
