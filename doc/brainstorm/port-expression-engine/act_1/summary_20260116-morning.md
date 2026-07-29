# Todos
[✓] 
Scan Java expression engine for member function system, gather lifecycle, and type taxonomy details
[✓] 
Implement member function dispatch (member calls) in TS expression engine
[✓] 
Implement Gather lifecycle abstraction and integrate with DataSet aggregation
[✓] 
Add DB/File/Cursor typed values and helpers in expression/types
[✓] 
Add tests for member functions, gather lifecycle, and typed values
[✓] 
Run relevant tests and fix failures
[✓] 
Regenerate comparison table against Java expression
[✓] 
Iteratively implement remaining gaps found in comparison
实现完成并更新对比表，测试通过。
新增/迁移内容：
- 表达式解析：支持 [] 序列和 {} 记录字面量；逗号运算符 , 的优先级与求值（顺序执行、返回最后值）。
- 成员函数体系：member_call 解析与执行、member registry（count/sum/avg/min/max/first/last）与 calc() 支持。
- Gather 生命周期：新增 core gather.ts 与 aggregateWithGather。
- 类型系统：DB/File/Cursor typed wrapper + 推断支持。
- 控制流参数树：ifp/casep 支持 ;/: 形式。
测试：
- 已跑并通过：  
  bun test packages/expression/__tests__/expression.test.ts packages/expression/__tests__/paramParser.test.ts packages/expression/__tests__/types.test.ts packages/expression/__tests__/registry.test.ts packages/core/__tests__/dataset.test.ts --bail
对比表更新：
- spl-bun/doc/core-engine/feature-diff-20260116.md 已更新为最新缺口列表（仍剩：VDB/XO/IO/表函数、regather/finish、多态加载等）。
若要继续补齐剩余缺口，请指定优先级（例如：先 IO/表函数，或先 regather/finish），否则我将按“聚合生命周期 + IO/表函数”顺序继续。
<promise>DONE</promise>