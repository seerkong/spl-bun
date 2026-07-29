# Loop: 旧移植缺口与报表优先路线

Status: completed
Round: 2

恢复时读取 cdmt-mission-lite、depa-expert，按连续执行与返回条件运行。
期望态：[MISSION.md](MISSION.md)。证据：[evidence.md](evidence.md)。

## Work graph

### 独立盘点三个参照面

- Status: done
- After: none
- Covers: 期望-1, 约束-1, 约束-2, 约束-3
- Verify: `test -s .depa-analysis/porting-2026-10-22/inventory/esproc.md && test -s .depa-analysis/porting-2026-10-22/inventory/nop-report.md && test -s .depa-analysis/porting-2026-10-22/inventory/runtime.md` → 三主题来源证据可读。
- Done when:
  - 三个 fresh inventory 产出实际能力与边界，不修改业务代码。

### 收敛边界与顺序路线

- Status: done
- After: 独立盘点三个参照面
- Covers: 期望-2, 约束-1, 约束-3
- Verify: `test -s .depa-analysis/porting-2026-10-22/recommendations/order.md` → 路线含依赖、验收与非目标。
- Done when:
  - 各 inventory 差距有处置或范围理由，后续 mission 有完整 harness。

### 重观察与归档

- Status: done
- After: 收敛边界与顺序路线
- Covers: 期望-1, 期望-2, 约束-1, 约束-2, 约束-3
- Verify: `test -s .depa-analysis/porting-2026-10-22/report/current-state.md` → 报告与来源重观察一致。
- Done when:
  - 所有 Acceptance 命令和负向检查通过，completion 及 archived 闸门通过。

## 尚未看清

- 无。已完成 90 行能力/边界取证，21 项 RISK。

## Actual state

- 工作区已有 691 个文件的用户差异，包含业务领域外迁；没有重置或恢复。
- Weaver config 按 Git 根命中 `/Users/kongweixian/infra-dev/**` 排除，本任务该根不调用 recorder。
- 三个 inventory 子代理由 depa-expert 的 inventory 明确指示并行取证。

## Last action

- 初始化分析工作区并派出三个独立主题。

## Next

- 本 mission 验收通过后归档，直接激活 excel-template-report-kernel。

## Decisions and replans

- 用户明确选择 cdmt-mission-lite，旧 codument 只读，覆盖旧工作流的新增 track 要求。
