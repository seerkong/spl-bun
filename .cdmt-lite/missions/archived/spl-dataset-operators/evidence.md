# Evidence: SPL表转换与关联算子

- T0 — Source/actual观察 — Sequence.pivot:10502支持显式类别值/别名和sum模式，默认逐行覆盖；本项目core/member已有inner/left重复实现，Kon公开只接二者。目标按显式spec适配，默认重复报错防静默损失。
- T1 — 纯表值垂直切片 — 新core/Kon table-operators测试先6 pass/42 expects：A[15,20]/B[null,7]、反转3行总42/含null4行、类型类别别名/空schema、六join基数2/3/4/2/1/3、重复匹配4、右孤儿字段、Date/null/missing与列冲突。core/member共用joinTables，旧两套join已替换。
- T2 — 来源重观察纠偏 — 库存S16把groupc/groupi关联到有序分段的概括不能直接作为语义oracle。实际Sequence:10810–10905 groupc按全键分组将每条记录的值列铺为多列；11281 groupi先排序、逐维产生嵌套维值数组。现分别提供显式groupc/ungroupc、groupi目标spec，相邻分段另外叫groupRows(adjacent=true)，没有把同名函数实现成不同功能。
- T3 — 表结构公共面 — rename/alter生成新行、冲突/转换错误；index的类型键、Date、唯一约束、只读浅快照；groupc组内4条铺列/反转与groupi嵌套维度，三入口都有实值测试。新测试两处假说被证伪：Date→number显式转换合法，已改invalid字符串反例；index.lookup的公开值是只读record数组，toQueryResult原本只接受表外观，测试改验实际array而不偷偷改输出协议。
- T4 — 最终目标与排除集重观察 — 对照用户“先报表后查询”以及本MISSION/AT1，实际运行DataSet/member/Kon入口：pivot/unpivot、六join、rename/alter/index、groupRows/groupc/ungroupc/groupi均有数值/schema/顺序与拒绝反例，输入未反写；旧独立join已删除，纯处理器无IO/eval。最终相关命令249 pass/640 expects/32 files，exit0；`bun test`412 pass/1315 expects/73 files，exit0；`bun run build`13包exit0。Codument两个SHA256仍为约定值；来源Java/企业模块未修改。继续cursor/resource/file能力，不把本mission收口作为整体停止点。
