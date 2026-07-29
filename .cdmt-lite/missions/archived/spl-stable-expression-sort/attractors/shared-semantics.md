# 输入权威与共享语义

本文件定义不变量，工作图由loop维护，代码/测试是当前投影。

## 一句话方程

`result = sharedProcessor(input, declaration); adapters -> same semantics; input -> derived result`

## 原语

外部源Java是语义证据；输入值/schema/外层scope是事实；排序键、解析值和结果表是派生；IO/Java仅限验证宿主。

## 硬不变量

- I1 单一语义：✅ Expression/Kon/Flow调用共享处理器；❌ 入口复制近似实现。
- I2 输入权威：✅ 新结果与请求内键缓存；❌ 改写输入数组、行、schema或外层scope。
- I3 显式协议：✅ 不支持类型/选项/字段明确诊断；❌ 吞参数、失精度或声明字段回退到外部同名值。
- I4 证据与authority：✅ Java实值/实际测试与基线绑定，外部Review裁决关闭；❌ 历史绿色/自述或simulation替代验收。

## 排除集

重复语义引擎、精确值降为Number、未选分支执行、输入反写、未知选项/字段静默接受、未验证兼容声明、源Java/旧Codument/企业平台写入。
