# Evidence: 序表正确性与 Kon 窗口计算

- D1 — 类型化键与公开路径一致 — `bun test packages/expression packages/core packages/kon-spl-dsl` — exit 0 — 233 pass / 0 fail / 523 expects / 27 files。core semantic-regressions 与 Kon window 测试实际覆盖分隔符碰撞、1/"1"、大小写、null/undefined、Date peers、稀疏列关联、别名冲突和输入不变；成员 group/join 与 core 共用 tuple-index，不再各自串化。
- D2 — 窗口累计与作用域 — 同上 — exit 0 — 两行 sum(a)=[10,30]、avg(b)=[100,150]；带 scope 的独立表达式结果 [20,101]/[60,151]；分区、rank/denseRank、空 schema、输出别名冲突与跨调用隔离通过。
- D3 — Kon 产品入口 — `bun run test:e2e` — exit 0 — 14 passed / 23.1s。新增 Window demo 经网页真实执行，当前结果有 rn/rank/denseRank 及不同列累计 sum/avg；保留 33 个既有 demo 并新增一个。上传、模板下载、渲染及 XLSX 独立重读、手机布局、过期响应失效等用例继续通过。
- D4 — 最宽相关回归 — `bun test` — exit 0 — 339 pass / 0 fail / 864 expects / 57 files。`bun run build` — exit 0 — 13 包全部完成。
- D5 — 排除集重观察 — report-logic 与 tuple-index 无 node:fs/Bun.file/new Function/eval；core/member 无旧字符串键实现；`git diff --check` exit 0；codument diff SHA256=7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049，untracked 清单 SHA256=1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e，均与原基线一致。未修改外部 Java 与基础库。
- D6 — 验收逐条重跑 — `bun test packages/core packages/kon-spl-dsl packages/web-server` — exit 0 — 177 pass / 390 expects / 20 files；expression/core/Kon 233 pass；IDE/server/Kon 与三报表包 typecheck 全过；报表回归16 pass / 56 expects。MISSION 中的纯逻辑负向命令与 codument 双哈希比较原样执行，exit 0。
- D7 — 最终产品重观察 — ego-browser task69/p1 从界面选择 Window 示例并真实执行 Done(25 rows)，前两行 running_amount=1200.5/1980.5、mean_sale_id=1/5.5，独立列累计成立。首次按缩略 label 选择失败，改用页面实际 option value 后通过；未修改业务代码。TaskSpace 已 finish({keep:[]}) 完成。
- D8 — 交付边界复核 — 逐条重读 MISSION / attractor、tuple-index、core window、原生 word 与反例；当前期望全部满足，排除集无命中。实现前报告保留，新增 report/delivery-2026-10-22.md 汇总结果，未将 cursor/完整公式/动态 sheet 等剩余能力宣称完成。
- D9 — 结构完成闸门 — `check_mission .../active/dataset-semantics-and-kon-window --phase completion` — exit 0；所有工作节点 done，五条 Acceptance 勾选且分别有最终工作区的行为或负向证据，随后整体转归档。
