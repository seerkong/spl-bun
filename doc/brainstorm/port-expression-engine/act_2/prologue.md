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
spl-bun\doc\brainstorm\port-expression-engine\act_1\feature-diff-20260116.md
我要求：
spl-bun\doc\brainstorm\port-expression-engine\act_1\kick.md
上一轮执行完毕后的报告是：
spl-bun\doc\brainstorm\port-expression-engine\act_1\summary_20260116-morning.md

## 影响/修改点
请自行分析

## 技术约束

## 关键代码

## 测试验证

## 任务要求
按“聚合生命周期 + IO/表函数”顺序继续实现剩余缺口。
也需要添加测试对应功能的测试case.
测试都通过后，扫描当前代码，与java版本的expression实现进行对比，如果还有缺失的功能，则继续补齐