# Decisions

## Usage
- 用于记录需要用户确认的决策问题、选项、最终结论与理由
- 本 track 的关键决策已在上游 mission（codument/missions/active/kon-spl-dsl）G1/G2 阶段以 evidence + 用户两轮输入定案；此处自包含记录结论

### 1. 【P0】kunun 依赖方式
- 选项：A) bun file: 依赖 B) 直接 import dist bundle C) tsconfig paths 映射 kunun lib 源码
- 最终决策：C
- 决策理由：A 实测失败（workspace:* 外部不可解析）；B 缺类型且 dist 可能滞后；C 实测通过、类型完整、kunun 零改动
- 状态：resolved

### 2. 【P0】SPL `func@sub` 选项的 Kon 表达
- 选项：A) `#opt = 串`（Metadata） B) `@x` 省值 Attr C) Conf 普通键
- 最终决策：A 为权威 + B 为单选项糖（优先级 A>B）；展开器沿 Next 链合并读取
- 决策理由：用户约束 U2（系统级元数据键值 + 省值特性）；实测 `#tag` 省值落 Name 不可承载选项、Attr 与 `:{}` 同现分裂 Next
- 状态：resolved

### 3. 【P1】异步边界
- 最终决策：全同步；spl-flow 新增 evaluateFlowSync；不接 workflow yield
- 决策理由：kunun 解释器同步 dispatch，Promise 结果丢失（实测）；sqlite 底层本为同步
- 状态：resolved

### 4. 【P1】word 配置槽位
- 最终决策：普通配置一律 Conf(`:{}`)，命名 `#name`，不用根层级具名槽位
- 决策理由：用户约束 U1
- 状态：resolved

### 5. 【P2】命名结果的变量绑定
- 最终决策：`#name` 时 push 结果 + 在当前 env 定义同名变量（**T2.2 实测确认可行，已实现并测试锁定**：kunun RuntimeState 有公开 `define(key, obj)`（RuntimeState.ts，底层 `getCurrentEnv().Define()`，与 `var` 关键字同一机制）；prefix 展开为 lazy（执行到该节点才展开），展开时 define 后后续 Kon 表达式即可引用。无需退化路径，delta 的 named-result-binding case 原文保留）
- 状态：resolved（回写完成）
