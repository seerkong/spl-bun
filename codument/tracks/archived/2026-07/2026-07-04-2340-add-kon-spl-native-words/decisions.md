# Decisions

## Usage
- 记录本 track 决策；上游依据：mission kon-spl-dsl 的 G2 设计（analysis/spl-kon-dsl-design.md §4 映射表）与 G3 反馈（reports/verify-g3.md），关键事实已自包含于本 track analysis/findings.md

### 1. 【P1】原生 word 是否接受 #opt/@ 选项
- 选项：A) 接受并映射到底层成员函数选项 B) 不接受，模式经 Conf 键表达（desc 等），误用报错
- 最终决策：B
- 决策理由：原生 word 直接调 DataSet API（withComputedColumns/filterExpr/aggregate/join），无成员函数选项通道；Conf 键更贴合 Kon 习惯且自文档化；`#opt` 语义保留给透传层（spl_eval），避免同一记号两义
- 状态：resolved

### 2. 【P1】word 清单与裁剪
- 最终决策：derive/select/groups/sort/join/top 六个；window 裁剪入 mission backlog
- 决策理由：G3 反馈优先级（derive/select 最痛、groups 映射价值最大）；window 无痛点反馈且工作量大
- 状态：resolved

### 3. 【P2】spl_top 实现
- 最终决策：排序后取前 n（word 内 sort+slice 或复用 aggregateWithGather top，以引擎实测为准），语义锁定为「by 列 desc 方向的前 n 行」
- 状态：resolved（实现期按引擎能力选路径并回写 findings）
