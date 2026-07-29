# Loop: SPL游标与资源链

Status: completed
Round: 4

期望态见[MISSION.md](MISSION.md)，证据见[evidence.md](evidence.md)。

## Work graph

### Cursor单owner与惰性转换

- Status: done
- After: none
- Covers: 期望-1, 约束-1, 约束-2
- Verify: `bun test packages/expression packages/core` → fetch/skip/concurrent/terminal/map/filter与有界materialize反例通过。
- Done when:
  - 非mock生产cursor推进与清理计数可重观察。

### 真实CSV和SQLite source

- Status: done
- After: Cursor单owner与惰性转换
- Covers: 期望-2, 约束-1, 约束-2
- Verify: source测试与独立streaming-benchmark → 百万行/RSS/关闭证据。
- Done when:
  - 真stream/iterator，首批有界，错误/取消清理。

### Flow资源与原子文件effect

- Status: done
- After: 真实CSV和SQLite source
- Covers: 期望-1, 期望-3, 约束-1, 约束-2
- Verify: `bun test packages/spl-flow packages/kon-spl-dsl` → 文件roundtrip、失败原文件不变、资源终态和sync拒绝通过。
- Done when:
  - 旧file import/export承诺有真实IO，自动资源统一释放。

### 集合重复与数值日期边界

- Status: done
- After: Flow资源与原子文件effect
- Covers: 期望-4, 约束-1, 约束-2
- Verify: `bun test packages/expression packages/kon-spl-dsl` → 多重集/类型键和数值/日期已选边界有实际证据。
- Done when:
  - C4来源已证明的重复消耗缺口闭合，S21边界有明示结果而非unknown完成。

### 最终迁移对账与产品验收

- Status: done
- After: 集合重复与数值日期边界
- Covers: 期望-4, 约束-1, 约束-2
- Verify: `bun test`、`bun run build`及隔离E2E → 全部通过；22行与旧承诺最终索引明确。
- Done when:
  - 原始用户目标/attractor/公开产品面重观察无范围内待行动gap。

## 尚未看清

- 无范围内未验证项；数值/日期/Java语法与来源缺陷适配已明示在最终矩阵。

## Actual state

- C7最终331相关/426全量测试、13包构建、16项E2E、两source百万行/资源/RSS全部通过。C8按原始用户目标和AT1独立重观察，无尚可行动gap。

## Last action

- 完成最终矩阵与delivery，负向检查和来源哈希通过；准备completion/archived闸门。

## Next

- 通过生命周期闸门后返回最终交付；本次roadmap全部完成，无待执行节点。

## Decisions and replans

- 保留array.fetch/skip的原slice语义，新增真实Cursor独立owner；异步host优先，不改同步Kunun运行模型。
- C4证据→补集合节点，不重开已完成的有限原语mission，也不把新发现的真实来源行为改称范围外。
