# SPL兼容边界续作

范围：expression/core/Kon/flow 查询计算，模块/包级，深入到具体源码和公开入口。使用 depa-expert 与 cdmt-mission-lite；旧 Codument 只读。事件溯源与响应式 profile 均 NOT_APPLICABLE；cursor 是资源 owner，不据此引入 actor/响应式框架。

事实拓扑：外部 Java 源码提供语义证据；旧迁移记录是历史承诺；输入文本/schema/表是当前计算事实；派生记录、聚合、索引是单向投影；CSV/SQLite资源仍由既有 host owner 管理。没有借此恢复企业平台或 domain/ORM。

本次重开此前 S21/S09/S08 的兼容说明，按顺序实际执行：

1. spl-scalar-numeric-parity：Variant 标量规则与 long/decimal、输入/输出精度（执行状态以 mission loop 为准）。
2. spl-calendar-options：source elapse/interval 的日历和单位选项。
3. spl-member-expression-context：成员行表达式、外部作用域、顺序别名与可安全适配的序列选项。
4. spl-window-value-semantics：相对行、ROWS frame、精确数值和各入口共享。
5. spl-text-formatting：有限 Formatter/string/number 协议；给定独立Review generation3核销G6/G7，generation5依人类指令核对实际目录级授权和command/checkpoint、重新验收后归档；历史收据原样保留。
6. spl-stable-expression-sort：人类明确接纳后实现共享行表达式/多键方向、z/0/u、locale和诊断；80项实际源码Java对照，@u保留记录并层次聚拢；已准入Review generation5判定整改通过，generation6重验归档。
7. spl-parse-conversion：排序实值通过后实施，默认类型、q/e/n优先级、数据JSON与默认日期；generation5为504项实际Java方法对照。generation6依反馈补齐非有限词法，扩展至592项，并重跑Review原152项及四入口20项全部通过；精度/JSON传输/日期资源边界另列；原run graph8的Verify7/Review7已独立核销parse及G2，归档前专项232、全量479、592项来源对照、13包构建及17E2E重新通过，见[归档mission](../../.cdmt-lite/missions/archived/spl-parse-conversion/MISSION.md)。

来源：Variant.java 的 add/subtract/multiply/divide/isEquals/compare/elapse/interval；ToLong/ToBigDecimal；Sequence.derive、Union/Isect/Diff。历史：2026-01-10-port-expression-engine/design.md 的空值传播假设（与真实加减实现不同）；2026-01-19-add-expression-core-ops 的成员与冒号/分号欠账；2026-01-23-add-like-regex-and-date-math-functions 的宿主 Date 边界。

没有把“此前写了范围外”视为本次免检理由。当前来源矩阵、旧 S01–S22/RP/F 重评与sort/parse实施信号见 [acceptance-matrix.md](acceptance-matrix.md)。这里只维护导航，不复制执行状态，不以函数总数推算兼容百分比。实际implement generation5、graph revision6及新人类候选接纳原文关联见`.cdmt-lite/runs/holarchy-0e32cd3d67d631730d42c305c551dfec1614/implement-5/run-context.json`；逐文件Host允许集从未冻结，观察变更不冒充该制品。

当前implement generation6/graph revision7来自原run实际command/checkpoint，关联gap-review generation5/hash=3704820b20202e14ccc16e1f5adca2f5dfb45664b50693dc5e808dc540517de3；CANDIDATE-sort及G5已获独立关闭支持。parse/G2本轮修复证据在implement-6，旧generation5收据保留，逐文件Host允许集不虚构。
