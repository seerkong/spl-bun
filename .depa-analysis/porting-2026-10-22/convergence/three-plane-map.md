# 三面与层级

| 面 | 平台 | 领域 | 应用 |
|---|---|---|---|
| 控制 | 当前 runtime 各请求 fresh，保持；见 D4/D7 | 渲染会话单次调度，不建通用 actor；D2 | 输入/执行/模板版本关联、失败失效；D4 |
| 数据 | 表格解码与 XLSX/XML support；D1/D5 | 模板计划、typed tuple、父格记录集；D2/D6 | 查询结果、HTML 与下载均为投影；D4 |
| 扩展 | 公开 contract + 现有包公开面；D1/D7 | evaluator 与 Excel formula 分离；D3 | 原生 Kon window word、上传/报表入口；D4/D6 |

各 D 编号的证据归 [decisions.md](decisions.md)，不在此重盘。
