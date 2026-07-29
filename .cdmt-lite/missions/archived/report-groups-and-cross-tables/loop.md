# Loop: 分组与交叉报表

Status: completed
Round: 4

恢复时加载 Notes 指定 skill，按控制循环持续运行。期望态见 [MISSION.md](MISSION.md)，证据见 [evidence.md](evidence.md)。

## Work graph

### 父格与分组计划

- Status: done
- After: none
- Covers: 期望-1, 期望-2, 约束-1, 约束-2, 约束-3
- Verify: `bun test packages/report-logic packages/report-xlsx-support` → 当前切片相关回归通过。
- Outcome:
  - 编译父格依赖和稳定分组，拒绝环、无效引用与不支持的元数据。
- Done when:
  - 可重观察的实现与相应证伪测试通过，证据追加到账本。

### 列展开与交叉数据范围

- Status: done
- After: 父格与分组计划
- Covers: 期望-1, 期望-2, 约束-1, 约束-2, 约束-3
- Verify: `bun test packages/report-logic packages/report-xlsx-support` → 当前切片相关回归通过。
- Outcome:
  - 行列父格作用域按同一数据集的记录身份相交，避免不同数据集碰巧同值而混合。
- Done when:
  - 可重观察的实现与相应证伪测试通过，证据追加到账本。

### 二维引用与格式投影

- Status: done
- After: 列展开与交叉数据范围
- Covers: 期望-1, 期望-2, 约束-1, 约束-2, 约束-3
- Verify: `bun test packages/report-logic packages/report-xlsx-support` → 当前切片相关回归通过。
- Outcome:
  - 合并、公式和行列尺寸按展开后的坐标映射，表达式配置不泄漏到输出。
- Done when:
  - 可重观察的实现与相应证伪测试通过，证据追加到账本。

### 二维报表重观察

- Status: done
- After: 二维引用与格式投影
- Covers: 期望-1, 期望-2, 约束-1, 约束-2, 约束-3
- Verify: `bun test packages/report-logic packages/report-xlsx-support` → 当前切片相关回归通过。
- Outcome:
  - 空组、重复值、多个数据集和负向边界通过相关回归。
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

- 当前动作：在现有 IR 上编译显式/默认父格，检测联合依赖环；按模板区域生成两轴实例，用同源 row ID 求交。复杂交叠兄弟区域先明确拒绝，避免静默错位。

- 最终重观察：分组标签、双轴同源身份交集、显式父格、多行区域、空交集、多数据集/工作表隔离和公式列范围均由独立样例锁定。Next: 归档并激活 web-table-report-workbench。
