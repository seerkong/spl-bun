# 旧SPL查询迁移的上批对账快照

> 下文为上批历史快照，数值、日期、成员和窗口等说明已由后续 mission 改变。2026-10-24 已重新执行 formatting 最终验收，但独立 review 尚待裁决；复查还发现 sort/parse 候选差距，不能宣称兼容边界全部关闭。当前基线、实值与未决项见[续作对账](../spl-compatibility-2026-10-23/acceptance-matrix.md)。

[原库存](spl-inventory.md)是实施前快照，本文件索引修复后的可验证行为。源码依据、旧承诺位置和历史延期决定仍保留在原库存；旧Codument与Java仓库没有回写。最终实际命令在[资源mission证据](../../.cdmt-lite/missions/archived/spl-cursor-resources/evidence.md)，不能用本表替代验收。

PASS仅覆盖本行所列行为；ADAPTED明确目标语言/宿主协议或来源缺陷修正。此目标是既有查询迁移承诺及本次已识别gap，未宣称esProc数千函数和全部Java宿主兼容。表格报表已先完成[独立来源对账](acceptance-matrix.md)，没有拿查询pivot代替报表layout。

| ID | 最终裁决与实值 | 证据入口（packages下） |
|---|---|---|
| S01 | PASS 类型化复合键、遇到顺序、Date epoch，1/"1"、null/missing不混淆 | core `semantic-regressions.test.ts` |
| S02 | PASS join复合键/区分大小写/schema冲突，右前缀二次冲突拒绝 | core同上与`table-operators.test.ts` |
| S03 | PASS rowNumber/rank/denseRank/runningSum/runningAvg，独立累计和分区 | core `joinWindow.test.ts`、`semantic-regressions.test.ts`；Kon `window.test.ts`；浏览器窗口demo |
| S04 | PASS CSV引号/换行/001、JSON后行新增列、Excel sheet/空表schema、上传命名快照 | spl-flow `table-input.test.ts`；Kon `tables.test.ts`；报表产品E2E |
| S05 | PASS 原库存误标缺失的like/regex/exp/ln/sign/gcd/lcm/age/workday/workdays保持 | expression `like/regex/mathPhase2/datePhase2.test.ts` |
| S06 | PASS SPL只有false/null/undefined为假；0/空串为真；count各入口=2；icount类型/Date/对象引用一致 | expression `spl-parity.test.ts`；core/Kon `query-semantics.test.ts` |
| S07 | PASS and/or、默认if/case、ifp/casep只计算所选分支，bomb零调用；显式替换函数保留其调用契约 | expression `spl-parity.test.ts` |
| S08 | ADAPTED 连列|保留次序重复；union/diff成对消耗，多重集与Date类型键；isect统一minimum multiplicity，修正来源小序列membership/大序列消耗的长度依赖缺陷 | expression `spl-parity.test.ts`；sequence.ts；C4/C5证据 |
| S09 | ADAPTED derive同批顺序可见，覆盖旧a后b读取新a；core/member/Kon均b=3，输入a=100不改 | core/Kon `query-semantics.test.ts`；不复刻Java两个Current的全部重名查找 |
| S10 | ADAPTED avg忽略null/missing/NaN/非数值，四入口[10,null]=10，sum/count/median共享归约；AvgGather合并sum/count权重，非平均平均值 | core `query-semantics.test.ts`；目标Number转换保留数值文本/boolean，区别报表Number-only |
| S11 | PASS 全表空聚合一行，count0/sum&avg null，分组空表零行且schema保留 | core/Kon `query-semantics.test.ts` |
| S12 | PASS 已知schema未知字段报字段+表达式，Engine带step；声明稀疏字段合法且不回退外部同名值 | core/Kon `query-semantics.test.ts`；普通自由scope未无差别改成严格表绑定 |
| S13 | PASS pivot A-Jan15/A-Feb20/B-Feb7，unpivot三行总42，含null四行，重复默认error/显式reducer | core/Kon `table-operators.test.ts`，member同一处理器 |
| S14 | PASS inner/left/full/semi/anti/right基数2/3/4/2/1/3，2×2重复4、右孤儿、左右空表、稳定顺序/完整schema | core/Kon `table-operators.test.ts`，不含range/as-of或外排join |
| S15 | PASS 聚合AST支持sum(a)/sum(b)=7.5、组内表达式和外层懒分支，count/icount及已支持归约共享 | Kon `query-semantics.test.ts`；不把任意nested aggregate或未知函数交给正则猜测 |
| S16 | ADAPTED rename/alter/index、相邻和全键nested rows、groupc铺列/ungroupc反转、groupi嵌套维度；库存groupc/groupi与有序分段的概括已按真实源码纠正 | core/Kon `table-operators.test.ts`；index只读浅快照/类型键，非完整持久外键/DataStruct |
| S17 | PASS 生产Cursor [1,2]/skip1/[4,5]/EOF、队列并发排序、两个位置独立、closed拒绝、一次释放 | expression `cursor.test.ts`；数组slice语义保持 |
| S18 | ADAPTED CSV真stream、SQLite真iterator、流式select/derive/project、显式bounded collect；百万行batch1024、首批CSV32KiB、资源open=close=1、实测RSS<64MiB；EOF/error/abort/break/timeout与Flow终态释放 | expression cursor、sqlite-adapter cursor、spl-flow datasource/cursor与resource-file测试，mission benchmark；异步host/Flow，与同步Kon边界明确 |
| S19 | PASS file read/write/import/export真实IO，CSV/JSON保真、原子替换、失败原文件/临时制品检查与越界/符号链接负例 | spl-flow `resource-file.test.ts`；file-effect.ts |
| S20 | PASS CSV/JSON legacy/Kon同解析和无affinity SQL owner，普通数值/001类型一致、quoted newline、后行新增带引号列、空结果表头；T() JSON同归一 | Kon `query-semantics.test.ts`；spl-flow table-input/datasource/Excel回归 |
| S21 | ADAPTED 已实测Number/Date/option边界，见下节；有限Java语法经目标Conf/record声明适配，非完整Java脚本互操作 | expression `spl-parity.test.ts`、date/math/param/option回归；Kon native及option拒绝测试 |
| S22 | NOT_APPLICABLE 已外迁domain/ORM继续归外部仓库；没有恢复企业开发平台 | production-import-boundary测试，Codument哈希与用户dirty保留 |

