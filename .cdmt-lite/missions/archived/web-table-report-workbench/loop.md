# Loop: 网页表格与报表工作台

Status: completed
Round: 5

恢复时加载 Notes 指定 skill，按控制循环持续运行。期望态见 [MISSION.md](MISSION.md)，证据见 [evidence.md](evidence.md)。

## Work graph

### 请求内表格绑定与导入

- Status: done
- After: none
- Covers: 期望-1, 期望-2, 约束-1, 约束-2, 约束-3
- Verify: `bun test packages/web-server packages/kon-spl-dsl packages/web-ide` → 当前切片相关回归通过。
- Outcome:
  - 文件内容转换为明确的行数据，Kon 运行能通过命名内存数据源读取；无文件路径信任。
- Done when:
  - 可重观察的实现与相应证伪测试通过，证据追加到账本。

### 隔离执行与真实时限

- Status: done
- After: 请求内表格绑定与导入
- Covers: 期望-3, 约束-1, 约束-3
- Verify: `bun test packages/web-server/__tests__/execution-limits.test.ts` → 实际循环可终止且下一请求可用。
- Done when:
  - Kon/报表以 worker request/reply 运行，超时/取消清理实例，输入输出限额显式验证。

### 报表 API 与请求隔离

- Status: done
- After: 隔离执行与真实时限
- Covers: 期望-1, 期望-2, 约束-1, 约束-2, 约束-3
- Verify: `bun test packages/web-server packages/kon-spl-dsl packages/web-ide` → 当前切片相关回归通过。
- Outcome:
  - 输入模板与数据返回 XLSX/HTML，异常状态清晰；并发请求不共享数据或模板。
- Done when:
  - 可重观察的实现与相应证伪测试通过，证据追加到账本。

### 网页导入与报表预览下载

- Status: done
- After: 报表 API 与请求隔离
- Covers: 期望-1, 期望-2, 约束-1, 约束-2, 约束-3
- Verify: `bun test packages/web-server packages/kon-spl-dsl packages/web-ide` → 当前切片相关回归通过。
- Outcome:
  - 现有 Kon 入口可导入文件并渲染结果；HTML 预览沙箱隔离。
- Done when:
  - 可重观察的实现与相应证伪测试通过，证据追加到账本。

### 产品面集成验收

- Status: done
- After: 网页导入与报表预览下载
- Covers: 期望-1, 期望-2, 约束-1, 约束-2, 约束-3
- Verify: `bun test packages/web-server packages/kon-spl-dsl packages/web-ide` → 当前切片相关回归通过。
- Outcome:
  - 真实 HTTP 与浏览器运行完整链路，失败不遗留旧报表，既有示例继续可执行。
- Done when:
  - 可重观察的实现与相应证伪测试通过，证据追加到账本。

## 尚未看清

- 无；实现中的新证据先观测再调和，必要时更新本工作图。

## Actual state

- 源头与当前差距来自三主题独立 inventory。尚未对本 mission 写业务代码。

## Last action

- 按用户授权建立完整 harness，等待前序验收。

## Next

- 前序 mission 完成后移到 active，Status 改 active，通过 preflight 后执行第一个节点。

## Decisions and replans

- 报表优先，业务实现按顺序串行；旧 codument 只读。

- evidence → replan：esproc E23 证明同步运行没有真超时；新增隔离执行节点，保护新增真实数据与报表产品链路。

- 当前动作：统一 CSV/表格 bytes 解码；runSplKon 显式 tables 输入绑定到单次 scope。随后 worker 隔离/报表 HTTP/Vue 与浏览器验证。

- 恢复点：全部业务代码已接入，unit/API 与 server/IDE typecheck、root build 通过；Ego space 69 / p1 已实际上传、计算、模板下载、渲染、下载并重新读回，金额20/30正确。QA backend session 68979 / frontend session 15602，端口4186/4184。Ego 留到计算 mission 后最终检查再 finish。
- 自动 E2E 第一次碰到已有4196服务（健康路径404），确认其不属于本任务，未终止；配置改为空闲4294/4296，2 workers，当前命令 bun run test:e2e，session 87397，日志 .tmp-e2e-test.log。通过后更新证据并继续最终回归/归档。

- 最终重观察：所有目标均有真实浏览器/API与错误路径验证，最宽回归331/331及13 E2E通过，模板/源码版本改变后旧预览与下载失效。Next: 归档并激活 dataset-semantics-and-kon-window。
