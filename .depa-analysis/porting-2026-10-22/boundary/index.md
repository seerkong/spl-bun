# 骨架与第一性问题

## 目标骨架

入口包括 `packages/web-ide/src/pages/KonIde.vue`、`packages/web-server/src/server.ts`；包包括 expression、core、spl-flow、kon-spl-dsl、composer、sqlite-adapter、web-shared、web-ide、web-server 与 test-utils。各包 manifest 是依赖声明证据。历史材料位于 `codument/tracks/archived/` 与 `codument/missions/archived/`；旧执行系统本次只读。

## 问题清单

| 问题 | 证据起点 | 待确认的事实边界 |
|---|---|---|
| 当前语言入口由谁定义，旧表达式路径是否仍是产品入口？ | kon-spl-dsl/src/index.ts, web-server/src/server.ts | 语言与运行上下文 authority |
| 表格输入由哪些格式和存储路径拥有，用户能否从网页导入？ | spl-flow/src/datasource/, web-ide/src/pages/KonIde.vue | 上传、连接器与数据快照 |
| 历史完成记录和现有计算能力是否一致？ | codument/tracks/archived/, core/src/dataset.ts | 历史记录与运行事实的关系 |
| 自有基础库已承接了哪些旧包能力？ | packages/*/package.json, ~/infra-dev | 包 public boundary 与重复实现风险 |
| 数据加 Excel 模板的输出链路是否存在？ | spl-flow/__tests__/excel.test.ts, nop-report | 输入模板、渲染 IR 与导出投影 |
| nop-report 的动态区域、父格、格式和合并如何解耦于 Java 企业框架？ | nop-report/src/, nop-report/demo/ | 可移植报表内核与副作用 |
| 表格公式和自定义表达式的 authority 如何区分？ | expression/, kon-spl-dsl/, nop-report | 模板保真与计算入口 |
| 当前测试和构建是否支持顺序实施后重观察？ | package.json, packages/*/__tests__/ | 实测证据与最终验收 |
