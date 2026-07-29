扫描当前
packages\expression
代码，与java版本的实现
../src/main/java/com/scudata/expression
../src/main/java/com/scudata/excel
../src/esProc/src/main/java/com/scudata/chart
进行对比，结合act_4提到的剩余未做的内容
doc/brainstorm/port-expression-engine/act_4/engine-feature-diff.md

特别要关注
- excel集成
- chart渲染
- act_4/engine-feature-diff.md 中提到的 Phase 2: Enhanced Functionality (Medium Priority)相关功能

将功能对比写入到
doc\brainstorm\port-expression-engine\act_6\engine-feature-diff.md
另外将待实现功能的的关键文件，使用便于索引、渐进式加载的方式，有层次结构的分类，生成多份目录和文档，存放在 doc/feature-findings/
便于后续实现还欠缺的功能