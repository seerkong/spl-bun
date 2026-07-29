## 背景
我需要一个能够使用bun运行的，有esProc功能的库，来支持数据相关APP的开发

## 为什么
esProc的查询，能力非常强大。且比较适合与类似excel产品配合

## 所属长期目标
完成esProc项目核心代码从java迁移为bun + typescript

## 上下文
本bun+typescript的workspace在
E:\infra-dev\src\esProc\spl-bun
java版的代码目录在
E:\infra-dev\src\esProc


在上一轮迭代前，状态是：
doc\brainstorm\port-expression-engine\act_2\feature-diff-20260117_2135.md
我要求的任务是：
codument\archive\2026-01-18-update-expression-engine-port
上一轮执行完毕后的报告是：
doc\brainstorm\port-expression-engine\act_2\summary_20260117_2135.md

## 任务要求
扫描当前
packages\expression
代码，与java版本的expression实现进行对比，结合act_2提到的剩余未做的内容
将功能对比写入到
doc\brainstorm\port-expression-engine\act_4\engine-feature-diff.md
另外，扫描java版本的代码，是使用哪个函数实现连接多个不同的数据库或者excel,csv,json等数据文件的
我现在需要在 packages\spl-flow 中，也添加这个连接数据源的支持。但只需要支持能够连接其他的sqlite数据库或者csv,JSON文件，不需要支持更多其他类型的数据源

请你先进行概要设计
将设计实现思路的概要设计，放到
doc\brainstorm\port-expression-engine\act_4\brief-design.md
将影响和修改点的概要设计，放到
doc\brainstorm\port-expression-engine\act_4\brief-impact.md

了解代码后，你不需要直接开始工作，只需要把文档写好，作为下一步的输入

