# 表格、报表与后续 SPL 对齐

- Target: `/Users/kongweixian/infra-dev/spl-bun`
- References: 本地 nop-report / nop-excel、esProc、当前源码与旧 codument（只读）
- Scope: package / module；Depth: standard
- Authorization: 用户要求持续实施至表格报表能力对齐，然后补 SPL 查询计算缺口；不扩展企业平台，不停在规划阶段。
- Authority: 本文件仅记录分析；新执行状态仍归 `.cdmt-lite/missions/`，不改旧轨迹和外部仓库。

| 环节 | 状态 | 产出 |
|---|---|---|
| 范围与事实边界 | done | 不可变输入→派生输出，cursor与run资源单owner，效果在support/宿主 |
| 公式来源盘点 | done | formula-inventory.md；19函数及层次/过滤/导出证据，12 RISK |
| 动态 sheet 与剩余报表盘点 | done | report-inventory.md；26能力，14 RISK |
| 后续 SPL 缺口盘点 | done | spl-inventory.md；22能力，11 RISK |
| 目标收敛与顺序 | done | roadmap.md |
| 交付与重观察 | done | delivery.md、acceptance-matrix.md、spl-acceptance-matrix.md |

## 当前状态

最初339测试是本批取证基线。三主题盘点后，按roadmap顺序完成九个mission；最终426测试/13包构建/16项E2E与百万行验证详见[交付](delivery.md)。执行生命周期仍只在各mission loop；本文件是分析索引。用户外迁工作区改动未重置。

## 未知

- 原未知项已用源码、规范化fixtures、真实XLSX/HTML与浏览器逐项定界并验证。明确语言/格式/Java数值边界见两份最终矩阵，不将未知包装为PASS。
- Excel模板与HTML/XLSX是用户范围；企业平台与独立PDF/Word不扩入。
