# External_library_guide 提示包

## 范围
- 源目录: `doc/External_library_guide`
- 节点总数: 35
- 主题页: 35
- 最大树深度: 2

## AI 提示词（复制后使用）
```text
你是一个专注于 `External_library_guide` 的 esProc 文档助手。
只能使用本主题树中已索引的主题信息。
回答时：
1) 先给出直接结论。
2) 尽可能提供分步指引，并附 SPL 示例。
3) 说明限制、可选方案和边界情况。
4) 引用相关主题标题与主题文件路径。
5) 若问题超出本文档范围，请明确说明并指向最接近的主题。
```

## 顶层映射
| Section | Topic Count | Entry Topic | Summary |
| --- | ---: | --- | --- |
| Chapter1 Documentation | 1 | `topics/1.md` | esProc 软件封装了相关文档，点击超链接可阅读。 |
| Chapter2 Introduction | 1 | `topics/2.md` | esProc 可通过 ODBC 或 JDBC 连接数据库，也提供外部库连接能力。 |
| Chapter3 Deployment | 30 | `topics/3.md` | 本章介绍如何在 esProc 主目录下部署外部库功能。 |
| Chapter4 Connection | 3 | `topics/33.md` | 本章说明部署完成后，如何在 esProc IDE 与第三方应用中连接外部库。 |

## 完整树（保留原始结构）
- Chapter1 Documentation (`topics/1.md`)
- Chapter2 Introduction (`topics/2.md`)
- Chapter3 Deployment (`topics/3.md`)
  - 3.1 Alicloud (`topics/4.md`)
  - 3.2 Avro (`topics/5.md`)
  - 3.3 Cassandra (`topics/6.md`)
  - 3.4 Cdc (`topics/7.md`)
  - 3.5 Multidimensional database (`topics/8.md`)
  - 3.6 Dynamodb (`topics/9.md`)
  - 3.7 ElasticSearch (`topics/10.md`)
  - 3.8 Financial (`topics/11.md`)
  - 3.9 FTP file systems (`topics/12.md`)
  - 3.10 GCS platform (`topics/13.md`)
  - 3.11 HBase (`topics/14.md`)
  - 3.12 HDFS file systems (`topics/15.md`)
  - 3.13 Hive (`topics/16.md`)
  - 3.14 InfluxDB (`topics/17.md`)
  - 3.15 Informix (`topics/18.md`)
  - 3.16 Kafka (`topics/19.md`)
  - 3.17 Math (`topics/20.md`)
  - 3.18 Mongo (`topics/21.md`)
  - 3.19 Oss (`topics/22.md`)
  - 3.20 R2dbc (`topics/23.md`)
  - 3.21 Redis (`topics/24.md`)
  - 3.22 S3 (`topics/25.md`)
  - 3.23 Salesforce (`topics/26.md`)
  - 3.24 SAP (`topics/27.md`)
  - 3.25 Spark (`topics/28.md`)
  - 3.26 WAS (`topics/29.md`)
  - 3.27 Webcrawl (`topics/30.md`)
  - 3.28 Webservice (`topics/31.md`)
  - 3.29 Zip (`topics/32.md`)
- Chapter4 Connection (`topics/33.md`)
  - 4.1 Within esProc IDE (`topics/34.md`)
  - 4.2 From a third-party application (`topics/35.md`)

## 检索提示
- 先将用户关键词匹配到章节标题，再向下定位子节点。
- 优先选择标题中包含精确函数名或菜单项的主题。
- 做故障排查时，建议组合一个概念主题和一个操作主题。
- 遇到 API 类问题，优先直接引用函数签名对应主题。
