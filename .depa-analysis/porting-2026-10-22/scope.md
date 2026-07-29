# 分析范围

本次按系统边界与包职责作标准深度分析。spl-bun 是实施目标；esProc 是计算能力参照；nop-report 只参照 Excel 模板到报表的编译、展开、格式与导出语义。kunun.ts 和 infra-dev 下已采用的基础库是依赖事实，不重复实现。

范围内：当前产品入口、表格数据输入、kon-spl-dsl/flow、序表计算、Excel 报表渲染、历史 codument 轨迹与实际代码差异、可执行验收。

范围外：nop-entropy 的 ORM、工作流、认证、企业应用框架；恢复已外迁的业务领域；Java 原表达式编辑模式；擅自变动外部源码库或现有用户改动。esProc 中尚未确认产品需求的外部系统连接器、分布式与专用算法先盘点，不把文件库存自动当作公开产品面。

实施方式：depa-expert 做边界盘点，cdmt-mission-lite 做唯一新增执行 harness。用户已授权建多个 mission 并顺序实施。
