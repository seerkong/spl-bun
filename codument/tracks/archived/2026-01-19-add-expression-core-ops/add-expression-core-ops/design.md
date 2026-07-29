## 上下文
- 当前 expression 引擎缺少序列/文件/游标成员函数与 json/parse 转换，影响与 Java 版本的核心能力一致性。
- spl-flow 目前仅支持单一 SQLite 连接；act_4 设计已给出多数据源连接的结构化方案。
- 本次仅支持 SQLite/CSV/JSON，不引入 XML 与其他数据源。

## 方案概览
1. 扩展 expression 引擎能力
  - 1.1 新增序列成员函数：select/sort/group/join/derive
  - 1.2 新增文件成员函数：read/write/import/export（仅 CSV/JSON）
  - 1.3 新增游标成员函数：fetch/skip
  - 1.4 新增转换函数：json_parse/json_stringify + json()/parse() 兼容入口
  - 1.5 新增聚合函数：count/icount（Java 语义对齐）
2. 扩展 spl-flow 多数据源连接
  - 2.1 新增 datasource 层（types/factory/sqlite/csv/json）
  - 2.2 新增 connection registry 与 handle 适配表达式引擎
  - 2.3 FlowExecutionContext 支持 dataSourceConfigs 并保持 connections 兼容
3. 测试与兼容性
  - 3.1 新增 expression 单元测试覆盖 member/builtin/aggregation
  - 3.2 新增 spl-flow 数据源单元与集成测试

## 影响范围与修改点（Impact）
- expression：`packages/expression/src`（functions/memberRegistry 等）
- spl-flow：`packages/spl-flow/src`（index.ts + 新增 datasource/connection 目录）
- 测试：`packages/expression/__tests__`、`packages/spl-flow/__tests__`
- 文档：本 track 的 spec/proposal/plan

## 决策
- 决策：CSV/JSON 通过 file 成员函数读写，SQLite 通过 connect 返回数据源 handle。
- 决策：保留 json()/parse()，新增 json_parse/json_stringify 作为明确语义接口。
- 考虑的替代方案：统一用 file.* 处理 SQLite；被否决（SQLite 更适合作为连接型数据源）。

## 风险 / 权衡
- CSV/JSON 读写可能涉及性能与内存开销 → 先保持简单实现，后续再优化。
- connect 的参数结构需要稳定 → 在 spec 中明确参数语义与测试用例。

## 兼容性设计
- 兼容现有 expression 语法与内建函数入口。
- spl-flow 继续支持已有 connections map 与 adapters。

## 迁移计划
- 无需迁移；新能力为可选功能。

## 待解决问题
- 具体 member 函数参数形态（与 Java 对齐的细节）
- csv/json 读写的默认编码与分隔符策略
- connect("sqlite", ...) 参数结构细化
