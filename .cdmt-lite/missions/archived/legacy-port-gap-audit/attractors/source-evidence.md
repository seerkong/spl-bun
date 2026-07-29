# 来源与目标的证据吸引子

本文件定义证据关系，既不列任务，也不以现有实现反过来缩小用户目标。方程是不变量，本文件是载体，盘点、实现与测试是投影。

## 0. 使用

对移植断言与取舍使用本方程；执行顺序归 loop，完成范围归 MISSION。该文件不拥有业务状态。

## 1. 方程

```text
portClaim = (sourceBehavior, targetBehavior, evidence, disposition)
sourceInventory != requiredPublicSurface
historicalRecord -> observation; currentCode + execution -> currentBehavior
dependencyPublicSurface -> reuse; projection -/> sourceMutation
```

## 2. 原语

| 原语 | 含义 |
|---|---|
| sourceBehavior | 参照项目中的可定位行为 |
| targetBehavior | 当前工作区中的实际行为 |
| evidence | 代码位置、命令输出或复现步骤 |
| disposition | 已做、部分、缺失、已外迁、范围外、待确认 |

## 3. 硬不变量

### I1 来源定位

每个缺口有具体比较对象。

❌ 以项目名字推测缺失。✅ 引用源头与目标边界。

### I2 历史不是当前行为

❌ 归档即完成。✅ 重读现有代码并运行相关行为。

### I3 范围不由库存扩张

❌ 发现所有 Java 模块就暴露所有模块。✅ 按用户的计算与 Excel 报表目标选择。

### I4 外迁能力有归属

❌ 删除即缺失并恢复业务领域。✅ 定位外部公开库与当前依赖。

### I5 引用不写回

❌ 为适配移植而改原 Java 仓库。✅ 目标内重建语义与验收。

### I6 执行状态单一

❌ 同时写 codument 和 lite 两套状态。✅ 新执行状态只在 lite harness。

## 4. 排除集

- 无证据的“完整兼容”声明。
- 把 nop-entropy 企业框架当作报表必要前置。
- 修改 codument 历史来匹配当前计划。

## 5. 事实方向

源头文件与当前源码各自拥有其行为；inventory 是 dated observation；mission 是本次期望态；测试只提供行为证据。

## 6. 误读

源头文件数量不等于需要移植的公开接口数量；归档记录不能证明当前工作区仍拥有该能力。

## 7. Harness

本文件管关系，MISSION 管终点，loop 管下一步，evidence 只追加观察结果。
