# Evidence: 动态报表工作表

- S1 — 来源17等价用例 — `bun test packages/report-logic packages/report-xlsx-support` exit0 — 32 pass/141 expects；苹果D:F列克重/大小/颜色、两条记录；香蕉长度/成熟度/存储、一条记录，数据不串；styles/theme原entry逐字节不变，配置sheet及其worksheet part删除，关系/types指向实际克隆。
- S2 — 循环与作用域 — 同上exit0 — 固定封面、空循环、test先于beginLoop、双层循环、变量索引与sheetVarName字段优先级、全局重名/31字符处理、O'Brien转义和匹配实例公式cache均通过；输入bytes/数据不变。
- S3 — 实质恢复 — 初始DS-1因中文标识符失败，在现有公开SPL tokenizer支持Unicode后通过；字典取值用既有field接口，未造旁路求值。原Nop Java初始化明确定位拒绝，调用方params承接数据；绘图clone/rename仍按后续mission精确拒绝，未留错引用。
- S4 — 工程恢复 — HTTP合成用例补齐接口要求的datasets={}；新增xlsx仅作server测试依赖，frozen-lockfile安装复用现有缓存成功。曾同时运行全仓和子集导致既有固定路径SQLite测试库竞态，已停止并改为顺序执行重叠测试批次；不得把该环境竞态掩盖成通过。
- S5 — 最终验收 — `bun test packages/report-logic packages/report-xlsx-support packages/web-server` exit0：49 pass/222 expects/10 files，含HTTP fresh worker动态sheet+SUM cache实际回读；顺序执行 `bun test` exit0：356 pass/0 fail/956 expects/60 files。最终源码 `bun run build` exit0，13包成功；纯logic负向搜索、旧codument双哈希及diff whitespace检查全部通过。
- S6 — 目标重观察 — 重新对照DS-1/2/3、完整MISSION/吸引子、模板配置/循环/part投影和实际输出，当前目标成立；未将drawing/引用重定位等后续能力宣称已完成，下一mission必须继续。
