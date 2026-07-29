# Design · add-kon-spl-dsl

## 上下文

- kunun 扩展点：`registerPrefixKeyword(name, (rt, {knot}) => void)`；回值 `rt.addOpDirectly(RuntimeOpCode.PushValue, v)`（枚举）。解释器同步 dispatch，Promise 结果会丢失 → 全同步设计。
- Kon knot 路由与陷阱见 `analysis/findings.md`（Attr 与 `:{}` 同现分裂到 Next；`#tag` 省值落 Name 且重复覆盖）。
- 引擎面：`compileExpression().evaluate(scope)` 同步；expression parser 原生支持 `func@opt`；`SQLiteAdapter` 同步；`evaluateFlow` async（sqlite 路径实为同步的 Promise 包装）。

## 方案概览

1. package 骨架与依赖
   - `packages/kon-spl-dsl/`，不加入根 tsconfig 引用链；kunun 依赖经该包 `tsconfig.json` 的 `paths` 映射到 `kunun.ts` 项目。
   - README 记录前置条件与路径修改方法；测试在缺少 kunun 仓库时跳过并给出提示（`existsSync` 探测）。
2. SplContext（runtime 载体，D 主）
   - `createSplContext({ workspaceRoot?, scope?, dataSources? })` → `{ registry: 数据源实例表, scope, workspaceRoot }`。
   - 数据源统一同步接口 `SyncDataSource{ query(sql, params?): DataSet; execute?(sql, params?): {changes} }`：sqlite 用 `SQLiteAdapter`；csv/json 用同步读文件 + 现有解析逻辑；路径经 workspaceRoot 沙箱校验（复用 spl-flow 的 resolveWorkspacePath 语义，本地实现避免私有导出依赖）。
3. knot-reader（纯函数，Processor）
   - `readWordCall(knot)` → `{ name?, conf, options, body }`：沿 `Next` 链合并 Conf/Metadata/Attr；`options` = Metadata 中 `opt` 键（权威，字符串化）+ Attr 省值键按出现序拼接（糖）；KnWord 值取 `.Value`。
4. options（纯函数）
   - `applyOptions(exprSource, options)`：定位透传表达式**最外层调用**（顶层函数调用或顶层成员调用的方法名），改写为 `name@opts`；已有 `@` 且与声明不一致 → 抛错。
5. words（每个 word 一个展开器）
   - 公共壳：解析 knot → 同步执行 → `PushValue` 结果 → 若有 `#name`，同时在当前 env 定义变量（用 runtime 的 env 定义 API；G3 实现时从 kunun `var` 关键字实现处确认具体调用）。
   - `spl_connect`：注册数据源并返回句柄（句柄本身可被 `spl_eval` scope 引用）。
   - `spl_query` / `spl_execute`：`conf.conn`（句柄或名字）→ SyncDataSource；结果 DataSet / changes。
   - `spl_eval`：scope = `ctx.scope` ⊕ Kon env 可见变量快照 ⊕ `conf.with`；`compileExpression(applyOptions(expr, options)).evaluate(scope)`。
   - `spl_flow`：`conf.cells`（vector of map：row/col/expr）→ `evaluateFlowSync(cells, flowCtx)`，flowCtx 由 SplContext 派生。
6. spl-flow 同步入口
   - `evaluateFlowSync(cells, ctx)`：与 `evaluateFlow` 共享单元格分类/导航/求值逻辑；对 async adapter 路径抛错（提示改用 evaluateFlow）。实现方式：把核心求值循环抽成生成器/回调可同步驱动的形态，或复制主循环为同步变体消费同步数据源——以对既有代码扰动最小者为准，保持 evaluateFlow 行为与测试不变。

## 影响范围与修改点（Impact）

- 新增 `packages/kon-spl-dsl/**`。
- 修改 `packages/spl-flow/src/index.ts`（新增 evaluateFlowSync 导出）+ 新增对应测试。

## 决策摘要

- 详见 `decisions.md`（全部已定案，来源为上游 mission kon-spl-dsl 的 G1/G2 evidence 与用户约束，关键事实已自包含于 `analysis/findings.md`）。

## 风险 / 权衡

- 机器相关 kunun 路径 → 集中 tsconfig 一处 + README + 测试跳过保护。
- kunun API 演进 → knot 读取与注册调用集中在 knot-reader/index 薄层，便于适配。
- `applyOptions` 对复杂表达式的最外层调用定位 → 仅支持可静态定位的形态，其余报错引导用户直接在表达式串内写 `@opt`（透传保底）。
- env 变量定义 API 若无公开入口 → 退化为仅 PushValue + 文档建议 `(var x (spl_query ...))` 包裹（行为 delta 的 named-result-binding case 相应在实现期修订并记录）。

## 待解决问题

- （无 P0）
