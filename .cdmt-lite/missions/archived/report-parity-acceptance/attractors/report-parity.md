# 报表对账与显式适配不变量

本文为合法结构的约束，测试/代码/矩阵是可重算投影，不是工作清单。

## 方程

sourceCapability = (runtimeEvidence, semanticContract)
targetCapability = explicitAdapter(sourceCapability, targetLanguage, authorityBoundary)
parity = observed(targetCapability) matches semanticContract
completion = allRequiredCapabilitiesCovered and noUnverifiedRuntimeGap
output -/> callerInput

## 原语

来源运行能力、schema/保真载体、目标语言适配、来源格/实例、值/显示/导出、只读view、显式runtime、产品观察与证据。

## 硬不变量

1. ❌ 用类名/静态part/绿色闸门宣称完成。✅ 数值、几何、字节/关系与产品结果可重观察。
2. ❌ Java对象/服务路径偷偷成为authority。✅ 公共适配由明确输入、只读view与窄runtime提供，无隐式容器。
3. ❌ 分裂源格/实例/最终坐标，删除后沿用旧ordinal猜位置。✅ 最终保留实例关系驱动查询，物理坐标仍为衍生值。
4. ❌ 通用成员执行任意JS函数或反写模板。✅ 有限成员协议、回调经显式evaluator且view只读。
5. ❌ raw xpt.xml未解析却宣称兼容，或借XDSL缺席排除渲染语义。✅ 格式边界准确，目标规范化输入覆盖业务语义。
6. ❌ source-runtime gap改名范围外后进入SPL。✅ 对账先闭合表格/报表，再进入查询计算。

## 排除集

- 核心IO/eval、两个执行真源、跨请求cache、输入反写。
- 未验证的SOURCE_RUNTIME仍以PASS交付，或把企业平台搬入补表格渲染。
- 绕过字段权限直接调用任意host对象方法。

## Harness

MISSION规定终点，loop拥有工作图，evidence只追加；矩阵是最终证据索引，不能代替实际命令。
