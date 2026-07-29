import type { CompiledReport, CompiledSheet, LoopConfig, ReportExpressionRuntime, ReportInput, ReportScope } from "depa-data-report-contract";
import { scopeFor, type ScopeRuntime } from "./scope";

export interface SheetInstance {
  sheet: CompiledSheet;
  context: ScopeRuntime;
  instanceId: string;
  instancePath: readonly number[];
}
function read(runtime: ReportExpressionRuntime, source: string, scope: ReportScope, location: string): unknown {
  try { return runtime.evaluate(source, scope); }
  catch (err) { throw new Error(`${location}: ${err instanceof Error ? err.message : String(err)}`); }
}
function loops(runtime: ReportExpressionRuntime, model: LoopConfig | undefined, scope: ReportScope, defaults: readonly [string,string], limit: number): Record<string, unknown>[] {
  if (!model?.beginLoop && !model?.loopItemsName) return [{}];
  const location = model.location ?? defaults[0];
  const value = read(runtime, model.loopItemsName ?? model.beginLoop!, scope, `${location} beginLoop`);
  const items = value == null ? [] : Array.isArray(value) ? value : [value];
  if (items.length > limit) throw new Error(`${location}: report sheet limit exceeded`);
  const variable = model.loopVarName ?? defaults[0], indexName = model.loopIndexName ?? defaults[1];
  for (const name of [variable,indexName]) if (!/^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(name)) throw new Error(`${location}: invalid loop variable ${name}`);
  if (variable === indexName) throw new Error(`${location}: loop value and index names must differ`);
  return items.map((item,index) => ({ [variable]:item, [indexName]:index }));
}
function allowed(runtime: ReportExpressionRuntime, model: LoopConfig | undefined, scope: ReportScope): boolean {
  return !model?.testExpr || Boolean(read(runtime, model.testExpr, scope, `${model.location ?? "Report"} testExpr`));
}
function uniqueName(raw: unknown, fallback: string, used: Set<string>): string {
  if (raw !== null && raw !== undefined && !["string","number","boolean"].includes(typeof raw)) throw new Error("sheetNameExpr must return a scalar");
  const cleaned = String(raw ?? "").trim().replace(/[:\\/?*\[\]\x00-\x1f]/g,"_").replace(/^'+|'+$/g,"");
  const fallbackName = fallback.trim().replace(/[:\\/?*\[\]\x00-\x1f]/g,"_").replace(/^'+|'+$/g,"");
  const base = (cleaned || fallbackName || "Sheet").slice(0,31);
  let result = base, count = 0;
  while (used.has(result.toLowerCase())) {
    const suffix = `(${++count})`;
    result = base.slice(0,31-suffix.length) + suffix;
  }
  used.add(result.toLowerCase()); return result;
}

/** Template identity, output name and loop bindings are independent projections. */
export function instantiateSheets(runtime: ReportExpressionRuntime, template: CompiledReport, data: ReportInput, maxSheets: number): SheetInstance[] {
  const initial: ScopeRuntime = { input: data, views: new Map() };
  const rootScope = scopeFor(initial,[],[]);
  if (!allowed(runtime,template.config,rootScope)) return [];
  const workbooks = loops(runtime,template.config,rootScope,["workbookLoopVar","workbookLoopIndex"],maxSheets);
  const used = new Set<string>();
  const result: SheetInstance[] = [];
  workbooks.forEach((workbookBindings,workbookIndex) => {
    for (const [sourceIndex,source] of template.sheets.entries()) {
      const parentInput: ReportInput = { ...data, params:Object.freeze({ ...data.params,...workbookBindings }) };
      const parentScope = scopeFor({ input:parentInput,views:new Map() },[],[]);
      if (!allowed(runtime,source.config,parentScope)) continue;
      const sheetLoops = loops(runtime,source.config,parentScope,["sheetLoopVar","sheetLoopIndex"],maxSheets);
      sheetLoops.forEach((bindings,sheetIndex) => {
        if (result.length >= maxSheets) throw new Error(`${source.name}: report sheet limit exceeded`);
        const input: ReportInput = { ...data,params:Object.freeze({ ...parentInput.params,...bindings }) };
        const context: ScopeRuntime = { input,views:new Map() };
        const scope = scopeFor(context,[],[]);
        if (source.config?.sheetVarName) {
          const object = read(runtime,source.config.sheetVarName,scope,`${source.config.location ?? source.name} sheetVarName`);
          if (!object || typeof object !== "object" || Array.isArray(object)) throw new Error(`${source.name}: sheetVarName must address an object`);
          context.sheetObject = object as Readonly<Record<string,unknown>>;
        }
        const name = uniqueName(source.config?.sheetNameExpr ? read(runtime,source.config.sheetNameExpr,scopeFor(context,[],[]),`${source.config.location ?? source.name} sheetNameExpr`) : source.name,source.name,used);
        const instanceId = `${sourceIndex}/${workbookIndex}/${sheetIndex}`;
        context.sheetInfo = Object.freeze({ name,sourceSheetId:source.sourceSheetId,instanceId,index:sheetIndex });
        result.push({ sheet:{ ...source,name },context,instanceId,instancePath:[workbookIndex,sheetIndex] });
      });
    }
  });
  return result;
}
