# 原语复用

| 改造 | 复用 | 自建的最小领域部分 | 证据 |
|---|---|---|---|
| XLSX | xlsx CFB ZIP 与 workbook reader | 工作表模板配置、引用映射与受控写入 | NR-26/28，runtime I3 |
| XML | fast-xml-parser 公共 parser/builder/validator | OOXML 节点到模板 contract 映射 | runtime 自有库/XML 实测 |
| 表达式 | depa-data-expression 公共编译器；Kon 继续使用 kunun | 作用域与错误位置适配 | runtime P4 与自有库 |
| 分组和交叉 | JS Map/Set 与现有 DataSet | 稳定 record ID 与父格几何 | NR-11/12；esproc typed tuple |
| Web | Elysia、Vue、TanStack 表格、Playwright | 输入/结果关联与模板工作流 | runtime 包边界/基线 |
| 窗口 | DataSet.window | Kon 参数解析与 word 注册 | esproc 窗口缺口 |

不重建语言、ZIP、XML、actor 或企业应用框架。
