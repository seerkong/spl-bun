# 显式渲染与单向数据吸引子

本文件描述合法结构，不枚举任务。方程是不变量，本文件是载体，代码与测试是投影。

## 0. 使用

结构关系在本维优先；领域规则由 MISSION 的终点限定。loop 管顺序，evidence 管证据。

## 1. 方程

```text
output = processor(runtime, input, config)
authority = immutableRequestInputs
rendered = project(template, data, expressionResults)
logic -> publicContracts; support -> publicContracts + vendor
projection -/> inputAuthority
```

## 2. 原语

| 原语 | 含义 |
|---|---|
| input | 单次调用的模板、数据、表达式或计算声明 |
| runtime | 显式依赖与 evaluator 契约 |
| config | 标量限制与策略 |
| projection | 可以重建的结果与展示 |

## 3. 硬不变量

### I1 输入不变

❌ 展开直接覆盖输入模板和数据。✅ 每次产生独立输出。

### I2 依赖可见

❌ 核心渲染自行读取文件或隐式 JS eval。✅ IO 与求值通过公开边界注入。

### I3 单向分层

❌ 纯 logic 依赖 XLSX support 或 HTTP/UI。✅ shell 组装公开逻辑与 support。

### I4 真实格式

❌ 把重新生成的无格式表声称为模板渲染。✅ 未改的模板文件项保真；变动映射有证据。

### I5 语义确定

❌ 无法支持的声明静默忽略。✅ 合法声明确定展开；无效声明带位置失败。

### I6 作用域隔离

❌ 请求间复用可变数据源或模板。✅ 每次调用拥有临时工作图与输出。

## 4. 排除集

- logic 中 import node:fs、Bun.file、HTTP 框架或执行 JS eval。
- 以相同字符串键或相同属性值冒充原始记录身份。
- 引入 nop-entropy 的 ORM、认证、工作流作为渲染前置。
- 修改原 Java 仓库或 codument 轨迹。

## 5. 事实方向

模板和请求数据是本次输入 authority；编译计划、展开格、HTML 与下载文件是派生结果，不能反写输入。生命周期止于请求，持久保存由外层显式执行。

## 6. 误读

兼容有明确的支持范围和错误；不把文件能打开等同于模板语义和样式正确。

## 7. Harness

MISSION 管终点和验收，loop 管工作图，evidence 只追加；测试度量当前投影。
