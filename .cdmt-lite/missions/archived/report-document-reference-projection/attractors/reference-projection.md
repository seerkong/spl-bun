# 文档引用投影不变量

本文规定结构形状，代码与测试是可重算投影，不是任务清单。

## 方程

source = (sourceSheetId, templateCoordinate)
instance = (source, parentPaths)
reference = project(sourceRange, finalInstances, sheetContext)
relationship = (ownerPart, localId, targetPart)
output = serialize(reference, relationship)
output -/> immutableTemplate

## 原语

来源sheet/格、输出sheet实例、格实例、矩形范围、公式token、文档part、局部关系ID与目标part。

## 硬不变量

1. ❌ 用展示sheet名查源文件。✅ 来源ID定位模板，实例上下文选择最终sheet名。
2. ❌ 各metadata独立猜行列偏移。✅ 一个纯projection API消费最终来源映射，支持不连续实例。
3. ❌ 把inplace当全局行列复制。✅ 来源格映射优先；空区域才使用槽来源补足。
4. ❌ 公式字符串中的A1/链接文字被改写。✅ token区分字面量、限定符、引用；关系owner独立。
5. ❌ 克隆sheet共享可变table/drawing实例，localSheetId指错表。✅ 实例持有自己的关系与局部元数据，静态样式等共享不可变资源。
6. ❌ 动态引用未实现而静默保留旧地址。✅ 支持结构按统一映射输出；未知受影响结构定位诊断。
7. ❌ HTML链接执行javascript/data。✅ 值转义，链接仅允许明确scheme和内部目标。
8. ❌ support决定领域值或core读ZIP。✅ logic拥有引用语义，support拥有XML/ZIP/字节投影。

## 排除集

- 两套互相不一致的引用映射、输出反写模板、全局跨请求cache。
- 用静态part存在或check_mission通过冒称动态语义正确。
- 恢复Java服务容器/企业平台，或用未知ext拒所有模板。

## Harness

MISSION定义终点，loop拥有工作状态，evidence只追加；测试测量上述不变量及结果。
