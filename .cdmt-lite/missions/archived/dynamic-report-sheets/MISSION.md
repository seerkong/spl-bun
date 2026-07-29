# Mission: 动态报表工作表

终点: 对照nop-report配套配置表生成独立动态sheet，循环数据、名称和scope不串值，真实XLSX/HTML与模板来源一致。

本文件是期望态权威；循环状态见 [loop.md](loop.md)，证据见 [evidence.md](evidence.md)。

## Attractors

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 结构与身份 | [attractors/sheet-isolation.md](attractors/sheet-isolation.md) | 来源ID、循环隔离与输出投影 | 计划 / 决策 / 实现 / 校验 | 1 |

## Notes

- 每轮加载cdmt-mission-lite、depa-expert。用户已授权依次实施；前序完成自动进入本mission，结束后继续布局与其余报表差距。
- 命名候选dynamic-report-sheets、report-sheet-instances；选择前者。
- 源头库存：report-inventory RP01/02，17号动态Sheet/列示例，xpt.imp.xml配置表标签与ExpandedSheetGenerator循环/名称逻辑。
- 需要改造：稳定sourceSheetId、SheetConfig、循环实例与独立params、名称统一分配、XLSX sheet/rels/content-types克隆与配置表剔除。
- 最终暴露：程序化SheetConfig和纯声明配套XptSheetModel配置表，input/params承接原Java初始化，sheet-local变量与数据在现有表达式runtime求值。
- 所有命令仓库根执行，本地合成模板/内存数据；不读写外部服务，不修改源Java或旧codument。

## 期望结果

- 期望-1: 17号等价输入生成苹果/香蕉两个sheet，各自列和值正确，源sheet与输出name分离，配置sheet不出现在结果。
- 期望-2: 固定封面、空循环、testExpr、循环变量/索引、sheetVarName与字段优先级符合来源，跨sheet无cache泄漏。
- 期望-3: 工作簿范围重名去重、31字符/非法名称处理明确，克隆真实OOXML而非重建丢样式，模板与调用输入不变。

## 约束

- 约束-1: AT1单向投影与作用域隔离成立，logic无IO/JS eval，support不持有表达式规则。
- 约束-2: 不执行Java/XLang初始化和企业容器，遇到非声明式脚本给配置格定位与迁移建议；旧codument双哈希不变。

## Acceptance

- [x] 期望-1、期望-2、期望-3 → `bun test packages/report-logic packages/report-xlsx-support packages/web-server` → DS-1/2/3、公式cache隔离、真实XLSX重开/ZIP关系、HTML与输入不变全部通过（合成模板）。
- [x] 约束-1 → `bun run build` → 全部构建通过，重读deps与运行边界正确（本地dist）。
- [x] 约束-1 → `! rg -n 'node:fs|Bun\.file|new Function|eval\(' packages/report-logic/src` → 纯逻辑无隐藏IO/JS eval；多sheet反例验证生命周期（只读负向）。
- [x] 约束-2 → `git diff -- codument | shasum -a 256` → SHA256=7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049；untracked清单哈希=1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e；配置脚本拒绝反例通过（只读）。

## 范围外

- 企业框架和独立PDF/Word输出。
- 本mission不写后续复杂空间布局/图片/引用重定位；这些仍在整体路线中，不能因本mission结束而停止。
