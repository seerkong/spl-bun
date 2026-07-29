# 设计：可外部消费的 Domain Platform capsules

## Authority 与依赖方向

```text
domain-operation-contracts
          ↑
depa-orm-domain-runtime
          ↑
domain-operation-server
          ↑
private web-server / independent consumers
```

- contracts 拥有 transport-neutral DTO、parser、catalog matching 与 response envelope。
- runtime 拥有 trusted bundle admission 和每次 execution 的 lifecycle。
- server 拥有 HTTP catalog/execute projection、registration 与 transport failure routing。
- private web-server 和 Holon Workbench 都只是应用组合根，各自注入自己的 bundle registrations。

## 公共 server capsule

公共 server 仅组装 Domain Operation routes。它接受只读 registrations，在创建时加载并冻结 catalog projection；每个 execute request 根据 projected facts 精确路由到一个 bundle。它不读取环境变量、不初始化 demo DB、不加载 reference bundle，也不拥有 Kon 或 health route。

现有 web-server 继续拥有应用配置、demo/Kon 数据源和 production main。它通过 `.use(...)` 或等价稳定组合边界复用公共 server，而不复制 catalog/execute 逻辑。

## Packaging

三个公共包使用一致的首个稳定开发版本，build 产生 `dist/index.js` 与声明文件，package root 的 `main`、`types`、`exports` 指向 dist。`files` 仅包含 dist 和必要 metadata。内部公共依赖使用稳定 semver，避免 tarball manifest 残留 monorepo-only `workspace:*`。

不执行 registry publish。验证通过 `bun pm pack` 生成 tarball；consumer fixture 在独立临时目录用相对 `file:` tarball identities 安装，因此 package 名称和发布后保持一致，同时不形成机器绝对依赖。

## 验证

1. package manifest 与 pack contents characterization。
2. server capsule 的 catalog、preset、execute、duplicate/mismatch 与 fresh execution tests。
3. 独立 consumer 用自有中性 bundle完成 clean install、typecheck 和 runtime smoke。
4. 删除 `node_modules` 后 frozen lockfile reinstall。
5. contracts/runtime/server/web-server focused tests、build、import boundary 和 scope scan。

## Scope guard

fixture 只能使用中性测试实体；production package、catalog、routes 与测试均不得出现 Holon/organization 业务语义或 `Holon.Assign`、`Member.Assign` 等运行态工作分发能力。
