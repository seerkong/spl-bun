# Loop: Excel报表图片条码与图表

Status: completed
Round: 4

期望态见[MISSION.md](MISSION.md)，证据见[evidence.md](evidence.md)。

## Work graph

### 媒体声明与实例图片

- Status: done
- After: none
- Covers: 期望-1, 约束-1, 约束-2
- Verify: `bun test packages/report-logic packages/report-xlsx-support` → 2sheet×2行图片anchor/字节/过滤/HTML一致。
- Done when:
  - 来源描述解析、实例求值与drawing关系真实ZIP通过。

### 条码端口与当前格图片

- Status: done
- After: 媒体声明与实例图片
- Covers: 期望-1, 期望-2, 约束-1, 约束-2
- Verify: `bun test packages/report-logic packages/report-xlsx-support` → PNG尺寸/签名与不同内容、空值、无容器通过。
- Done when:
  - 公共端口及生产适配接通，有有效编码产物证据。

### 动态图表与完整验收

- Status: done
- After: 条码端口与当前格图片
- Covers: 期望-1, 期望-2, 期望-3, 约束-1, 约束-2
- Verify: `bun test` 和 `bun run build` → 全部通过，真实chart/cache与样式检查。
- Done when:
  - 所有期望及负向约束重观察，无未验收节点。

## 尚未看清

- 本mission无未验证节点；图表交互编辑器与独立PDF/Word非来源证明面。

## Actual state

- 最终76相关用例/383全量用例/13包build、三张PNG独立ZXing解码与所有负向约束通过。

## Last action

- 最终重观察修复series元数据一致性、最小barcode尺寸、合并格测量和坏图片位置诊断，重跑全部验收。

## Next

- completion后整体归档；立即执行report-parity-acceptance。

## Decisions and replans

- 图片及图表实例由core持有，字节/编码/ZIP由support持有。barcode固定版本编码库，无Java产品运行依赖。原生chart引用/cache统一投影，样式保留，HTML显示准确图表数据；过时embedded externalData不覆盖当前数据。
