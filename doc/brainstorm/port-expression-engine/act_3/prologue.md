## 背景
我需要一个能够使用bun运行的，有esProc功能的库，来支持数据相关APP的开发

## 为什么
esProc的查询，能力非常强大。且比较适合与类似excel产品配合

## 所属长期目标
完成esProc项目核心代码从java迁移为bun + typescript

## 上下文
本bun+typescript的workspace在
E:\infra-dev\src\esProc\spl-bun
java版的代码目录在
E:\infra-dev\src\esProc


在上一轮迭代
E:\infra-dev\src\esProc\spl-bun\doc\brainstorm\port-expression-engine\act_2
E:\infra-dev\src\esProc\spl-bun\codument\archive\2026-01-18-update-expression-engine-port

完成了esProc的expression引擎的迁移

而在更早之前，有一个演示性的将早期的typescript版引擎，通过web app用一个使用类excel的编辑器，编辑执行flow, 然后调用接口，解析flow结构, 获取执行结果
当时的迭代记录在
E:\infra-dev\src\esProc\spl-bun\openspec\changes\add-web-ide
E:\infra-dev\src\esProc\spl-bun\openspec\changes\migrate-esproc-dsl-syntax
和这个web-ide相关的包关系是
web-ide : 前端。注意只有http://localhost:4174/ 的默认路径是真正的ide, 其他的路径页面是测试页面
web-server : 后端。注意里面的spl-bun\packages\web-server\data\demo-init.sql 是sqlite初始化db语句内容较多，不建议不经过筛选直接读取
web-shared : 前后端交互的公共接口定义
composer : 将spl-flow与各种adapter进行连接，封装，提供给web-server
sqlite-adapter : spl的sqlite适配
spl-flow : 对expression模块的封装，支持执行使用行列标记的，多步查询流程
[
  {
    "col": "A",
    "row": 1,
    "expr": "demo.query(\"select * from STATES\")"
  },
  ...
]


## 任务要求
1 找到在java版代码实现中，实现使用行列标记的，多步查询流程的核心代码在哪里，将相关文档总结放到doc\brainstorm\port-expression-engine\act_3\spl-flow-java-impl-desc.md
2 我希望，能够重构spl-flow包和web-server包，改为基于上一轮act_2中新增的expression引擎，实现对应java版的多步查询流程，然后能够通过网页中运行，显示到IDE中的结果表格(当前有bug， 调用服务端不会返回结果了， 需要修复， 并且顺便，将/api/execute中原本post array数据改为post object数据，格式如 {"flowDef": []})。
在开始工作前，请你先进行概要设计
将设计实现思路的概要设计，放到
doc\brainstorm\port-expression-engine\act_3\brief-design.md
将影响和修改点的概要设计，放到
doc\brainstorm\port-expression-engine\act_3\brief-impact.md

## 影响/修改点
请自行分析

## 技术约束

## 关键代码

## 测试验证
