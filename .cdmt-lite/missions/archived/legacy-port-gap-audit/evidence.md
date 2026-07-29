# Evidence: 旧移植缺口与报表优先路线

- E0 — 初始基线 — `git diff -- codument | shasum -a 256` — exit 0 — 2026-10-22；SHA256 7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049。未跟踪 codument 路径列表 SHA256 1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e。

- E1 — 三主题盘点 — 三份报告 test -s — exit 0 — 2026-10-22；90 行，21 RISK；runtime 实测 bun test 306 pass、noEmit 和十包 build 全过。
- E2 — 来源重观察 — 重新读取 EnableSplDsl、DataSet group/window、XptModelLoader 和 DynamicReportDataSet 关键路径 — exit 0 — 2026-10-22；确认入口缺口、键与累计问题、同源交集语义。
- E3 — 顺序路线和负向边界 — 所有 Acceptance 文件检查与 codument 双 SHA256 检查 — exit 0 — 2026-10-22；无企业平台纳入最终暴露，无 codument 新写入；四个后续完整 harness 已建立。
