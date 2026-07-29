# 变更：web-ide 切换为 Kon 脚本主模式（页面 + demos + E2E）

## 背景和动机 (Context And Why)

mission migrate-flow-web-to-kon 第二批。服务端 /api/execute-kon 已就绪（track add-kon-flow-server-api）。前端目前是 Univer 网格 + 33 个网格 demos + 5 组网格 E2E；按 mission 定案 E4/E6，切换为 Kon 文本编辑主模式，demos 全部 Kon 化，新增 Kon E2E 与旧用例双跑。

## "要做"和"不做" (Goals / Non-Goals)

**目标:**
- 新 KonIde 页面为默认路由 `/`（编辑区 + demos 下拉 + Run + status + ResultTable，DOM 类名沿用旧约定以复用 E2E helpers）；旧 SplIde 挪 `/grid-legacy` 行为不变。
- konDemos：33 个网格 demo 逐一映射为 Kon 脚本（允许改写/合并/裁减，记录差异）。
- 新 Kon E2E 用例组；旧 E2E 仅改路由指向 /grid-legacy，其余不动；全量 E2E 双跑通过。

**非目标:**
- 不清退旧页面/旧端点/旧 E2E（G5）；不做语法高亮/LSP（backlog）；不改 kunun/spl-flow；web-server 仅在确有缺口时最小修补。

## 变更内容（What Changes）

- packages/web-ide：新增 src/pages/KonIde.vue、src/pages/konDemos.ts；router 调整（/ → KonIde，/grid-legacy → SplIde）；新增 __tests__/e2e/kon-*.e2e.ts；旧 e2e 用例 goto 路径改 /grid-legacy。

## 影响范围（Impact）

- 能力：新增 web-ide-kon（本 track delta）。
- 代码：packages/web-ide/**；可能极小量 web-server 修补。
