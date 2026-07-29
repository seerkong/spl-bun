# Loop: SPL表达式与聚合语义对齐

Status: completed
Round: 2

期望态见[MISSION.md](MISSION.md)，证据见[evidence.md](evidence.md)。

## Work graph

### 真值与懒分支及连列

- Status: done
- After: none
- Covers: 期望-1, 约束-1, 约束-2
- Verify: `bun test packages/expression packages/report-logic` → 真值/count与lazy反例及报表隔离通过。
- Done when:
  - 来源反例固定为数值与调用次数断言，所有公开计数入口一致。

### 聚合派生与schema绑定

- Status: done
- After: 真值与懒分支及连列
- Covers: 期望-1, 期望-2, 约束-1, 约束-2
- Verify: `bun test packages/core packages/kon-spl-dsl packages/expression` → avg/empty/derive/compound/missing-field入口对照通过。
- Done when:
  - 纯规则共享，已知schema错误可定位且稀疏合法，输入不变。

### 输入适配与全量回归

- Status: done
- After: 聚合派生与schema绑定
- Covers: 期望-3, 约束-1, 约束-2
- Verify: `bun test` 和 `bun run build` → 输入/资源反例和全量通过。
- Done when:
  - 所有验收在最终基线上复跑，来源对账明确，可进入下一mission。

## 尚未看清

- 无；源循环逐项设置新记录，目标明确采用顺序可见且覆盖同名列，未复制新旧Current的全部重名解析规则。

## Actual state

- 最终相关358项、全量403项及13包构建通过，S4完成目标与排除集重观察。

## Last action

- 三组失败反例均闭合，README公开truth/count、null聚合、derive顺序、schema绑定、文件类型适配；准备最终验收。

## Next

- 通过归档闸门后立即进入spl-dataset-operators；后续cursor与旧能力对账仍须继续。

## Decisions and replans

- 已有统一tuple equality为类型/日期规约；直接复用，不引入新状态框架。报表truth仍由report processor拥有。
