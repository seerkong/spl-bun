# 公式实例与单向求值

本文件定义公式能力的合法结构，不是工作清单。载体是文档，不变量是本体，代码和测试是当前投影。

## 方程与原语

```text
instanceIdentity = (outputSheet, sourceAddress, rowBindings, columnBindings)
value(instance) = evaluate(runtime, expression, referencedInstances, requestInput)
workbook = serialize(expandedInstances, values, formulaText, styles)
projection -/> requestInput
```

模板格是定义；输出格是实例；引用集是明确选取的实例序列；runtime 是显式能力；输入是本次不可变数据；值/缓存是可丢弃投影。

## 硬不变量

1. 模板和请求输入拥有事实权威。❌ 计算反写原格或输入数组。✅ 每次独立产生带来源的输出。
2. 同源实例必须保留身份。❌ 按显示文本、相同属性或模板地址错误合并。✅ 以展开实例和来源关系定位。
3. 两种公式语义清楚。❌ 将 Excel 复制引用与层次实例集合混成一个正则替换。✅ 解析明确的引用模型并分别处理。
4. 依赖可观测。❌ 顺序碰巧正确、循环返回空值或沿用旧 cache。✅ 按请求内依赖求值并报告循环路径。
5. 失败确定。❌ 未实现函数、无效坐标或类型错误显示成功。✅ 有定位的错误或明确未计算状态。
6. 纯逻辑只读显式输入与端口。❌ 核心自行读文件、数据库、容器或 JS eval。✅ 外层提供 evaluator，结果经统一 IR 投影。
7. 输出一致。❌ HTML 与 XLSX 分别再算一次导致不同值。✅ 同一结果值生成两种产物，原生公式和 cache 分别保留。

## 排除集

- 核心文件 IO、动态 JS 求值、隐式企业依赖。
- 全局可变公式 cache、按模板地址复用不同实例值。
- 忽略循环/未知函数而展示虚假的数值结果。
- 通过复制 Java/XLang 运行时恢复原企业框架。

## 事实方向与误读

模板与数据 → 编译声明 → 展开实例 → 公式值 → HTML/XLSX。未知函数保留公式并明确未计算可以是兼容策略，不能借此宣称该函数已经实现。循环必须在当前依赖中验证；旧 workbook cache 不是当前输入的事实来源。

MISSION 管完成样貌，loop 管工作图，evidence 只追加；测试验证当前投影。
