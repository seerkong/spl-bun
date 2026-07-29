当前项目中，我已经将本次原始需求
doc\brainstorm\port-expression-engine\act_4\prologue.md
进行了分析，写入到了文件中

请根据
下面这两个文件中的变更内容
doc\brainstorm\port-expression-engine\act_4\brief-design.md
doc\brainstorm\port-expression-engine\act_4\brief-impact.md

以及
doc\brainstorm\port-expression-engine\act_4\engine-feature-diff.md
中提到的建议 高优第一阶段要作的内容集合，再去掉xml后的剩余部分， 即如下部分
```
## 6. Priority Gap Analysis

### High Priority (Core Data Processing)
1. **Sequence operations:** select, sort, group, join, derive - Essential for data transformation
2. **File operations:** read, write, import, export - Essential for file-based data sources
3. **Cursor operations:** fetch, skip - Essential for large dataset handling
4. **Type conversion:** json, parse - Essential for data interchange
5. **Additional aggregations:** count, icount, mode, rank - Common data analysis needs

### Phase 1: Core Data Operations (High Priority)
- Implement sequence member functions: select, sort, group, join, derive
- Add file member functions: read, write, import, export
- Add type conversion functions: json, parse
- Implement cursor basic operations: fetch, skip

```

请按照codument track 规范初始化任务