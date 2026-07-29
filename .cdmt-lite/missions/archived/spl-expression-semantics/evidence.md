# Evidence: SPL表达式与聚合语义对齐

- S0 — 读取来源Variant.java:63、And.calculate、ICount类注释/实现、AvgValue:19/30、Sequence.derive。实施前反例已存spl-inventory P01–P06/S20：false&&bomb calls1、conj[2]、avg10/5分叉、derive101/3分叉；先写可证伪回归再改语义。

- S1 — 首轮反例 — 新expression/spl-parity测试初始3 fail，分别0/空串false、bomb执行、连列错误；修后expression+report 128 pass/416 expects。if/case仅默认builtin走AST懒分支，显式替换函数保留正常调用契约；ifp/casep参数树也只求命中值。类型icount复用tuple owner，含Date/循环对象引用不序列化。
- S2 — 聚合/派生实际反例 — 新core/Kon测试初始3 fail：member avg=5、core b=101、正则误将sum(a)/sum(b)内层截成a)/sum(b。改共享aggregation/binding及AST aggregate编译，现四入口avg=10、复合7.5、顺序b=3；无分组空表一行n0/avg&sum null，分组空表零行。AvgGather保留sum/count并支持权重状态合并，不再为finished avg提供平均平均值的regather表达式。
- S3 — 输入适配与回归反馈 — 统一CSV/JSON解析与无affinity临时SQLite，Kon/legacy实测001文本、1200.5数值、quoted newline、后行新增带引号字段、空表表头相同；未知SQL后仍能正常查询，finally实际代码保证关闭。完整相关首轮2 fail：旧测试固化数字字符串，另一个SQL result只有columns无schema，绑定误判amount未知；前者按统一契约更新，后者补columns/schema/全行联合的adapter归一，原同步/异步flow同结果回归恢复。新Kon测试最初错误地把toQueryResult.rows当二维数组，已修测试为真实公开record形态，未改产品输出API。
- S4 — 最终独立重观察 — 从MISSION/AT1与用户原始范围核对实际公开入口：类型icount、真假值、默认/替换函数lazy、param分支、序列operator、core/member/Kon聚合、weighted AvgGather、empty group、schema与Engine错误、CSV/JSON跨facade均有真实断言，report全套保留0=false及Number-only。最终相关命令358 pass/954 expects/57 files；`bun test`403 pass/1252 expects/71 files，exit0；`bun run build`13包exit0。`! rg -n 'node:fs|Bun\.file|new Function|eval\(' packages/report-logic/src`exit0，Codument两个哈希与S0基线相同。旧迁移S06–12/S15/S20的本mission有限目标闭合，原Java完整数字/Current/option互操作未冒称等价。继续pivot/joins及其余表结构能力。
