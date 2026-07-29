# Evidence: SPL表达式与多键稳定排序

- E1 — 2026-10-24：continuationDirective明确接纳；harness先于业务写入。共享授权/命令证据在 .cdmt-lite/runs/holarchy-0e32cd3d67d631730d42c305c551dfec1614/implement-5/。

- E2 — 2026-10-24 current_verification：共享实现及Expression/Kon/Flow三入口断言；80项实际Java源码对照通过，窄stub及源码SHA256见verification脚本与当前generation5的oracle日志。输入是事实，结果/键缓存/解析值为单向派生；不写外部Java或旧Codument。
- E3 — 2026-10-24 current_verification：当前业务基线相关429 pass/1538 expects/74 files，全量476 pass/1846 expects/89 files，13包build，112 Formatter，17 E2E（18.8s）通过。新网页断言含精确parse、数字前缀和降序。完整命令/exit/log/hash、Codument与纯核心负向、变更及旧收据保留清单见`.cdmt-lite/runs/holarchy-0e32cd3d67d631730d42c305c551dfec1614/implement-5/`的checks.json、final-worktree.json和preservation.json。
- E4 — 2026-10-24 authority/current_observation：候选接纳来自人类continuationDirective；实际command为implement generation5、node_revision6-user-continuation-20261024、graph revision6。原baseline-review gen3与gap-review gen3/hash bd8521f450c40da6b0b56f028df4abbe1874f8e4f91b718ea6c987d0f0162515保留，见run-context.json。独立Review尚未核销本mission，故不勾选最后验收项、不归档；按当前Implement节点合同交回原workflow。

- E5 — 2026-10-24 current_verification：按MISSION第一条原命令重跑`bun test packages/expression/__tests__/sort-semantics.test.ts packages/kon-spl-dsl packages/spl-flow`，exit0，229 pass/626 expects/39 files；日志sort-focused.log，最终checks和evidence-hashes收录。全局git diff --check仍有本轮未改的gather.ts:219既有EOF空行；该文件基线与当前SHA256一致，本轮实际修改的tracked路径diff检查exit0。

- E6 — 2026-10-24 independent_review/current_verification：已准入gap-review generation5/hash=3704820b20202e14ccc16e1f5adca2f5dfb45664b50693dc5e808dc540517de3明确支持关闭原CANDIDATE-sort及G5。generation6按最终基线重跑排序专项231 pass/776 expects/39 files，相关432、全量479、13包build、80项实际Java排序、112 Formatter及17 E2E（17.9s）通过；纯核心扫描和旧Codument保护哈希保持。Review原文、日志及指纹保留在implement-6，排序源码本轮未改，parse由另一个mission继续，非实施者自批全局完成。
