# 动态sheet来源与请求隔离

本文件是结构不变量载体，不是任务清单；实现和测试是当前投影。

## 方程

sourceIdentity = immutableTemplateSheetId
instanceIdentity = (sourceIdentity, loopPath)
outputName = workbookUniqueDisplayName(instance)
result = render(runtime, template, immutableRequest + instanceScope)
projection -/> inputAuthority

## 原语

模板sheet、配置声明、循环项、scope、实例ID和输出part各自独立。展示名称不能替代来源ID；配置表是声明输入，不是运行服务。

## 硬不变量

1. ❌ 按输出名字查原模板part。✅ 来源ID稳定，允许重命名、复制、删除实例。
2. ❌ 循环项覆盖调用方params或复用上一个sheet的视图cache。✅ 每实例派生独立只读scope、独立求值状态。
3. ❌ 每个模板单独去重导致workbook同名。✅ 全workbook统一分配合法展示名。
4. ❌ 在logic读文件、执行初始化脚本或找企业容器。✅ 声明表达式经runtime，外部数据由调用方输入。
5. ❌ 复制worksheet却共享可变drawing/关系或丢样式。✅ part关系与身份明确，未变样式保留并有字节断言。
6. ❌ 隐藏失败配置、少输出sheet仍称成功。✅ 空循环是合法零次，非法配置带sheet/格位置报错。

## 排除集

- 原模板bytes/params反写；全局可变实例cache；按展示名寻源。
- Java/XLang执行器、企业服务容器、纯logic内IO/eval。
- 生成重名sheet或悬空rId/part，却仅用文件能打开宣称完成。

## Harness

MISSION声明完成，loop记录节点，evidence只追加。模板/数据是事实输入，sheet实例/输出名称与文档part只向下投影。
