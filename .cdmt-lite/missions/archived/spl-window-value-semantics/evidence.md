# Evidence: SPL窗口值与相对行计算

- E1 — 2026-10-23：对照 Variant、旧迁移记录和公开入口定位差异；源与历史只读。

- E2 — 2026-10-23T03:15:50.204Z：共享纯窗口实现支持null/精确累计、lag/lead和ROWS frame，core/member/Kon一致；相关403 pass/1279 expects/67 files，全量450 pass/1587 expects/82 files，13包构建、17浏览器用例通过，实际Java Move 1743项一致；百万行CSV/SQLite RSS增量52.953/57.234MiB，open=close=1。日志 .tmp-window-{related,all,build,e2e,benchmark}.log。重新对照原始用户请求/来源与实际 public API，无未验收节点。
- E3 — 全部 Acceptance 命令在最终业务基线 exit 0；负向类型/字段/输入不变、核心无 IO/eval 与 Codument 两项哈希匹配。
