# 实例空间与显示投影

本文是不变量载体；不是待办清单。代码/测试是当前投影。

## 方程

instance = (sourceSheetId, sourceAddress, parentInstancePaths)
geometry = allocate(instances, reservations, siblingRelations)
outputCoordinate = project(geometry)
formatted/exported = project(rawValue, style, explicitPolicy)
projection -/> immutableInput

## 原语

来源格、实例、行列父、预留槽、兄弟空间、原值、可见性与最终坐标相互独立。删除和隐藏不同；格式不是原始数值。

## 硬不变量

1. ❌ 行特有列套全局笛卡尔积。✅ 按父实例展开，空间共享只发生在相同父域。
2. ❌ 兄弟次数相加或原位预留被删除。✅ 复用已有空间，仅超过容量时增长。
3. ❌ 用物理A1/展示文字代替实例身份。✅ 先建来源/关系，再投影最终坐标。
4. ❌ 删除格后仍输出旧公式/合并/引用。✅ 位置变化统一回到来源映射。
5. ❌ hidden等同removed、格式化文本覆盖raw number。✅ 各状态与值角色显式，导出策略明确。
6. ❌ 样式表达式修改共享style定义。✅ 每实例只选择样式/值/patch，原模板不变。
7. ❌ 核心读文件或恢复企业容器脚本。✅ 输入/evaluator/窄效果显式，support仅投影。

## 排除集

- 隐藏IO/eval、输入反写、全局可变cache、按值合并记录。
- 两套并行布局/求值真源；无证据的静默截断/覆盖。
- 用unsupported列表排除用户已授权的来源运行能力。

## Harness

MISSION规定终点，loop记录节点和调和，evidence只追加。输入→实例→几何→值/显示→产物，方向不可反转。
