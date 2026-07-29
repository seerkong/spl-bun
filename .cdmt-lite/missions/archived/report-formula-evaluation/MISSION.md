# Mission: 报表公式求值与依赖

终点: 对照 nop-report 的表格公式语义，在展开后的单元格实例上求值，HTML 与 XLSX 显示一致的结果，依赖、过滤、坐标与错误行为有来源和反例。

本文件是期望态权威；状态见 [loop.md](loop.md)，证据见 [evidence.md](evidence.md)。

## Attractors

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 结构与身份 | [attractors/formula-projection.md](attractors/formula-projection.md) | 显式依赖、实例身份和单向求值 | 计划 / 决策 / 实现 / 校验 | 1 |

## Notes

- 每轮加载 cdmt-mission-lite 与 depa-expert；用户授权持续实施，不停在规划或中间里程碑。
- 命名候选 report-formula-evaluation、nop-formula-projection；选择前者，描述结果而非上游品牌。
- 源头库存：本地 nop-report/nop-excel 的报表层次公式与原生公式；盘点见 `.depa-analysis/report-parity-2026-10-22/formula-inventory.md`，须在业务写入前根据该来源细化语法验收。
- 需要改造：当前只有 A1 字符串映射与 Excel 重算提示；补实例选取、求值依赖、公式缓存及共享渲染结果。
- 最终暴露：模板原生公式与报表公式、HTML/XLSX 当前值；Java/XLang 初始化仍改用调用方输入和既有 SPL/Kon evaluator。
- 来源收敛：formula-inventory F01–F12 / N01–N12。现有 `.formula` 默认保留物理 Excel 复制引用；`valueExpr` 中的模板引用、`formulaExpr` 或显式 `formulaMode=report` 使用 Nop 层次实例集合。配套 Xpt 模板在后续导入阶段标记 report 模式，避免悄然改变已公开模板语义。
- 精确验收：两组 B2=[10,20]/[7,8]，组内 SUM=30/15、全局45；绝对第2组15、相对前组30、末组15；二维路径交集20；多实例标量报错、前向引用9、循环路径失败；原生两行乘法20/12与footer32，公式和cache同时回读。
- 命令在仓库根运行，测试为本地合成模板和隔离请求；构建仅写忽略的 dist。不修改源 Java、旧 codument 和外迁基础库。

## 期望结果

- 期望-1: 行列展开后的报表单元格集合、坐标、过滤聚合和依赖公式遵循来源语义，并且循环与无效引用带原始格位置失败。
- 期望-2: 原生 Excel 常用报表公式在输出实例上计算数值、保留公式，HTML 与 XLSX 的值一致；未实现函数不能伪造成功值。
- 期望-3: 支持面、来源对应关系与使用样例清楚；既有报表、数据计算和网页行为保持回归。

## 约束

- 约束-1: AT1 成立，核心无隐藏 IO 或 JS eval，无请求间可变缓存，不把模板地址当输出实例身份。
- 约束-2: 旧 codument 保持当前双哈希基线，不引入 nop 企业容器或修改外部仓库。
- 约束-3: 复用当前表达式原语与公开契约，输入模板/数据不变；任何新求值端口归 runtime，结果值归本次输出。

## Acceptance

- [x] 期望-1、期望-2、约束-3 → `bun test packages/report-logic packages/report-xlsx-support` → 报表公式、展开、依赖、错误与真实 XLSX 回读全部通过（本地合成数据）。
- [x] 期望-3 → `bun test` → 整仓既有行为与新增用例全部通过（隔离测试资源）。
- [x] 约束-1、约束-3 → `bun run build` → 所有公开包构建通过，手工重读依赖只使用公开边界（本地 dist）。
- [x] 约束-1 → `! rg -n 'node:fs|Bun\.file|new Function|eval\(' packages/report-logic/src` → 核心无 IO/JS eval；反例验证实例身份、循环失败、输入不变（负向检查）。
- [x] 约束-2 → `test "$(git diff -- codument | shasum -a 256 | cut -d ' ' -f 1)" = 7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049 && test "$(git ls-files --others --exclude-standard codument | shasum -a 256 | cut -d ' ' -f 1)" = 1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e` → 历史不变（只读负向检查）。

## 范围外

- 企业平台、数据库建模、认证权限、流程、服务注册与部署。
- 动态 sheet、格式布局等属于后续串行 mission；这些仍是本次用户整体目标，不因本 mission 归档就停止。
