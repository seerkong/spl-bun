# 变更：为新增 Expression 核心能力添加 Web-IDE Demo 和 E2E 测试

## 背景和动机 (Context And Why)

在 git 提交 340c594 中，expression 引擎和 spl-flow 已经实现了核心数据处理能力：
- 序列成员函数（select/sort/group/join/derive）
- 文件成员函数（read/write/import/export for CSV/JSON）
- 游标成员函数（fetch/skip）
- JSON 转换函数（json_parse/json_stringify）
- 多数据源连接（SQLite/CSV/JSON）

但目前 web-ide 中缺少展示这些新功能的 demo，用户无法直观了解和体验这些能力。同时，缺少端到端测试来验证完整的工作流程。需要补充 demo 展示和 E2E 测试覆盖，确保功能可用性和稳定性。

## "要做"和"不做" (Goals / Non-Goals)

**目标:**
- 在 web-ide 中添加覆盖序列操作、文件操作、游标操作、多数据源连接的 demo
- 提供混合模式的 demo：既有简单的单功能展示，也有综合的实际场景应用
- 完善 web-server 和 spl-flow 对新功能的封装和适配器支持
- 准备必要的 demo 数据文件（CSV、JSON）和数据库表
- 使用 Playwright 实现端到端测试，覆盖 demo 加载、表达式执行、结果验证、错误处理、多数据源场景
- 支持两进程开发工作流（dev:frontend 和 dev:backend 分别启动）

**非目标:**
- 不实现 XML 文件操作相关 demo（expression 引擎未实现）
- 不实现 Excel 文件操作相关 demo（expression 引擎未实现）
- 不实现并行操作 demo（expression 引擎未实现）
- 不实现虚拟数据库（VDB）demo（expression 引擎未实现）
- 不涉及实时数据流 demo
- 不涉及认证授权功能
- 不涉及生产部署配置
- 不实现性能基准测试工具

## 变更内容（What Changes）

- **web-ide 新增 demo**：在 `packages/web-ide/src/pages/SplIde.vue` 的 demos 数组中添加新 demo
  - 序列操作 demo（简单：select/sort，综合：数据处理管道）
  - 文件操作 demo（CSV 导入、JSON 处理、多格式数据集成）
  - 游标和多数据源 demo（游标分页、多源查询、跨数据源 join）
- **demo 数据准备**：在 `packages/web-server/data/` 目录添加 CSV 和 JSON 示例文件
- **数据库扩展**：在 demo.db 中添加支持游标和 join 场景的表
- **web-server 增强**：在 `packages/web-server/src/server.ts` 中使用 dataSourceConfigs 注册多数据源
- **spl-flow 适配器**：确保 web-server 正确使用 spl-flow 的数据源工厂和连接注册表
- **E2E 测试**：新增 `packages/web-ide/__tests__/e2e/` 目录，使用 Playwright 实现端到端测试
  - Demo 加载和切换测试
  - 表达式执行和结果验证测试
  - 错误处理测试
  - 多数据源场景测试
- **测试基础设施**：配置 Playwright，支持两进程启动（frontend + backend）

## 影响范围（Impact）

- 受影响的功能规范：web-ide demo 展示、web-server 数据源配置、E2E 测试覆盖
- 影响模块：
  - `packages/web-ide`（SplIde.vue 新增 demo）
  - `packages/web-server`（server.ts 数据源配置、data 目录新增文件）
  - `packages/web-ide/__tests__/e2e/`（新增 E2E 测试）
  - `package.json`（可能新增 E2E 测试脚本）
