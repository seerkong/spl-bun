请【继续】按照codument执行规范：
.opencode\command\codument-implement.md
完成change track:
codument\tracks\add-more-core-expression-demos-e2e

注意事项
一、重复执行时的任务恢复继续进行策略
如果当前是通过ralph-loop重复执行，需要注意如果已经实现过的当前track 已编写的代码，要进行比对，查缺补漏
如果在 plan.xml 状态是未开始，需要从头执行。
如果在 plan.xml 状态是进行中，需要从头分析，也要code review当前是否有已编写的代码，思考和java版gap。比如梳理 Java 语义与缺口清单
如果在 plan.xml 状态是已经执行过，则跳过无需重复执行。但需要review相关核心代码，了解上下文
二、** 重要 **重复执行时的 plan.xml 处理
** 重要 ** 每次ralph-loop重复执行时的 开始，不可完全重置plan.xml和已编写的代码为初始状态，丢弃过往的进度。这会损失大量的金钱