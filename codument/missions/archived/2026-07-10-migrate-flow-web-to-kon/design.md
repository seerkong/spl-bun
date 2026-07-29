# Mission Design · migrate-flow-web-to-kon

## 控制论模型

- **desired state**：mission.xml 的 G1 盘点 → G2 收敛 → G3 服务端 → G4 前端 → G5 清退与总验证 DAG、节点状态、叶子 TrackLink。
- **actual state**：mission 文件、tracks/archive 状态、bun test 与 Playwright E2E 结果、reports、用户新约束。
- **actuation**：创建/续跑/归档 track；受控修订 mission.xml（递增 Revision + replan report）。
- **feedback / drift**：G1 推翻假设（如 web-server 无法经 kon-spl-dsl 门面收敛依赖）、E2E 双跑发现行为差异、E4/E5 决策变化。

## Mission Actors

| Actor | 控制论角色 | DEPA 归属 | 职责 |
|---|---|---|---|
| `MissionPlanner` | 期望态产出者 | Processor + Actor | 产出/修订 desired graph 与 decision frontier（E1–E7） |
| `MissionObserver` | 传感器 | Data + Actor | 读取 track/测试/E2E/代码投影 actual state |
| `MissionReconciler` | 控制器 | Processor + Actor | 判定 ready / drift / blocked / done |
| `MissionApplier` | 执行器 | Effect + Actor | 一次一个 bounded action（盘点/建 track/执行 track/写报告） |

## plan 与 track 的区分

- mission 只做盘点、收敛、切片、验证、重规划；代码/测试/示例由三个 TrackLink track 承担（G3-T1、G4-T1、G5-T1）；无「不经 track 的直接实现」例外。

## 技术方向摘要（供 G2 收敛，非定案；依据 decision-tree E1–E7）

1. **依赖收敛（E2）**：优先给 `depa-data-kon-spl-dsl` 增加服务端门面 `runSplKon(source, contextConfig) → {result, bindings, diagnostics}`（内部 CreateRuntime + EnableSplDsl + EvalBlockSourceWithRuntimeSync），web-server 只依赖该包，kunun 依赖保持单点 capsule。G1-T3 spike 验证 web-server（bun 直跑）经 workspace 依赖引 kon-spl-dsl 时 tsconfig paths 是否随包生效。
2. **API（E1/E3/E7）**：新端点接收 `{source, dataSources?, scope?}`，每请求 fresh runtime + fresh SplContext（无共享可变状态）；结构化错误（cell 级/word 级消息）；workspaceRoot 沙箱沿用；源码大小限制；真超时中断记 backlog（同步解释器不可中断）。旧端点并存至 G5。
3. **前端（E4）**：SplIde 新增/切换为 Kon 脚本主模式：文本编辑区 + 运行按钮 + ResultTable 结果展示 + demos 下拉（Kon 版）；Univer 网格页面按 E5 在 G5 清退。demos 迁移映射参考 kon-spl-dsl README 与上游对照表。
4. **E2E（A3）**：G4 中新增 Kon 路径 E2E（加载 demo、执行、错误处理、多数据源），迁移期与旧用例双跑；G5 移除旧用例。
5. **引擎不动**：spl-flow/evaluateFlow/FlowCell 保留（引擎能力 + spl_flow word 依赖）；"切换"仅指产品使用面。

## 受控重规划

active 后允许增删改节点，须 evidence 或 human decision + `reports/replan-XXX.md` + Revision 递增。预期触发点：

- G1-T3 发现 workspace 依赖下 kunun paths 不生效 → E2 改走 web-server 包内 paths（方案 a），G3 track 范围调整。
- E4 若实测 Univer 网格页面承载了不可替代的交互价值 → E5 改保留并降级，G5-T1 范围修订（写 replan）。

## 人工介入

- severity=light + 用户明确"自动推进直至完成"：无问答推进；仅 destructive 边界（删除旧页面/端点属 G2 已定案的清退范围，且全程有 git 历史可回退）与真实 BLOCKED 时停。

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| web-server 经 workspace 依赖引 kon-spl-dsl 时 kunun tsconfig paths 不随包生效 | 阻塞 G3 | G1-T3 最小 spike；备选：web-server 包内复制 paths |
| 同步执行长脚本阻塞服务进程 | 服务可用性 | 源码限制 + 结构化错误；真中断记 backlog；demos 均为小脚本 |
| E2E 改写面大（5 组用例） | G4 工期 | G1-T2 逐用例清单化；helpers 抽公共 Kon 执行步骤 |
| 清退网格 UI 影响未知使用者 | 不可逆感知 | 分批：G4 切默认、G5 才清退；git 可回退；replan 通道保留 |
