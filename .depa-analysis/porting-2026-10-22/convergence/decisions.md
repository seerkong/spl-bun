# 处置决策

| 决策 | 定位 | 动作 | vendor 取向 | 来源 | 候选改造 |
|---|---|---|---|---|---|
| D1 报表独立于表格 IO 与 Java 平台 | 数据/平台 | add-contract + logic + support | 保留 xlsx ZIP，成熟 XML codec | NR-01、23、26、28；runtime I2/I3 | Excel 报表内核 |
| D2 模板不变，渲染内拥有实例与记录身份 | 数据/领域 | immutable input → local projection | 纯 TS 结构，注入 evaluator | NR-06–19 | 分组与交叉表 |
| D3 原生公式不交给 SPL parser | 扩展/领域 | 单独引用映射与重算策略 | 保留 OOXML f，单独公式处理 | NR-20–22 | 内核与二维引用 |
| D4 Web 以字节与数据传输，绑定在单请求内 | 控制/应用 | add public upload/render boundary | Elysia、Vue、当前 Kon runtime | runtime F1/F2、I1/I5 | 网页表格报表 |
| D5 CSV 解析统一，覆盖引号和换行 | 数据/平台 | 修复并复用 parser 接缝 | 现有 XLSX 表格 reader 的 CSV 支持 | runtime I4 | 网页输入 |
| D6 修复类型键与窗口累计，公开 window word | 数据/领域、扩展/应用 | 修正 core，原生 Kon word 适配 | DataSet、Kunun registry | esproc 计算缺口、runtime P4 | 序表与 Kon window |
| D7 外迁包不恢复；高成本能力保留明确 backlog | 控制/平台 | keep / defer with evidence | 当前外部包 public API | runtime 自有库；esproc 来源盘点 | 长期续作清单 |

所有候选均是现有用户目标的局部实施；报表输出优先，后续按明确依赖串行。不存在“发现 Java 类就自动公开所有类”的规则。
