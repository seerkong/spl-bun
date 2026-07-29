# Evidence: SPL成员表达式与参数上下文

- E1 — 2026-10-23：对照 Variant、旧迁移记录和公开入口定位差异；源与历史只读。

- E2 — 2026-10-23T03:04:49.754Z：成员AST/外部作用域/顺序alias、cursor惰性映射、排序合并与嵌套Kon守卫已实现；网页发现的表值到native word缺口已修复。相关398 pass/1254 expects/66 files，全量445 pass/1562 expects/81 files，13包构建通过，隔离浏览器17 passed。日志 .tmp-context-{related,all,build,e2e}.log。重新对照原始用户请求/来源与实际 public API，无未验收节点。
- E3 — 全部 Acceptance 命令在最终业务基线 exit 0；负向类型/字段/输入不变、核心无 IO/eval 与 Codument 两项哈希匹配。
