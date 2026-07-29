# 当前代际技术验证：passed

本轮依据新的 verificationDecisionScope 独立作出技术结论：**passed**。实际基线匹配，本节点必需的技术检查及证据全部通过。C8 最终接纳与差距关闭归下游 `gap-review`，记录为 not-run；本结论不关闭 gap、不归档 parse，也不代表整个迁移工作流完成。旧报告及其 status 没有修改或重新准入。

## 当前实际基线

启动授权四条件满足，原启动 input.json 的 authorization 与本轮一致。实际工作树在本轮前后均匹配 implementation.changeRef：

- HEAD：`1e37adb6a8eccb5087348f2abd2cc2ccbba251fb`。
- 内容 SHA256：`917ddce4d61e494117364a657d118107e9905228c401cef47562c12e471b4c4f`。
- 业务 SHA256：`e49dc10cd0a2b45ee4e3e690ddabca36abfc8a78aedb59cb1abeb0037f70cbd5`。
- status-z SHA256：`a3691c60665513b94a1b1655aa933b4f73216d3f5e1c9806a91a9d1cb2d41f56`。
- tracked HEAD binary diff SHA256：`258099b4ec526c4a586406dc4ffc1b2e36319dd9f474d039a66c53c6c010d4fe`。

内容指纹按 implement-6/final-worktree.json 的排除规则计算，收据单独校验；2843个现存 tracked/nonignored 文件与此前证据基线完全一致，既有删除状态保持。全部当前观测见 final-baseline.json。

原 baselineRef 完整保留于 checks.json：run_id `holarchy-0e32cd3d67d631730d42c305c551dfec1614`，node_id `baseline-review`，revision `3-output-contract`，generation3，output_ref `ai-data-workflow-output|45:holarchy-0e32cd3d67d631730d42c305c551dfec1614|15:baseline-review|3`，output_hash `483fa617806a4548ad0d4aa14dfef2dbd61fb7d0f2c4e4afd47a9833267501ae`。

实际 implementation command 仍为 generation6、graph revision7、node revision `6-user-continuation-20261024:hook:1fa0d370f570`。当前工作流 checkpoint 为 graph revision8，记录为当前编排状态，没有误写成新的代码代际。目录级授权及限制、predecessor和feedback引用保留；逐文件 Host 允许集从未冻结，不要求该制品。

## 本轮实际执行与收据复用

本轮在原工作区重新执行：

| 检查 | 当前结果 |
|---|---|
| 规定五包相关切片 | exit0，432 pass / 1791 expects / 74 files。 |
| 当前 parse 源码 oracle | exit0，592项真实Java来源对照一致。 |
| 已归档排序源码 oracle | exit0，80项真实Java来源方法对照一致。 |
| 已归档 Formatter oracle | exit0，112项真实Java/ICU对照一致。 |
| 上一轮独立152项反例脚本 | 原脚本/期望未改，exit0、零差异。 |
| 四入口20项探针 | 原脚本未改，exit0、20项通过；数值类型、NaN/正负Infinity及输入不变成立。 |
| report-logic IO/eval扫描、Codument哈希及mission结构 | 无命中，保护哈希保持；parse preflight和两项archived检查通过。 |

按本轮 receiptReuse 规则复用当前基线的全量、构建、E2E及专项收据，未把它们描述为本次重新执行：

- 独立重算当前完整工作树，与原检查前/后的文件清单逐项一致。
- 独立检查此前隔离测试副本的全部2843项文件，与当前基线逐项一致，无差异。
- 核对11条原始命令的完整参数、cwd、退出码、日志内容和SHA256，均匹配；再核对19项原始证据文件哈希，均匹配。原始日志包括全量479 pass / 2099 expects / 89 files、13包构建exit0、E2E 17 passed / 12.3s。
- 当前Bun仍为1.3.14，lock SHA256仍为 `3c190fe35bf4c4498218e0556289eed66623f1e19fc553ee01c7fc2d379c8097`；源码oracle本轮也重新验证，来源哈希在日志中。
- generation5/6各22项收据、排序5项和formatting43项移动内容重新核验无不符。

复用审计完整记录于 reuse-audit.json；本轮新执行和已核验复用的检查在 checks.json 分别标注 evidenceMode。此前报告的 status 不作为验收证据，没有直接改写该 status。

## 原合同和当前mission逐项结论

| 条件 | 结论 |
|---|---|
| C1、parse期望1/2、AT1 | passed：五种非有限写法的来源反例消除，Expression/Kon/Flow/regex @p共享数值类型保持，选项优先级、真正溢出拒绝、精确值、输入不变与负向协议断言通过。 |
| C2 | passed：本轮重新运行规定五包命令，432项通过。 |
| C3 | passed：当前基线的479项全量和13包构建原始收据经完整指纹、命令及日志哈希复核后复用。 |
| C4 | passed：本轮静态扫描无隐藏IO/eval；当前相关测试及已核验负向回执包含精度、懒分支、稀疏字段遮蔽、只读视图和非法patch。 |
| C5 | passed：Codument diff SHA256为 `7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049`；未跟踪列表SHA256为 `1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e`。 |
| C6 | passed：本轮Formatter112项实值通过，Java编译临时目录清理。 |
| C7 | passed：规定4394/4396端口、17项产品用例的当前基线原始收据经核验复用；包含format、非有限parse显示、排序与动态sheet。本轮未重新启动浏览器服务。 |
| C8 | not-run，owner=gap-review：当前代际的最终接纳/差距关闭由下游裁决；不由Verify批准，不因这一项待下游而改变技术passed。 |
| C9 | passed：实际implementation身份、目录授权及限制、原baselineRef、同run predecessor/feedback及历史收据保持；当前编排revision与代码代际分别记录。 |
| C10技术部分/G2修订 | passed：重新读取S12，其当前排序字段诊断与已核验专项一致，旧反例明确保留于历史区；parse修复的来源/入口证据成立。其余来源与报表边界保持准确限制，最终gap核销交gap-review。 |

source oracle 的窄 Context、存储/容器、scalar equality 等适配限制仍保留；实际运行来源Java方法，不是simulation，也不声称运行完整esProc或nop-report。任意来源工作簿、完整locale和Java全库兼容未由这些用例证明，不作为本轮新增要求或完成声明。

## 保留与停点

没有修改源码、验收标准、任务状态、旧Codument、源Java、外部库或旧报告。没有扩大企业平台、恢复domain/ORM、reset/clean/commit/push/publish或派发其他会话。本轮测试产物都在本目录；原失败/成功日志保持原样，Java临时编译目录无残留。

按明确的独立检查/报告职责，观察与本节点技术判定已经完成，符合 cdmt-mission-lite §7“仅审计”。将passed技术结果交给原流程下游gap-review，保持其最终接纳权威。
