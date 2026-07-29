# 变更：让 Domain Platform 可被独立 Bun workspace 消费

## 背景和动机

Holon Workbench 必须消费 `spl-bun` 拥有的通用 Domain Operation contracts/runtime/server，而不能复制实现或依赖机器绝对路径。当前 contracts/runtime 仍使用 `0.0.0`、source exports 与 `workspace:*`；现有 `depa-data-web-server` 则是包含 demo SQLite、Kon、reference bundles 的私有应用组合根。它们在 monorepo 内可用，但不能证明独立 package consumer 边界。

## 目标

- 新增只负责 catalog 与 execute HTTP adapter 的公共 `depa-data-domain-operation-server` capsule。
- 让 contracts/runtime/server 具有一致非零版本、dist root exports、最小 pack artifacts 和 external-safe dependencies。
- 让现有 private web-server 复用公共 capsule，同时继续拥有 demo/Kon/reference bundle 组合。
- 用真实 tarball 与独立 Bun workspace 验证 clean install、typecheck、catalog、preset、execute 和 lockfile reinstall。

## 非目标

- 不发布到 npm 或其他外部 registry。
- 不引入 Holon、Member、organization-adjustment 或任何具体业务 bundle。
- 不设计或实现 `Holon.Assign`、`Member.Assign`、endpoint、lease、presence、mailbox、delivery 或其他运行态工作分发。
- 不把 private web-server 整体改成公共平台包。

## 成功判据

- 独立 consumer 只从三个 package root import，且依赖声明不含机器绝对路径、deep import 或 `workspace:*`。
- 三包 pack artifacts 可 clean install 和 typecheck；consumer 自有 bundle 能被 catalog、preset 与 execute routes 正确处理。
- private web-server 的现有 Domain Operation、health、Kon 与 reference bundle regressions 通过。
- fresh coding AttractorCheck 判定公共 owner、依赖方向与 scope 为 PASS。
