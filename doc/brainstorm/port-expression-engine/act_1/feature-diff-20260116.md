# esProc Java vs TypeScript core engine gaps (2026-01-16)

Scope: Compare Java execution engine (`src/main/java/com/scudata/expression`) with TS reimplementation (`spl-bun/packages/{expression,core}/src`). Focus on features present in Java but not yet in TS.

## Summary
- TS now covers richer operators (assignment/compound, set, member access/calls, comma sequencing), control-flow functions (if/case + param-tree variants), broader math/string/datetime function set, macro replacement, param tree parsing, typed evaluation with explicit DB/File/Cursor wrappers, function registry builder, member function registry for array/dataset-like objects, gather lifecycle abstraction integrated into DataSet aggregation, plus list/record literal parsing and evaluation.
- Major Java capabilities still missing: comprehensive member function system across engine types (table/record/cursor/VDB/XO), full data-type taxonomy and DBObject semantics, advanced aggregation lifecycle (regather/finish phases), dynamic function overload resolution, and large IO/table function library.

## Detailed gaps

| Area | Java (present) | TS status | Gap |
| --- | --- | --- | --- |
| Operators | Arithmetic, comparisons, logical; plus assignment/compound, set/relational, member access, comma sequencing | Arithmetic/comparison/logical; assignment/compound; set ops; member access/calls; comma sequencing | Set semantics for non-array types still incomplete
| Parser features | ParamParser with hierarchical params (; , :), macro replacement ($), recursive descent with optimization hooks | Recursive descent; macro replacement and param tree parser added | Optimization hooks still missing
| AST/Eval | Node with calculate/calculateAll/calculateAnd; type inference; constant folding; Gather multi-phase aggregation; MemberFunction dispatch | Simple AST interpreter; typed evaluation helper; gather abstraction only in DataSet | Missing bulk/short-circuit hooks, regather/finish phases
| Functions (global) | Extensive math, string, datetime, convert (json/xml/format), algebra, aggregation, control flow | Expanded math/string/datetime + if/case/ifp/casep; still partial | Missing conversions (json/xml), algebra, advanced aggregations
| Member functions | Large mfn library: sequence/table/record/cursor/file/XO/DB/VDB ops | Member registry for arrays/dataset-like (count/sum/avg/min/max/first/last + calc) | Missing full member function system and IO support
| Data types | Expression.TYPE_DB/FILE/SEQUENCE/TABLE/CURSOR/OTHER/UNKNOWN; Constant supports DBObject | Typed wrappers for DB/File/Cursor; basic inference for arrays/objects | Missing DBObject semantics and richer type checks
| Aggregation & window | Gather prepare/gather/finish, regather; table functions | Gather abstraction (sum/count/avg) + DataSet aggregateWithGather | Missing regather, finish phases, table ops
| Control flow | Functions If/Case; Calc for sequence iteration (A.(x)) | if/case + param variants; calc for arrays/dataset-like | Missing full sequence iteration semantics
| Function registry | FunctionLib (global + member), dynamic loading/creation | Registry builder for global functions; member registry | Missing dynamic loading/overload resolution
| Error handling | Step-aware errors in Node/Gather; type mismatch checks in MemberFunction | Basic StepError in execution.ts; minimal eval errors | Lacks rich diagnostics and type checks
| Expression integration with datasets | Table/record functions tightly integrated with engine types | DataSet supports expressions for filter/compute/window keys | Many table/record ops not exposed in TS

## Remaining work
1) Member function system for table/record/cursor/VDB/XO and IO functions.
2) Regather/finish phases for Gather and advanced aggregations.
3) Dynamic function overload resolution and loading.
4) Convert/json/xml/algebra function families.
5) Calc/sequence iteration semantics (full parity).
