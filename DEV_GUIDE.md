# 开发服务器使用指南

## 问题说明

在 Windows 上，Vite 会启动一个 node.exe 子进程。当父进程被终止时（如 Ctrl+C），这个 node.exe 进程可能不会自动退出，导致端口被占用。

## 解决方案

### 方案 1：使用独立的前端/后端脚本（推荐）

分别在两个终端中启动前端和后端：

```bash
# 终端 1 - 启动后端
bun run dev:backend

# 终端 2 - 启动前端
bun run dev:frontend
```

**优点：**
- 前端和后端独立运行，互不影响
- 可以单独重启某一个服务
- 更容易调试和查看日志
- 每次启动前会自动清理残留进程

### 方案 2：使用原有的组合脚本

```bash
bun run web-ide:dev
```

这个脚本会同时启动前端和后端，但在 Windows 上可能存在进程清理问题。

### 方案 3：手动清理残留进程

如果发现端口被占用，可以使用以下清理脚本：

```bash
# 清理所有开发端口（4174-4179）
bun run cleanup

# 只清理前端端口（4174, 4175）
bun run cleanup:frontend

# 只清理后端端口（4176）
bun run cleanup:backend
```

**说明：**
- `cleanup` - 清理所有开发端口，适用于完全重置环境
- `cleanup:frontend` - 只清理前端相关端口，不影响后端
- `cleanup:backend` - 只清理后端相关端口，不影响前端
- `dev:frontend` 和 `dev:backend` 启动时会自动调用对应的清理命令

## 端口说明

- **4174**: Vite 前端开发服务器（主端口）
- **4175**: Vite 前端备用端口
- **4176**: 后端 API 服务器

## E2E 测试（Playwright）

运行 E2E 测试：

```bash
bun run test:e2e
```

**说明：**
- 单元测试：`bun test`
- 用例目录：`packages/web-ide/__tests__/e2e/`
- E2E 用例文件命名为 `*.e2e.ts`，避免被 `bun test` 误当作单元测试执行
- 测试会按 `playwright.config.ts` 自动启动两进程：
  - 后端：`bun run dev:backend`（`http://localhost:4176/api/health`）
  - 前端：`bun run dev:frontend`（`http://localhost:4174`）

首次运行若提示缺少浏览器（Chromium 等），执行：

```bash
bun x playwright install
```

## 故障排除

### 端口被占用

如果看到端口被占用的错误：

```bash
# 如果是前端端口被占用
bun run cleanup:frontend
bun run dev:frontend

# 如果是后端端口被占用
bun run cleanup:backend
bun run dev:backend

# 如果不确定或多个端口被占用
bun run cleanup
```

### 查看占用端口的进程

```bash
# Windows
netstat -ano | findstr "4174"

# 手动杀死进程
taskkill /F /PID <进程ID>
```

## 最佳实践

1. **推荐使用方案 1**：在两个独立终端中分别运行前端和后端
2. **启动前清理**：`dev:frontend` 和 `dev:backend` 脚本会自动运行清理
3. **遇到问题时**：先运行 `bun run cleanup`，然后重新启动
