# Loop: 序表正确性与 Kon 窗口计算

Status: completed
Round: 4

恢复时加载 Notes 指定 skill，按控制循环持续运行。期望态见 [MISSION.md](MISSION.md)，证据见 [evidence.md](evidence.md)。

## Work graph

### 类型化复合键与关联

- Status: done
- After: none
- Covers: 期望-1, 期望-2, 期望-3, 约束-1, 约束-2, 约束-3
- Verify: `bun test packages/core packages/kon-spl-dsl packages/web-server` → 当前切片相关回归通过。
- Outcome:
  - 分组、join、partition 不因分隔符、数字/字符串、null/undefined 等碰撞；保留原始键值。
- Done when:
  - 可重观察的实现与相应证伪测试通过，证据追加到账本。

### 独立窗口指标累计

- Status: done
- After: 类型化复合键与关联
- Covers: 期望-1, 期望-2, 约束-1, 约束-2, 约束-3
- Verify: `bun test packages/core packages/kon-spl-dsl packages/web-server` → 当前切片相关回归通过。
- Outcome:
  - 不同列的 runningSum/runningAvg 独立计算并保留已有排序排名语义。
- Done when:
  - 可重观察的实现与相应证伪测试通过，证据追加到账本。

### Kon 窗口词与示例

- Status: done
- After: 独立窗口指标累计
- Covers: 期望-1, 期望-2, 约束-1, 约束-2, 约束-3
- Verify: `bun test packages/core packages/kon-spl-dsl packages/web-server` → 当前切片相关回归通过。
- Outcome:
  - 通过 kunun 的原生注册公开窗口能力，参数验证与结果进入标准执行结果。
- Done when:
  - 可重观察的实现与相应证伪测试通过，证据追加到账本。

### 计算与产品回归重观察

- Status: done
- After: Kon 窗口词与示例
- Covers: 期望-1, 期望-2, 期望-3, 约束-1, 约束-2, 约束-3
- Verify: `bun test packages/core packages/kon-spl-dsl packages/web-server` → 当前切片相关回归通过。
- Outcome:
  - 复现旧错误并确认修复；Kon 与网页既有案例和构建通过。
- Done when:
  - 可重观察的实现与相应证伪测试通过，证据追加到账本。

## 尚未看清

- 无；实现中的新证据先观测再调和，必要时更新本工作图。

## Actual state

- expression 公开类型化元组索引，core 与成员 group/join、window 分区共用；Date 按 epoch、其他对象按身份，原始分组键值保留。
- window 独立累计 sum 与 avg；Kon 已注册 spl_window，并补文档、IDE Window 示例与浏览器用例。
- 最终工作区整仓 339 pass / 0 fail，14 个 Chromium E2E 通过，13 包构建通过。纯逻辑与旧 codument 负向检查通过。

## Last action

- 重读 MISSION、吸引子、实现及反例，逐条重跑验收并用真实浏览器观察新增窗口示例，证据 D1–D8 已追加；交付报告记录范围和剩余缺口。

## Next

- 无当前可做节点。本批所有节点与行为验收完成；completion 闸门通过后整体归档，archived 闸门复核。其余源头能力保留在分析 backlog。

## Decisions and replans

- 报表优先，业务实现按顺序串行；旧 codument 只读。

- 当前动作：expression公开纯元组索引统一core/member group/join/partition的相等语义，去除分隔符与toLowerCase串化；独立窗口sum/avg；新增原生spl_window，复用已有by读取器并支持core orderBy映射。别名冲突显式报错；新表格支持保持现有schema与行数据。
