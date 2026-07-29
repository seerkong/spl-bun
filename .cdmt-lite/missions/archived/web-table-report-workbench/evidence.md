# Evidence: 网页表格与报表工作台

- W1 — 表格与 Kon 接缝 — spl-flow/kon 195 tests 通过；新增 named tables 测试通过；CSV 引号/换行/BOM/前导零、JSON 后行字段、Excel sheet/空 schema 通过。
- W2 — 隔离执行 — 12 个 Kon/worker tests 通过；真实 goto A1 无限循环在100ms执行时限终止，取消/容量/下次42通过。
- W3 — HTTP vertical slice — 3 report workbench tests 通过；CSV→Kon金额20/30→模板→HTML/XLSX回读、错误输入与HTTP超时恢复通过。multipart字段被Elysia预解码，适配后重跑通过。
- W4 — 新产品面 — Ego space69 p1实际操作并下载 .tmp/porting-report-qa/report.xlsx，独立 XLSX.read 得到A3=001、E3=20、E4=30；HTML显示转义的<b>A</b>文本。390px viewport document width=390，移动端预览实际可见。
- W5 — 工程基线 — 149个 web-server/kon/IDE tests、IDE/server typecheck、13包 root build 全通过；E2E端口冲突恢复见loop，尚待最终结果。

- W6 — 浏览器重观察 — `bun run test:e2e` — exit 0 — 13 passed / 20.6s，含真实文件/计算/模板/下载、手机无外溢、在途响应失效以及旧Kon demo全回归。端口冲突后使用4294/4296；没有终止其他应用。
- W7 — 最宽相关回归 — `bun test` — exit 0 — 331 pass / 0 fail / 838 expects / 55 files；`bun run build` — exit 0 — 全13包通过。

- W8 — 最终验收重跑 — web-server/kon/IDE命令149 pass、独立worker时限2 pass；root build已在最终源码重跑通过；负向架构与codument哈希检查通过。
