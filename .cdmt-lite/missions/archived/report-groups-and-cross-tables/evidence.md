# Evidence: 分组与交叉报表

- E1 — 父格图与记录集合 — `bun test packages/report-logic packages/report-xlsx-support` — exit 0 — 16 pass / 56 expects；分组5/4/5、交叉6/3/0/5、重复记录、A0、右侧父格、多行区域、缺格/联合环、嵌套列均通过。
- E2 — 二维真实文件 — Matrix 模板 write/read、宽度与 HTML 投影 — exit 0 — A/B 列与 E/W 行值正确；数据身份空集不回退。每个产品 footer 公式只聚合本列并覆盖扩展行。
- E3 — 重新观测与调和 — SPL 空 sum 实际返回 null，作者显式 if(count==0,0,sum) 得到0，未更改表达式 owner；修复跨 sheet 缓存 UID 复用并增加两表不同分组反例。
- E4 — 最宽回归 — `bun test` — exit 0 — 322 pass / 0 fail / 798 expects / 51 files。
- E5 — 类型/负向边界 — 三包 typecheck、核心 IO/JS eval 搜索、codument 双 SHA256 — exit 0；未引入企业平台。交叠兄弟区域与每行不同列集合明确拒绝，完整几何兼容仍在 backlog。
