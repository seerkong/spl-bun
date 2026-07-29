export type { CompiledExpression, ExpressionNode } from "./ast";
export { compileExpression, evaluateExpression } from "./evaluator";
export { parseJsonPreservingNumbers, stringifySplJson } from "./json";
export { splParse } from './parse-conversion';
export { builtins, withCustomFunctions, type FunctionRegistry } from "./functions";
export { truthy, isNullish } from "./utils";
export { parseParamTree, evalParamTree, type ParamNode, type ParamSeparator, type ParamLeafEvaluator } from "./paramParser";
export { replaceMacros, type MacroContext } from "./macro";
export { ifp, casep } from "./paramFunctions";
export {
  TYPE_DB,
  TYPE_FILE,
  TYPE_SEQUENCE,
  TYPE_TABLE,
  TYPE_CURSOR,
  TYPE_OTHER,
  TYPE_UNKNOWN,
  type ExpressionValueType,
  type TypedValue,
  type TypedWrapper,
  type DbHandle,
  type FileHandle,
  type CursorHandle,
  makeTyped,
  makeDbHandle,
  makeFileHandle,
  makeCursorHandle,
  getValueType,
} from "./types";
export { evaluateTypedExpression } from "./evaluator";
export { FunctionRegistryBuilder } from "./registry";
export { MemberFunctionRegistry, defaultMemberRegistry, type MemberFunction, type MemberExpressionFunction, type MemberExpressionRuntime } from "./memberRegistry";
export { createTupleIndex, getTuple, setTuple, tupleEntries, compareScalarValues, type TupleIndex } from "./tuple-index";
export { aggregateValues, aggregateInput, numericValue, numericValues, type AggregateKind } from "./aggregation";
export { compileBoundExpression, tableRowScope, assertKnownColumns } from "./binding";
export { sortRows, type SortProjection, type SortOptions } from './sorting';
export { compileAggregateExpression } from "./aggregate-expression";
export { windowTable, type SortDirection, type OrderBySpec, type WindowSpec, type WindowOutputs, type WindowOffset, type WindowFrame } from "./window";
export { decimal, long, isDecimal, isSplNumber, numericBinary, numericCompare, scalarEquals, scalarCompare, type SplNumber } from "./scalar";
export { Cursor, type CursorSource, type CursorIterator, type CursorOptions, type CursorState } from "./cursor";
export { selectCursor, projectCursor, deriveCursor } from "./cursor-transform";
export { pivotTable, unpivotTable, joinTables, type PivotSpec, type UnpivotSpec, type TableJoinSpec, type TableJoinType, type TableInput, type TableValue } from "./table-transform";

export { renameTable, alterTable, indexTable, groupedRows, groupColumns, ungroupColumns, groupDimensions, type AlterColumn, type GroupColumnsSpec, type UngroupColumnsSpec, type TableIndex } from "./table-transform";
