# 变更：Expression Phase 1 核心能力（序列/文件/游标 + JSON/Parse + count/icount + spl-flow 数据源）

## 背景和动机 (Context And Why)
TypeScript 版 expression 引擎与 spl-flow 仍缺少 Java 版本中用于核心数据处理的序列/文件/游标成员函数与类型转换能力，阻碍 esProc 兼容性迁移与多数据源接入。补齐这些高优能力是后续功能扩展的基础。

## “要做”和“不做” (Goals / Non-Goals)
**目标:**
- 实现序列成员函数 select/sort/group/join/derive，并确保与 Java 语义一致
- 实现文件成员函数 read/write/import/export，限定 CSV/JSON（SQLite 通过 connect 返回数据源对象）
- 实现游标成员函数 fetch/skip，语义与 Java 一致
- 实现 json/parse 转换能力，保留 json()/parse() 兼容入口，并新增 json_parse/json_stringify
- 实现聚合函数 count/icount（与 Java 语义一致）
- 在 spl-flow 中支持多数据源连接（SQLite/CSV/JSON），并保持现有 connections 兼容
- 补充对应的单元与集成测试

**非目标:**
- 不实现 XML 相关功能
- 不实现聚合函数 mode/rank（本次仅 count/icount）
- 不引入并行操作、通道、VDB、Excel 能力
- 不扩展除 json/parse 之外的其他转换函数
- 不支持 SQLite/CSV/JSON 之外的数据源

## 变更内容（What Changes）
- 扩展 expression member registry：序列、文件、游标成员函数
- 增加 json/parse 及 json_parse/json_stringify 转换函数实现
- 增加 count/icount 聚合函数
- 在 spl-flow 增加 dataSourceConfigs 与数据源工厂/registry/handle 以支持 SQLite/CSV/JSON
- 增加单元与集成测试覆盖新增功能

## 影响范围（Impact）
- 受影响的功能规范：expression 函数库与 member 函数分发、spl-flow 连接层
- 影响模块：`packages/expression`、`packages/spl-flow`
