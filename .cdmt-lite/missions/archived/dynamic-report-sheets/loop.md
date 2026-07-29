# Loop: 动态报表工作表

Status: completed
Round: 3

恢复时读MISSION Notes指定skill。期望态见 [MISSION.md](MISSION.md)，证据见 [evidence.md](evidence.md)。

## Work graph

### 配置与循环实例

- Status: done
- After: none
- Covers: 期望-1, 期望-2, 期望-3, 约束-1, 约束-2
- Verify: `bun test packages/report-logic packages/report-xlsx-support` → 配置表与循环数据的DS-1/2/3通过。
- Outcome:
  - 公开SheetConfig，读取配置表，实例scope与稳定来源ID，不执行脚本。
- Done when:
  - 实际用例通过且证据追加。

### OOXML工作簿投影

- Status: done
- After: 配置与循环实例
- Covers: 期望-1, 期望-3, 约束-1
- Verify: `bun test packages/report-xlsx-support` → 真实文件重开、样式、sheet/rels/types一致。
- Outcome:
  - 从sourceSheetId克隆sheet和关联，更新全局工作簿与配置表剔除。
- Done when:
  - bytes/HTML/IR三层验收通过。

### 产品与目标重观察

- Status: done
- After: OOXML工作簿投影
- Covers: 期望-1, 期望-2, 期望-3, 约束-1, 约束-2
- Verify: `bun test packages/report-logic packages/report-xlsx-support packages/web-server && bun run build` → 逐条Acceptance与最宽回归通过。
- Done when:
  - 独立重读来源/目标/实现并运行每条验收，无待验证节点，结构完成闸门通过。

## 尚未看清

- 无；复杂drawing深克隆归后续图片图表mission，当前存在受影响drawing时必须定位拒绝而非损坏。

## Actual state

- 独立sheet实例/稳定sourceId、循环与命名、配置表剔除和OOXML克隆已实现。32个报表用例通过，含来源17等价苹果/香蕉动态列与值、样式/主题字节不变、重名/空循环、脚本拒绝与公式cache隔离。

## Last action

- 补HTTP worker真实接口用例，重跑相关回归与build，更新文档并复核排除集。

## Next

- 本mission行为验收完成，通过结构闸门后归档，立即激活report-layout-and-cell-processing；整体任务不结束。

## Decisions and replans

- Java初始化迁到显式输入，不恢复企业平台。绘图等后续范围仍需继续。
- DS-1首次失败：现有SPL tokenizer仅ASCII，原表格中文字段/属性无法求值。把Unicode标识符作为本报表用例的必要基础修复，保留原语法和公开evaluator，不在report旁造第二套字段求值器；随后重跑DS与全仓回归。
