# Loop: SPL窗口值与相对行计算

Status: completed
Round: 3

## Work graph

### 来源与实现收敛

- Status: done
- After: none
- Covers: 期望-1, 期望-2, 约束-1, 约束-2
- Verify: `bun test packages/expression packages/core packages/kon-spl-dsl packages/spl-flow packages/report-logic` → 全部通过
- Done when: 源码实值与产品入口一致，包含负向和输入不变。

### 最终独立重观察与回归

- Status: done
- After: 来源与实现收敛
- Covers: 期望-1, 期望-2, 约束-1, 约束-2
- Verify: `bun test` 与 `bun run build` → 全部通过
- Done when: 重读原始请求、MISSION、吸引子及最终公开入口，所有验收命令在最终业务基线过线。

## 尚未看清

- 无阻止当前节点的未决项。

## Actual state

- 共享纯窗口实现支持null/精确累计、lag/lead和ROWS frame，core/member/Kon一致；相关403 pass/1279 expects/67 files，全量450 pass/1587 expects/82 files，13包构建、17浏览器用例通过，实际Java Move 1743项一致；百万行CSV/SQLite RSS增量52.953/57.234MiB，open=close=1。日志 .tmp-window-{related,all,build,e2e,benchmark}.log

## Last action

- 独立重读用户目标、MISSION、吸引子与公开入口，最终基线所有 Acceptance 过线。

## Next

- 本 mission 无剩余节点；继续后续已授权 mission。

## Decisions and replans

- 用户明确要求从兼容边界继续补齐；不沿用上批范围外作为本批免检依据。
