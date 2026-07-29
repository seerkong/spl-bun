# Evidence: 报表空间布局与单元格处理

- L1 — 空间反例 — `bun test packages/report-logic packages/report-xlsx-support` exit0：38 pass/175 expects。inplace预留3格2/3项不移TAIL、4项只移1；同父兄弟3/2仅占3行、短项无伪实例；fixed extend true/false；父在三行body中间；行内列、列内行、row→col→row交替依赖均通过。
- L2 — 调和 — 源插槽/复用算法适合依赖实例表，弃独立axis+overlay假说，删除旧执行路径。创建顺序不等于物理顺序，最终实例索引先sort再求值，财务4100回归恢复。单槽上方/左侧header不应被补成后代，修默认继承后原位静态C/D标签保持；保留目标既有多行body兼容。编译期bands仅推导父关系，不是第二布局真源。

- L3 — 单元格处理与最终重观察 — `bun test packages/report-logic packages/report-xlsx-support packages/web-server` exit0：62 pass / 298 expects；`bun test` exit0：369 pass / 1032 expects / 62 files；`bun run build` exit0，13包通过。原位2/4项及删除0项的真实XLSX回读TAIL、邻格、数据正确；hidden/removed、样式/SSF/raw-display-export、字典、三引号、field标量/数组、pure patch依赖与非法patch反例通过。
- L4 — AT1与只读边界重观察 — logic无fs/Bun.file/new Function/eval匹配；已删除旧expandAxis执行器；逐个重读layout/render/visibility/cell-processing：实例表拥有空间身份，codec只投影最终值，输入palette和records不反写。Codument tracked diff SHA256仍7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049，untracked清单仍1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e。
- L5 — 返回条件复核 — 本mission验收过线，但整体目标仍有文档引用/图像图表与SPL ready节点；不符合整体返回条件，归档后立即继续report-document-reference-projection。
- L6 — harness写入恢复 — 首次Python写入遇到编码声明错误，completion正确拒绝未勾选状态；恢复active后显式UTF-8写入，重新执行闸门，业务文件与验收结果不受影响。