数字采用JS Number：0.1+0.2得到0.30000000000000004；2^53加1已无法保持Long精度，Infinity/NaN按JS计算；CSV对超安全整数保留文本，表达式数值字面量和普通JSON数字没有BigDecimal/Long精度层。空值算术保持本项目既有null传播契约，与Java Variant.add的null单位元不同。需要长整型标识符时使用文本，不宣称原Java所有数字类型已经兼容。

日期使用宿主Date与当地日历：闰日/月末加天已验证；独立America/New_York进程从2024-03-09 12点加一天仍为12点，实际经过23小时。format(date)使用现有ISO格式规则，datediff为毫秒/24小时；没有额外业务时区/locale数据库或Java全部日期option。非法date文本返回null。

序列命名成员union/isect/diff/conj处理“序列的序列”，可以给映射表达式；global union按来源多参distinct、单序列保留重复分别实现。新的这些成员明确拒绝未适配option，避免把选项字符串当行表达式静默执行。其它原有参数树与已支持option继续回归；Kon用显式Conf，Java冒号别名、Current和全部option不是宣称已实现的产品面。

源码未重新编译成Java oracle，已读取具体实现和原断言。未按类/函数总数推算百分比。仍可另立目标的源能力是外排groupx/sortx/joinx、分布式DW/多路并行、VDB/JDBC插件、完整数值/统计函数与Java原脚本互操作；它们在旧轨迹中属于延期或本次显式范围外。当前旧承诺和已识别的运行差异，已通过上表实值验收或明确目标语言适配闭合。
