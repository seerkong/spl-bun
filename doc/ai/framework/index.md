# 框架开发实践

SPL-Bun 开发框架和最佳实践。

## 文档列表

| 文档 | 说明 | 何时阅读 |
|------|------|----------|
| [introduce/](./introduce/index.md) | 框架概念介绍 | 初次开发时 |
| [howto/](./howto/index.md) | 操作指南 | 执行具体任务时 |
| [example/](./example/index.md) | 代码示例 | 需要参考实现时 |
| [constaint/](./constaint/index.md) | 规则约束 | 设计新功能时 |
| [misc/](./misc/index.md) | 杂项补充 | 了解细节时 |
| [troubleshooting/](./troubleshooting/index.md) | 故障排除 | 遇到问题时 |

## 开发环境

### 前置要求

- Bun >= 1.0
- Node.js >= 18 (可选，用于某些工具)

### 安装

```bash
bun install
```

### 常用命令

```bash
# 运行测试
bun test

# 构建所有包
bun run build

# 启动开发服务器
bun run dev:backend   # 后端 (端口 4176)
bun run dev:frontend  # 前端 (端口 4174)

# 运行 E2E 测试
bun run test:e2e

# 清理端口
bun run cleanup
```

## 项目结构

```
spl-bun/
├── packages/           # Monorepo 包
│   ├── expression/     # 表达式引擎
│   ├── core/           # 核心数据操作
│   ├── spl-flow/       # 流程控制
│   ├── sqlite-adapter/ # SQLite 适配器
│   ├── web-ide/        # 前端
│   ├── web-server/     # 后端
│   ├── web-shared/     # 共享类型
│   ├── composer/       # 组合器
│   └── test-utils/     # 测试工具
├── codument/           # 设计文档
│   ├── archive/        # 已完成
│   └── tracks/         # 进行中
├── doc/                # 文档
│   └── ai/             # AI 文档
├── scripts/            # 脚本
└── package.json        # 根配置
```

## 测试策略

### 单元测试

每个包都有 `__tests__/` 目录：

```bash
# 运行所有测试
bun test

# 运行特定包的测试
bun test packages/expression

# 运行特定文件
bun test packages/spl-flow/__tests__/if.test.ts
```

### E2E 测试

使用 Playwright：

```bash
# 安装浏览器
bun x playwright install

# 运行 E2E 测试
bun run test:e2e
```

E2E 测试文件位于 `packages/web-ide/__tests__/e2e/`。

## 添加新功能

1. 在 `codument/tracks/` 创建设计文档
2. 实现功能代码
3. 添加测试用例
4. 更新相关文档
5. 完成后将设计文档移至 `codument/archive/`
