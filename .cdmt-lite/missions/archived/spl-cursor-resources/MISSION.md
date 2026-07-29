# Mission: SPL游标与资源链

终点: 以真实惰性cursor接入内存、CSV和SQLite，保证位置/背压/关闭/取消/异常释放；文件CSV/JSON导入导出具备真实IO与原子写入；最后对旧查询迁移矩阵和浏览器产品做总验收。

## Attractors

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 资源/结构 | [attractors/cursor-lifecycle.md](attractors/cursor-lifecycle.md) | 单owner位置、有界读取、效果生命周期与显式异步边界 | 计划 / 决策 / 实现 / 校验 | 1 |

## Notes

- 使用depa-expert与cdmt-mission-lite；候选spl-cursor-resources、spl-streaming-lifecycle，按路线选前者。
- 源头库存：spl-inventory S17–21/P07/P10；源ICursor.fetch/skip及旧SQLite streams/file import/export承诺。源头与codument只读。
- 需要改造：类型包装器无真实cursor，SQL全量all；flow多处创建ConnectionRegistry无统一finally，file仅read。S06–16有限语义和算子在前两个mission已验收。
- 最终暴露：纯Cursor owner及异步host API、内存/CSV/SQLite真实source、流式map/filter/derive与显式有界materialize；async flow可消费，sync Kon/flow对Promise明确拒绝，不把Promise塞给同步解释器。file通过工作区宿主窄effect实现read/write/import/export，CSV/JSON同解析策略与原子替换。
- 已检查~/infra-dev/depa-actor与depa-processor公开能力：是通用actor/mailbox/dispatch，无现成SPL cursor/source协议。这里不增加actor系统或第二调度框架；cursor局部owner串行命令，跨效果IO仍显式source。

## 期望结果

- 期望-1: [1..5]连续fetch/skip/EOF、两个cursor独立、重复close幂等、closed行为明确；并发消费有序、取消/error/提前break终止source一次；map/filter/derive惰性，无group/sort/join伪流式。
- 期望-2: CSV/SQLite使用真实迭代器/stream而非all或SQL分页；百万行验证batch<=1024、首批不读完、RSS增量有界并记录实际值；正常/异常/取消/超时资源回零，操作失败后可继续新查询。materialize必须声明行数上界。
- 期望-3: file CSV/JSON import/export/write真实工作区IO，前导零、数值、引号/换行及后行新增列保真；失败无半成品、临时文件清理、越界拒绝。flow自动创建的连接在终态和错误释放，外部调用者连接不擅自关闭。
- 期望-4: 对照旧SPL迁移22行与历史实际承诺形成最终能力/适配/未证明边界，修复范围内剩余实际gap；全量与Web产品最终通过。不声称Java数千函数/完整option/BigDecimal/时区/企业DW已全兼容。

## 约束

- 约束-1: AT1成立，位置与终态单owner，副作用只在support/宿主；输入不反写，禁止全局跨请求cache/隐藏eval。
- 约束-2: 不修改源仓库/旧Codument/外迁模块，使用隔离临时文件/DB/E2E端口4394/4396，保留用户dirty内容和4196服务。

## Acceptance

- [x] 期望-1、期望-2、期望-3、约束-1 → `bun test packages/expression packages/core packages/sqlite-adapter packages/spl-flow packages/kon-spl-dsl` → 真实游标/source/文件/异常边界及资源计数通过，本地临时资源。
- [x] 期望-2 → `bun .cdmt-lite/missions/active/spl-cursor-resources/verification/streaming-benchmark.ts` → 百万行真实读取batch<=1024、首批有界、RSS增量<=64MiB（独立进程），读/关闭计数有效。
- [x] 期望-4、约束-2 → `bun test` 与 `bun run build` → 全量及13包构建成功；隔离 `SPL_E2E_FRONTEND_PORT=4394 SPL_E2E_BACKEND_PORT=4396 bun run test:e2e` → 全部产品回归通过（仅本地监听需沙箱权限）。
- [x] 约束-1 → `! rg -n 'node:fs|Bun\.file|new Function|eval\(' packages/expression/src/cursor.ts` → cursor内核无隐藏IO/eval；超限、关闭、输入不变、非法文件路径负例通过。
- [x] 约束-2 → Codument diff/untracked SHA256保持7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049与1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e。

## 范围外

- 外排sort/groupx/joinx、分布式DW/集群/JDBC插件、Java原脚本全部option及企业模块；未知来源能力逐项声明，不用它们掩盖本次旧承诺缺口。
