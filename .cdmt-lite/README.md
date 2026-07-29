# 移植续作

本目录承载本次用户授权的 cdmt-mission-lite missions；旧 codument 是只读历史证据。

来源与路线见 [分析报告](../.depa-analysis/porting-2026-10-22/report/current-state.md) 和 [顺序](../.depa-analysis/porting-2026-10-22/recommendations/order.md)。每个 mission 的 MISSION 是期望态，loop 是执行状态，evidence 是只追加证据；本文件不重复维护状态。

按名称在 `missions/active/`、`pending/`、`archived/` 查找：legacy-port-gap-audit → excel-template-report-kernel → report-groups-and-cross-tables → web-table-report-workbench → dataset-semantics-and-kon-window。

实际交付与最终验证见 [交付记录](../.depa-analysis/porting-2026-10-22/report/delivery-2026-10-22.md)；尚未移植的源头能力见 [剩余缺口](../.depa-analysis/porting-2026-10-22/recommendations/backlog.md)。

用户后续已要求持续推进表格报表全部差距，再补SPL查询计算；新路线与来源映射见 [对齐路线](../.depa-analysis/report-parity-2026-10-22/roadmap.md)。上一批交付记录是历史快照，不能作为本次停止点。

本次连续九个mission的最终实现与验收见[表格报表和SPL交付](../.depa-analysis/report-parity-2026-10-22/delivery.md)。来源能力、目标语言适配与运行证据分别索引在报表/SPL矩阵，生命周期仍以对应mission harness为准。

后续scalar、calendar、member-context、window、formatting及排序/parse的来源与旧承诺重评见[兼容边界续作对账](../.depa-analysis/spl-compatibility-2026-10-23/acceptance-matrix.md)。formatting和排序的已准入独立Review及历史收据保留。`spl-parse-conversion`最终由原run graph8的Verify7/Review7核销，归档条件复测与证据见[归档mission](missions/archived/spl-parse-conversion/MISSION.md)及其`verification/closeout-20261024/accepted-review.json`；本索引不代替mission生命周期或正式运行事实。实际实现generation6、命令与lineage仍见[原实现收据](runs/holarchy-0e32cd3d67d631730d42c305c551dfec1614/implement-6/run-context.json)。
