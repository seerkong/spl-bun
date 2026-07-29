# Loop: SPL表转换与关联算子

Status: completed
Round: 2

期望态见[MISSION.md](MISSION.md)，证据见[evidence.md](evidence.md)。

## Work graph

### 纯pivot和unpivot

- Status: done
- After: none
- Covers: 期望-1, 约束-1, 约束-2
- Verify: `bun test packages/core packages/expression packages/kon-spl-dsl` → 15/20/7及总42、类型与冲突负例通过。
- Done when:
  - 三入口同一纯实现，schema/null/reducer公开。

### 等值关联六种形态

- Status: done
- After: 纯pivot和unpivot
- Covers: 期望-2, 约束-1, 约束-2
- Verify: `bun test packages/core packages/expression packages/kon-spl-dsl` → 2/3/4/2/1/3及重复键4通过。
- Done when:
  - 去掉旧重复join，保留已通过的类型/列冲突语义。

### 表结构与分段分组

- Status: done
- After: 等值关联六种形态
- Covers: 期望-3, 约束-1, 约束-2
- Verify: `bun test` 和 `bun run build` → 表结构/分段反例及全量通过。
- Done when:
  - 来源适配与公开入口清楚，最终目标重观察无有限范围gap。

## 尚未看清

- 无；T2纠正库存概括，groupc铺列/groupi嵌套维度与相邻分段分别实现，不复刻Java参数糖。

## Actual state

- 最终相关249项/全量412项与13包构建通过，T4完成目标重观察。

## Last action

- 按真实源码区分groupc/groupi/相邻分段；修测试中的Date转换假设与index array输出形态。准备最终test/build及负向检查。

## Next

- 完成归档闸门，立即继续spl-cursor-resources，无需再次征求执行授权。

## Decisions and replans

- 不新增空壳package；公共纯表值模块位于expression层供core与member复用，DataSet仍是core外观，避免循环依赖/全局安装副作用。
