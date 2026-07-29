一、现在可以在web端下拉选择demo了，接下来需要进行数据结构调整。
我看到demo的配置格式，是step列表，这样不符合未来的发展路线
在java版的spl，是有能力支持嵌套结构，表达复杂流程控制，比如循环的。在java版的spl，这种结果，会利用表格中的其他列。用类excel表格表达出类似代码的节点树结构
因此，
1 示例的配置，也应当是类似我之前设计的接口请求参数一样，使用row, col, expr表示行、列、表达式，配置执行的流程结构

[
  {
    "row": 1,
    "col": "A",
    "expr": "demo.query(\"select NAME, POPULATION from STATES order by POPULATION desc limit 10\")"
  },
  {
    "row": 2,
    "col": "A",
    "expr": "A1.first().field(\"POPULATION\")"
  },
  {
    "row": 3,
    "col": "A",
    "expr": "demo.query(\"select NAME, POPULATION from STATES where POPULATION = ?\", A2)"
  }
]


2
在服务端内部，执行spl-flow的部分，应当将这样的表示表格行、列、表达式代码的列表，转换为一个flow级别语法树结构，然后解释执行， 以便支持未来复杂的语法控制结构。而不是仅使用线性列表
树结构，当前需要有节点类别 expression、sequence
例如，前面的请求入参示例，在spl-flow内部，应当转换为这样的语法树，再解释执行这个树
{
  "type": "sequence",
  "block": [
    [
      {
        "type": "expression",
        "position": {
          "row": 1,
          "col": "A"
        },
        "expr": "demo.query(\"select NAME, POPULATION from STATES order by POPULATION desc limit 10\")"
      },
      {
        "type": "expression",
        "position": {
          "row": 2,
          "col": "A"
        },
        "expr": "A1.first().field(\"POPULATION\")"
      },
      {
        "type": "expression",
        "position": {
          "row": 3,
          "col": "A"
        },
        "expr": "demo.query(\"select NAME, POPULATION from STATES where POPULATION = ?\", A2)"
      }
    ]
  ]
}


3
另外server端，给前端返回的API结果的结构，返回的steps，也应当是使用相同字段风格
修改前，当前steps内的对象结构是这样
{
  "expression": "demo.query(\"select NAME, POPULATION from STATES where POPULATION = ?\", A2)",
  "row": 3,
  "col": "A",
  "status": "ok",
  "value": {
    "columns": [
      "NAME",
      "POPULATION"
    ],
    "rows": [
      {
        "NAME": "California",
        "POPULATION": 37253956
      }
    ]
  },
  "data": {
    "columns": [
      "NAME",
      "POPULATION"
    ],
    "rows": [
      {
        "NAME": "California",
        "POPULATION": 37253956
      }
    ]
  }
}


修改后，返回结构应该是这样
{
    "expr": "demo.query(\"select NAME, POPULATION from STATES where POPULATION = ?\", A2)",
    "row": 3,
    "col": "A",
    "status": "ok",
    "result": {
        "columns": [
            "NAME",
            "POPULATION"
        ],
        "rows": [
            {
                "NAME": "California",
                "POPULATION": 37253956
            }
        ]
    }
}

请改造后，继续使用playwright进行端到端验证。启动时要注意清理残留的端口占用进程

二、过去每次用bun run web-ide:dev启动web-ide和web-server的开发模式，关闭后，都会残留端口占用的进程，你需要修复这个问题


