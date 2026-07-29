# Evidence: 报表公式求值与依赖

- F0 — 恢复观察 — 2026-10-22 — 上一批五 mission 归档；旧 codument diff/untracked 双 SHA256 与原始基线一致；当前没有改动任何业务文件。三主题 inventory 已按 skill 协议恢复。
- F1 — 来源收敛 — formula-inventory.md 的 F01–F12/N01–N12 与源码路径可读；原生/层次来源分别建模，明确改进 absolute查错名称与循环半成品两个源缺陷。`bun test` 基线339 pass / 0 fail / 864 expects / 57files。
- F2 — 实例/公式窄回归 — `bun test packages/report-logic packages/report-xlsx-support` — exit0 — 26 pass/97 expects；含组内30/15、全局45、过滤25、二维20、前向9、循环路径、基数错误、rank/proportion/prefix，财务17行的2003首月3100及最终4100。
- F3 — 输出投影 — 同上 — exit0 — 原生明细f+v=20/12、footer32、字符串OK缓存真实XLSX回读；HTML格式20.00；未知函数及依赖同标uncomputed；report-mode导出SUM(A1)+A4等并保留4/5/6当前值。
- F4 — 证据调和 — COUNTIF对非数字按源字典序比较，混合[1,3,"x",false]与>=2得到3，修正初始oracle1；标量展开item曾为空，修scope后Q04通过。完整父格关联补进compiled contract，避免只靠展开祖先丢普通parent。ACCSUM确定prefix、完整通配符、源缺陷修复均登记roadmap兼容决策。
- F5 — 边界与结构 — 最终窄回归27 pass/101 expects；包含cellSet下标/空集与null/宏短路、Number-only聚合、NaN→XLSX错误码36/HTML #NUM!，未知依赖无伪值。simplify只整理本次新增嵌套条件，未变语义；parent查找按绑定路径建索引，避免逐格全表扫描。
- F6 — 最终构建/排除集 — `bun run build` exit0（13包）；纯logic IO/eval负向检查、codument双哈希原样比较、`git diff --check`均exit0。已重读MISSION/吸引子和实现，默认Excel复制与report selector分别有反例；完整Java cellSet API和剩余表格能力继续在后续总验收核对，不冒称全平台兼容。

- F7 — 最终整仓重观察 — `bun test` exit0：350 pass/0 fail/909 expects/58 files；最终业务源码root build exit0。再次重读目标/吸引子与实际产物，所有本mission承诺均有反例和结果，未完成的总路线继续推进。
