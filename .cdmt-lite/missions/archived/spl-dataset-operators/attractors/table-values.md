# 纯表值与类型关系吸引子

本文件是结构约束载体，代码与实测为实际行为真源。

## 方程

```text
table = (orderedSchema, orderedRows)
result = transform(table, explicitSpec)
keyEquality = sharedTypedTupleEquality
memberResult = coreResult = KonResult (after shape adaptation)
index = readOnlyProjection(tableSnapshot)
result -/> input
```

## 原语

列名/类型、行、类型键、遇到顺序、重复策略、缺格、表值、只读索引、adapter。

## 硬不变量

1. ❌ 串化键合并1和"1"/复合分隔符。✅ 共享tuple规约，Date按epoch，对象按引用，null与missing区分。
2. ❌ 静默覆盖重复pivot或别名碰撞。✅ 显式reducer/冲突错误，空表仍有可声明schema。
3. ❌ member/core各实现另一种连接语义。✅ 纯表值处理器唯一，入口只做结果形态与声明转换。
4. ❌ 全/右关联丢孤儿，半连接重复右方导致膨胀。✅ 按匹配关系决定输出基数与稳定顺序。
5. ❌ rename/alter/index直接修改caller行或带出可变内部Map。✅ 返回独立值/只读快照查询，不反向覆盖来源。
6. ❌ 把报告layout当查询pivot或引入服务容器。✅ 表转换是纯数据处理，报表只消费结果。

## 排除集

- 输入反写、序列化类型键、跨调用可变cache、隐藏IO/eval。
- 空表丢schema、静默列冲突或重复值损失、adapter分叉计算。

## Harness

MISSION拥有期望态，loop拥有唯一工作图，evidence只追加；测试检验关系而不以实现细节定义目标。
