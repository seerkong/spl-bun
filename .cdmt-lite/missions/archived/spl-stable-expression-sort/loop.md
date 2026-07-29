# Loop: SPL表达式与多键稳定排序

Status: completed
Round: 2

## Work graph

### 共享来源语义实现

- Status: done
- After: none
- Covers: 期望-1, 期望-2, 约束-1, 约束-2
- Verify: `bun test packages/expression/__tests__/sort-semantics.test.ts` 与源码oracle → 实值与负向通过
- Done when: 共享处理器及Expression/Kon/Flow入口均有断言，真实来源oracle通过。

### 全量与独立验收

- Status: done
- After: 共享来源语义实现
- Covers: 期望-1, 期望-2, 约束-1, 约束-2
- Verify: `bun test`、`bun run build`、17项E2E → exit0，外部Review核验
- Done when: 当前最终基线完成原验收，外部Review核销本mission差距。

## 尚未看清

- 无授权阻塞；来源和目标宿主差异在oracle与实际测试中调和，不扩企业范围。

## Actual state

- 原CANDIDATE-sort已由已准入gap-review generation5明确裁决整改通过，可关闭；G5目录级授权与lineage也独立核实。实际Review见implement-6/review-decision.json，不是实施者自批。
- 当前generation6重跑原专项231 pass/776 expects/39 files，相关432、全量479、13包构建、80项排序实际Java对照、112 Formatter、17产品用例（17.9s）全部exit0；纯报表核心与Codument保护值保持。
- 本mission排序源码未再修改；后续parse非有限词法修复另由原parse mission承接，不归入排序完成证明。
- 既有dirty与历史收据保留；以原run implement generation6/graph7及feedback generation5关联最终指纹。

## Last action

- 导入明确的独立Review排序关闭裁决，按最终业务基线重新运行全部可执行验收；准备completion gate后整体归档。

## Next

- 本mission无待执行节点；原parse mission继续独立Verify/Review，不把排序归档当作全局迁移完成。

## Decisions and replans

- 最终核销采用外部Review的具体排序结论；其全局continue是parse差距所致，不把它伪称整体迁移完成。
