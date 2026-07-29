# 事实角色

来源为 [runtime 事实节点](../inventory/runtime.md#事实节点) 与 [nop-report 边界](../inventory/nop-report.md#data--effect--processor--actor-边界)。

| 节点 | role / authority model | owner | relation | verdict |
|---|---|---|---|---|
| Kon 源码、上传表格、模板与参数 | immutable request input / caller value | 请求调用方 | commands → fresh execution/render | clean |
| 文件与 SQLite | current_authority / external file、durable database | 文件作者、SQLite | projects → rows | multi-entry，同一 owner |
| Kon runtime 与数据源绑定 | runtime_control / request memory | runSplKon 单次运行 | owns bindings；projects → query result | clean |
| 编译模板 | derived_observation / immutable value | compiler | template → plan | 新能力，待实现验证 |
| 行列实例、父格与记录 ID 集合 | runtime_control / render memory | 单次 render | data → group/intersection → output cells | 新能力，待实现验证 |
| 原始值、显示文本、Excel 公式 | 三个独立 derived value | 各求值/格式处理器 | cells → HTML/XLSX | 不混用公式与 SPL 表达式 |
| 浏览器结果与下载文件 | derived_observation | 页面当前请求 | observes → data/render response | 旧 UI 无 latest-result 关联，需随新流程修复 |
| codument 历史 | historical_record | 原轨迹文件 | observes → migration inventory | 本次只读，不能作当前能力 authority |

报表不是持久业务 authority，不引入事件日志。模板父格图是编译依赖模型，不能据此强加响应式框架。
