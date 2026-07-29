# Decisions · migrate-flow-web-to-kon

> 规划期（light，用户授权全自动）以假设推进；`assumed` 条目在 G2 以 evidence 确认或走 replan。详见 `analysis/decision-tree.md`。

| ID | 决策 | 状态 | 内容 |
|----|------|------|------|
| E1 | API 形态 | decided | 新 Kon 执行端点与旧端点并存，G5 清退旧端点 |
| E2 | kunun host 方式 | decided | kon-spl-dsl 新增 runSplKon 门面，web-server 只依赖该包；spike 不通则退 web-server 包内 paths |
| E3 | 请求隔离 | decided | 每请求 fresh runtime + fresh SplContext |
| E4 | 前端编辑形态 | decided | Kon 文本编辑器为主模式（编辑区+运行+ResultTable+demos 下拉）；不把 Kon 嫁接进 Univer 网格 |
| E5 | 旧路径去留 | decided | G5 清退旧端点、网格页面、旧 demos/E2E；引擎层 spl-flow/FlowCell 保留不动 |
| E6 | demos/示例迁移 | decided | 现有 demos 全部改写为 Kon 版（G1-T2 出清单） |
| E7 | 安全边界 | decided | workspaceRoot 沙箱 + 源码大小限制 + 结构化错误；同步执行真超时中断入 backlog |

> 2026-07-04 G2 收敛：E1–E7 全部定案（依据 analysis/kon-migration-design.md 与 G1 三份 evidence）；E7 的「真超时中断」入 backlog。
