请阅读
doc\brainstorm\port-expression-engine\act_4
下，除了 kick.md 之外的文件，
以及 codument\archive\2026-01-19-add-expression-core-ops
中全部的文件
以及 git 提交 340c594ad2b252612c71189d1c4e89e91516405f 的变化
了解上一次功能迭代增加的功能

阅读
git 提交：f10fecc9a157145082ebbedfae7697594c17cc92
中，将typescript的expression新增的能力，添加到demo的方式

了解这些新增底层功能的背景后
创建一个给web-ide下，按照过往添加demo的方式，添加覆盖新增功能的任务

并且在这个任务中，也需要包含修改相关的web-server  spl-flow 或者更多的package ，实现对expression新功能的封装工作

也需要包含，改造后，继续使用playwright进行端到端验证的工作。注意阅读当前 package.json 中，启动server和ide前端服务，需要分别运行两个进程来启动


创建任务的workflow和规范，请参考
.opencode\command\codument-track.md

