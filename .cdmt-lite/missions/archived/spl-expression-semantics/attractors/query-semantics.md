# 查询语义收敛吸引子

本文定义语义与事实边界，不是工作清单；代码和实测是实际行为的事实源。

## 方程

```text
result = adapter(sharedPureSemantics, explicitInput, explicitScope)
derivedRow[n+1] = evaluate(expression[n], declaredVisibility(row,n))
aggregate = finish(fold(acceptedValues))
schemaBinding != perRowPresence
SPLTruth != reportTruth
projection -/> callerInput
```

## 原语

输入表/schema、行值、类型键、表达式AST、显式scope、纯归约状态、adapter、衍生结果、support资源。

## 硬不变量

1. ❌ 同名avg/count由入口各猜规则。✅ 纯语义统一，adapter只映射参数/形态，count真值不充当avg分母。
2. ❌ eager计算后伪造短路。✅ AST仅求实际选中分支，选中错误正常传播。
3. ❌ JSON序列化抹平类型键、falsey丢0/空串。✅ 明确SPL真值与类型保真的既有键契约。
4. ❌ 将未知列当undefined生成空结果，或把稀疏已声明列当缺列。✅ 已知schema绑定诊断与逐行值分别判断，自由scope语义不被无差别修改。
5. ❌ 输入row被derive/聚合反写，或跨执行共享cache。✅ 转换输出独立，局部状态可重算。
6. ❌ 修SPL破坏Nop公式0=false或Number-only语义。✅ 报表processor拥有自己的来源规约，SPL只承接明确目标入口。
7. ❌ core恢复DB/服务容器以计算数值。✅ 文件/SQLite效果在support/宿主内，资源成功/错误路径受控释放。

## 排除集

- 只更新错误测试继续保留已证语义漂移。
- 多入口归约分叉、隐藏IO/JS eval、输入反写。
- 把企业平台和原Java全函数当本次数值对齐的前置条件。

## Harness

MISSION定义终点，loop唯一拥有图与状态，evidence只追加；测试度量上述关系，不能以绿色编译代替行为证据。
