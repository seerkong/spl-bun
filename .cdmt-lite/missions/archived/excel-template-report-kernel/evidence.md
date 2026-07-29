# Evidence: Excel 模板报表内核

- E1 — 契约/批注/行展开 — `bun test packages/report-logic packages/report-xlsx-support` — exit 0 — 7 pass / 37 expects；模板数据、参数、空集、去空行、限制、定位和输入不变。
- E2 — XLSX 来源重观察 — 合成工作簿实际 write/read + 原 ZIP entry 比较 — exit 0 — styles/theme 字节相同、B3 数值/0.00、三合并区域、复制行高、无报表注解；HTML 转义并投影填充/数字格式。
- E3 — 失败假说与恢复 — 首次 CFB relative find 返回 null，改为绝对容器路径；修正全量 scope 包清单，保留所有退休领域负向检查；其后相关回归通过。
- E4 — 最宽回归 — `bun test` — exit 0 — 313 pass / 0 fail / 779 expects / 50 files。
- E5 — 类型与负向边界 — `bun run --filter 'depa-data-report-*' typecheck`、logic IO/eval 搜索、codument 双 SHA256 — exit 0 — 三包通过、无核心 IO/JS eval、旧轨迹未变。
