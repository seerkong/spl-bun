# Mission: 旧移植缺口与报表优先路线

终点: 以 esProc、当前实现、自有基础库和历史轨迹为证据，明确剩余移植能力与报表优先的顺序执行路线。

本文件是期望态权威；状态见 [loop.md](loop.md)，证据见 [evidence.md](evidence.md)。

## Attractors

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 质量 | [attractors/source-evidence.md](attractors/source-evidence.md) | 来源、目标与完成声明的可追溯关系 | 计划 / 决策 / 校验 | 1 |

## Notes

- 每轮加载 skill：cdmt-mission-lite、depa-expert。
- 命名候选：legacy-port-gap-audit、porting-baseline、report-first-porting-map；选择首项，突出本 mission 的证据终点。
- 源头库存：esProc 计算与数据能力、nop-report Excel 报表内核、历史 codument 轨迹。
- 需要改造：由独立 inventory 的实际差距与依赖能力决定。
- 最终暴露：继续采用网页表格与 Kon/flow，报表入口只暴露 Excel 模板渲染；不把源头全部 Java 类自动变成 API。
- 全部命令在仓库根本地执行，只读源头仓库。

## 期望结果

- 期望-1: 三主题证据盘点有可定位源头与当前代码，区分已做、缺失、部分完成、已外迁和范围外。
- 期望-2: DEPA 边界与顺序 mission 建议覆盖可行动缺口及暂不移植的理由，Excel 报表优先。

## 约束

- 约束-1: 来源判断满足 AT1，不能用归档标签代替实际代码与实测。
- 约束-2: codument 只读，保留既有工作区改动；新状态只用 cdmt-mission-lite。
- 约束-3: nop-entropy 仅抽取 Excel 模板报表语义，不引入企业应用平台。

## Acceptance

- [x] 期望-1、约束-1 → `test -s .depa-analysis/porting-2026-10-22/inventory/esproc.md && test -s .depa-analysis/porting-2026-10-22/inventory/nop-report.md && test -s .depa-analysis/porting-2026-10-22/inventory/runtime.md` → 三份取证报告存在；独立重读来源确认结论有定位（只读）。
- [x] 期望-2、约束-3 → `test -s .depa-analysis/porting-2026-10-22/report/current-state.md && test -s .depa-analysis/porting-2026-10-22/recommendations/order.md` → 收敛报告与顺序路线存在；逐项检查最终暴露不包含企业平台（只读）。
- [x] 约束-2 → `test "$(git diff -- codument | shasum -a 256 | cut -d ' ' -f 1)" = 7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049 && test "$(git ls-files --others --exclude-standard codument | shasum -a 256 | cut -d ' ' -f 1)" = 1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e` → codument 差异与初始基线完全一致（只读负向检查）。

## 范围外

- 本 mission 不编写业务代码；后续实现由各自独立 mission 承接。
- nop-entropy 企业框架、已外迁领域、Java Excel 计算格 UI。
