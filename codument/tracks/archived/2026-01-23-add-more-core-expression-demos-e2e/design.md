## 上下文

- 当前 web-ide 已有基础 demo（states-base, states-max-pop, region-drilldown, area-children, crud-demo）
- git 提交 340c594 实现了 expression 核心能力：序列/文件/游标操作、JSON 转换、多数据源连接
- git 提交 f10fecc 展示了添加 demo 的方式：在 SplIde.vue 的 demos 数组中添加配置
- 当前 web-server 使用 connections Map，需要迁移到 dataSourceConfigs 以支持 CSV/JSON 数据源
- package.json 中定义了 dev:frontend 和 dev:backend 分别启动前后端的脚本
- 缺少 Playwright E2E 测试基础设施

## 方案概览

1. **Demo 数据准备**
   - 1.1 创建 CSV 示例文件（sales.csv, products.csv）
   - 1.2 创建 JSON 示例文件（config.json, users.json）
   - 1.3 扩展 demo.db 数据库表（添加 orders, customers 表用于 join 和游标场景）

2. **Web-IDE Demo 实现**
   - 2.1 简单序列操作 demo
     - 2.1.1 Sequence Select Demo（使用 select 筛选数据）
     - 2.1.2 Sequence Sort Demo（使用 sort 排序数据）
   - 2.2 综合序列操作 demo
     - 2.2.1 Data Pipeline Demo（组合 select/sort/group/join/derive）
   - 2.3 文件操作 demo
     - 2.3.1 CSV Import Demo（读取 CSV 文件）
     - 2.3.2 JSON Processing Demo（读取、解析、转换 JSON）
     - 2.3.3 Multi-Format Integration Demo（CSV + JSON 数据集成）
   - 2.4 游标和多数据源 demo
     - 2.4.1 Cursor Pagination Demo（使用 fetch/skip 分页）
     - 2.4.2 Multi-Source Query Demo（查询 SQLite/CSV/JSON）
     - 2.4.3 Cross-Datasource Join Demo（跨数据源 join）

3. **Web-Server 增强**
   - 3.1 迁移到 dataSourceConfigs API
     - 3.1.1 配置 SQLite 数据源（demo.db）
     - 3.1.2 配置 CSV 数据源（sales.csv, products.csv）
     - 3.1.3 配置 JSON 数据源（config.json, users.json）
   - 3.2 更新 server.ts 初始化逻辑
     - 3.2.1 使用 ConnectionRegistry 注册数据源
     - 3.2.2 使用 createDataSourceHandle 创建句柄
     - 3.2.3 传递 dataSourceConfigs 到 evaluateFlow

4. **Playwright E2E 测试实现**
   - 4.1 测试基础设施搭建
     - 4.1.1 安装 Playwright 依赖
     - 4.1.2 配置 playwright.config.ts
     - 4.1.3 创建测试辅助函数（启动/停止服务、等待加载）
   - 4.2 Demo 加载测试
     - 4.2.1 测试 demo 列表加载
     - 4.2.2 测试 demo 切换功能
   - 4.3 表达式执行测试
     - 4.3.1 测试序列操作 demo 执行和结果验证
     - 4.3.2 测试文件操作 demo 执行和结果验证
     - 4.3.3 测试游标操作 demo 执行和结果验证
   - 4.4 多数据源测试
     - 4.4.1 测试多源查询 demo
     - 4.4.2 测试跨数据源 join demo
   - 4.5 错误处理测试
     - 4.5.1 测试无效 SQL 错误提示
     - 4.5.2 测试缺失文件错误提示

5. **文档和脚本**
   - 5.1 更新 package.json 添加 E2E 测试脚本
   - 5.2 更新 DEV_GUIDE.md 说明如何运行 E2E 测试

## 影响范围与修改点（Impact）

- **新增文件：**
  - `packages/web-server/data/sales.csv`
  - `packages/web-server/data/products.csv`
  - `packages/web-server/data/config.json`
  - `packages/web-server/data/users.json`
  - `packages/web-ide/__tests__/e2e/demo-loading.spec.ts`
  - `packages/web-ide/__tests__/e2e/expression-execution.spec.ts`
  - `packages/web-ide/__tests__/e2e/multi-datasource.spec.ts`
  - `packages/web-ide/__tests__/e2e/error-handling.spec.ts`
  - `packages/web-ide/__tests__/e2e/helpers.ts`
  - `playwright.config.ts`（根目录）

- **修改文件：**
  - `packages/web-ide/src/pages/SplIde.vue`（demos 数组新增 8-10 个 demo）
  - `packages/web-server/src/server.ts`（迁移到 dataSourceConfigs）
  - `packages/web-server/data/demo-init.sql`（新增 orders, customers 表）
  - `package.json`（新增 test:e2e 脚本，添加 Playwright 依赖）
  - `DEV_GUIDE.md`（新增 E2E 测试说明）

## 决策

- **决策：使用混合模式 demo**
  - 理由：既提供简单的单功能 demo 便于学习，也提供综合 demo 展示实际应用场景

- **决策：迁移 web-server 到 dataSourceConfigs API**
  - 理由：新 API 支持 CSV/JSON 数据源，向后兼容，是推荐的方式
  - 替代方案：保持 connections Map 并手动处理文件数据源（被否决，不够优雅）

- **决策：使用 Playwright 进行 E2E 测试**
  - 理由：Playwright 支持多浏览器、稳定可靠、有良好的调试工具
  - 替代方案：Cypress（被否决，Playwright 更现代且性能更好）

- **决策：E2E 测试启动独立的前后端进程**
  - 理由：模拟真实开发和部署环境，确保两进程通信正常
  - 替代方案：使用 mock 数据（被否决，无法测试完整工作流）

## 风险 / 权衡

- **风险：E2E 测试可能不稳定（flaky tests）**
  - 缓解：使用 Playwright 的自动等待机制，添加明确的等待条件，避免硬编码延迟

- **风险：CSV/JSON 文件路径在不同环境可能不一致**
  - 缓解：使用相对路径，在 server.ts 中使用 `__dirname` 解析绝对路径

- **风险：Demo 数据可能过大影响加载速度**
  - 缓解：保持 demo 数据文件小巧（CSV < 100 行，JSON < 50 条记录）

- **权衡：Demo 数量 vs 维护成本**
  - 决策：添加 8-10 个精选 demo，覆盖核心功能，避免过多 demo 增加维护负担

## 兼容性设计

- **向后兼容：** 保留现有 5 个 demo 不变，新增 demo 追加到列表末尾
- **API 兼容：** web-server 使用 dataSourceConfigs 的同时保留对 connections Map 的支持（spl-flow 已实现）
- **测试隔离：** E2E 测试使用独立的测试数据，不影响现有 demo 数据

## 迁移计划

无需迁移，所有变更为新增功能。

## 待解决问题

- CSV 和 JSON 文件的具体数据结构和字段设计（需要在实现时确定）
- demo.db 中 orders 和 customers 表的具体 schema（需要在实现时确定）
- Playwright 配置的浏览器选择（Chromium/Firefox/WebKit）
- E2E 测试的超时时间设置（需要根据实际执行时间调整）
