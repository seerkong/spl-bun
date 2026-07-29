# Loop: 报表文档引用投影

Status: completed
Round: 3

期望态见[MISSION.md](MISSION.md)，证据见[evidence.md](evidence.md)。

## Work graph

### 统一引用与公式表示

- Status: done
- After: none
- Covers: 期望-1, 约束-1, 约束-2
- Verify: `bun test packages/report-logic packages/report-xlsx-support` → source/instance/cross-sheet/shared/array反例通过。
- Done when:
  - 投影API和真实XLSX已验证并记录evidence。

### 链接与文档元数据

- Status: done
- After: 统一引用与公式表示
- Covers: 期望-2, 约束-1, 约束-2
- Verify: `bun test packages/report-logic packages/report-xlsx-support packages/web-server` → 真实ZIP与HTML元数据通过。
- Done when:
  - 引用/局部sheet关系/负向URL反例有证据。

### 表格范围与最终重观察

- Status: done
- After: 链接与文档元数据
- Covers: 期望-1, 期望-2, 期望-3, 约束-1, 约束-2
- Verify: `bun test` 和 `bun run build` → 全部通过。
- Done when:
  - table克隆/过滤区域/完整回归与结构重观察过线。

## 尚未看清

- 本mission无未验证节点；完整Excel数组计算不在来源证明面，多格数组保真范围及重叠诊断已验收。

## Actual state

- 最终相关71用例、全量378用例、13包构建和所有负向边界通过，见R3/R4。

## Last action

- 独立重建目标对照最终工作区，修CF priority保真和打印CSS，再重跑全部验收。

## Next

- completion闸门后整体归档，继续report-images-and-charts。

## Decisions and replans

- 统一来源映射优先槽；SheetJS链接属性显示不是解码后URL事实源，改用XML关系。范围全局名称表示union，表达式全局名称取首个上下文；README明确适配。
