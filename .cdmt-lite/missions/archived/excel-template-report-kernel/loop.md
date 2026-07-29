# Loop: Excel 模板报表内核

Status: completed
Round: 4

恢复时加载 Notes 指定 skill，按控制循环持续运行。期望态见 [MISSION.md](MISSION.md)，证据见 [evidence.md](evidence.md)。

## Work graph

### 模板契约与注释编译

- Status: done
- After: none
- Covers: 期望-1, 期望-2, 约束-1, 约束-2, 约束-3
- Verify: `bun test packages/report-logic packages/report-xlsx-support` → 当前切片相关回归通过。
- Outcome:
  - 读取原始工作簿，注释保留、静态单元格、公式、样式和合并格投影有明确契约。
- Done when:
  - 可重观察的实现与相应证伪测试通过，证据追加到账本。

### 行展开与显式表达式运行时

- Status: done
- After: 模板契约与注释编译
- Covers: 期望-1, 期望-2, 约束-1, 约束-2, 约束-3
- Verify: `bun test packages/report-logic packages/report-xlsx-support` → 当前切片相关回归通过。
- Outcome:
  - 编译并展开行，表达式只由传入 evaluator 计算，输入不变，空集与错误有明确信号。
- Done when:
  - 可重观察的实现与相应证伪测试通过，证据追加到账本。

### 保留模板的 XLSX 与 HTML 输出

- Status: done
- After: 行展开与显式表达式运行时
- Covers: 期望-1, 期望-2, 约束-1, 约束-2, 约束-3
- Verify: `bun test packages/report-logic packages/report-xlsx-support` → 当前切片相关回归通过。
- Outcome:
  - 只改声明的工作表数据与受影响引用；不丢原始 styles/theme；HTML 转义用户数据。
- Done when:
  - 可重观察的实现与相应证伪测试通过，证据追加到账本。

### 来源样例与负向验收

- Status: done
- After: 保留模板的 XLSX 与 HTML 输出
- Covers: 期望-1, 期望-2, 约束-1, 约束-2, 约束-3
- Verify: `bun test packages/report-logic packages/report-xlsx-support` → 当前切片相关回归通过。
- Outcome:
  - 真实工作簿语义与自造边界样例通过，无法安全保留的动态结构明确失败。
- Done when:
  - 可重观察的实现与相应证伪测试通过，证据追加到账本。

## 尚未看清

- 无；实现中的新证据先观测再调和，必要时更新本工作图。

## Actual state

- 源头与当前差距来自三主题独立 inventory。尚未对本 mission 写业务代码。

## Last action

- 按用户授权建立完整 harness，等待前序验收。

## Next

- 前序 mission 完成后移到 active，Status 改 active，通过 preflight 后执行第一个节点。

## Decisions and replans

- 报表优先，业务实现按顺序串行；旧 codument 只读。

- 当前动作：建立 contract/logic/xlsx-support，直接声明 xlsx 和 fast-xml-parser，先用合成 Excel fixture 检验保真；随后逐节点实现并测试。

- 重观察：模板 authority 不变；logic 无 IO；XLSX/HTML 由同一结果投影。公式缓存明确交 Excel 重算；受影响的不支持结构拒绝。7 个报表测试、全量 313 个测试与三包 typecheck 通过。Next: 归档后激活 report-groups-and-cross-tables。
