import type { CompiledCell, RenderedCell, RenderedReport, RenderedSheet, ReportExpressionRuntime, ReportScope, ReportConfig, ReportStyle } from "depa-data-report-contract";
import type { ExpansionItem } from "./scope";
import { cellAddress, parseAddress } from "./coordinates";
import { evaluateFormulaNode, FormulaCellSet, isReportFormula, parseFormula, scalar, UnsupportedFormula, type FormulaCellView, type FormulaEnvironment, type FormulaReference } from "./formula-expression";
import { formulaFunctions } from "./formula-functions";
import { exportReportFormula } from "./formula-export";
import { formulaMaterializationReason } from "./formula-export-policy";
import { applyCellProcessing } from "./cell-processing";

export interface FormulaInstance {
  cell: RenderedCell;
  source: CompiledCell;
  sheet: RenderedSheet;
  scope: ReportScope;
  rows: readonly ExpansionItem[];
  cols: readonly ExpansionItem[];
  base(): unknown;
  rowParent?: FormulaInstance;
  colParent?: FormulaInstance;
}
function shares(items: readonly ExpansionItem[], item: ExpansionItem): boolean { return items.some(other => other.uid === item.uid); }
function intersect(a: readonly FormulaInstance[], b: readonly FormulaInstance[]): FormulaInstance[] {
  const other = new Set(b); return a.filter(item => other.has(item));
}

/** Request-local dependency state. Rendering and serialization consume the same values. */
export function evaluateReportCells(runtime: ReportExpressionRuntime, report: RenderedReport, instances: readonly FormulaInstance[], processing: { styles?: Readonly<Record<string,ReportStyle>>; config?: ReportConfig } = {}): void {
  const state = new Map<FormulaInstance, "visiting" | "processing" | "done">();
  const stack: FormulaInstance[] = [];
  const named = new Map<RenderedSheet, Map<string, FormulaInstance[]>>();
  const physical = new Map<RenderedSheet, Map<string, FormulaInstance>>();
  const astCache = new Map<string, ReturnType<typeof parseFormula>>();
  const label = (instance: FormulaInstance) => `${instance.sheet.name}!${cellAddress(instance.cell)}[${instance.source.address}]`;
  const byId = new Map(instances.map(instance => [label(instance), instance]));
  for (const sheet of report.sheets) { named.set(sheet, new Map()); physical.set(sheet, new Map()); }
  for (const instance of instances) {
    const groups = named.get(instance.sheet)!;
    const list = groups.get(instance.source.address) ?? []; list.push(instance); groups.set(instance.source.address, list);
    physical.get(instance.sheet)!.set(cellAddress(instance.cell), instance);
  }
  const parents = { rows: new Map<FormulaInstance, FormulaInstance>(), cols: new Map<FormulaInstance, FormulaInstance>() };
  const descendants = { rows: new Map<FormulaInstance, Map<string, FormulaInstance[]>>(), cols: new Map<FormulaInstance, Map<string, FormulaInstance[]>>() };
  for (const axis of ["rows", "cols"] as const) {
    const lookup = new Map<RenderedSheet, Map<string, Map<string, FormulaInstance[]>>>();
    for (const instance of instances) {
      let sheetIndex = lookup.get(instance.sheet);
      if (!sheetIndex) { sheetIndex = new Map(); lookup.set(instance.sheet, sheetIndex); }
      let addressIndex = sheetIndex.get(instance.source.address);
      if (!addressIndex) { addressIndex = new Map(); sheetIndex.set(instance.source.address, addressIndex); }
      const key = instance[axis].map(item => item.uid).join("/");
      const list = addressIndex.get(key) ?? []; list.push(instance); addressIndex.set(key, list);
    }
    for (const instance of instances) {
      const explicit = axis === "rows" ? instance.rowParent : instance.colParent;
      if (explicit) { parents[axis].set(instance,explicit); continue; }
      const address = axis === "rows" ? instance.source.rowParentAddress : instance.source.colParentAddress;
      if (!address) continue;
      const addressIndex = lookup.get(instance.sheet)?.get(address);
      let candidates: FormulaInstance[] = [];
      for (let length = instance[axis].length; length >= 0; length--) {
        const key = instance[axis].slice(0, length).map(item => item.uid).join("/");
        const local = addressIndex?.get(key);
        if (local?.length) { candidates = local; break; }
      }
      let best: FormulaInstance | undefined, bestScore = -1;
      for (const candidate of candidates) {
        if (candidate[axis].some(item => instance[axis].some(other => other.anchor === item.anchor && other.uid !== item.uid))) continue;
        const samePosition = axis === "rows" ? candidate.cell.row === instance.cell.row : candidate.cell.col === instance.cell.col;
        const score = candidate[axis].filter(item => shares(instance[axis], item)).length * 2 + Number(samePosition);
        if (score > bestScore) { best = candidate; bestScore = score; }
      }
      if (best) parents[axis].set(instance, best);
    }
    for (const instance of instances) {
      let parent: FormulaInstance | undefined = instance;
      const visited = new Set<FormulaInstance>();
      while (parent) {
        if (visited.has(parent)) throw new Error(`${label(instance)}: cyclic instance parent graph`);
        visited.add(parent);
        let byName = descendants[axis].get(parent);
        if (!byName) { byName = new Map(); descendants[axis].set(parent, byName); }
        const list = byName.get(instance.source.address) ?? []; list.push(instance); byName.set(instance.source.address, list);
        parent = parents[axis].get(parent);
      }
    }
  }
  function contextual(address: string, current: FormulaInstance, axis: "rows" | "cols"): FormulaInstance[] | undefined {
    let parent: FormulaInstance | undefined = current;
    while (parent) {
      const list = descendants[axis].get(parent)?.get(address);
      if (list?.length) return list;
      parent = parents[axis].get(parent);
    }
    return undefined;
  }
  function sheetFor(name: string | undefined, current: FormulaInstance): RenderedSheet {
    let sheet = name === undefined ? current.sheet : report.sheets.find(sheet => sheet.name === name);
    if (!sheet && name !== undefined) {
      const candidates = report.sheets.filter(other => other.sourceSheetId === name || other.sourceSheetName === name);
      sheet = candidates.find(other => other.instancePath?.[0] === current.sheet.instancePath?.[0]
        && other.instancePath?.[1] === current.sheet.instancePath?.[1]) ?? candidates.find(other=>other.instancePath?.[0]===current.sheet.instancePath?.[0]) ?? candidates[0];
    }
    if (!sheet) throw new Error(`Unknown formula sheet ${name}`);
    return sheet;
  }
  function layered(current: FormulaInstance, candidates: readonly FormulaInstance[], path: string, axis: "rows" | "cols", sheet: RenderedSheet): FormulaInstance[] {
    let parent: FormulaInstance | undefined;
    for (const part of path.split(",").map(p => p.trim()).filter(Boolean)) {
      const match = /^([A-Z]+[1-9]\d*)(?::(!?)([+-]?\d+))?$/i.exec(part);
      if (!match) throw new Error(`Invalid formula layer ${part}`);
      const address = match[1].toUpperCase();
      let anchors = named.get(sheet)?.get(address) ?? [];
      if (parent) {
        anchors = descendants[axis].get(parent)?.get(address) ?? [];
      } else {
        // A layer addresses siblings of the current named ancestor, rather than
        // descendants of that ancestor. Its parent bindings determine the scope.
        const bindingIndex = current[axis].findIndex(item => item.anchor === address);
        const preceding = bindingIndex < 0 ? current[axis] : current[axis].slice(0, bindingIndex);
        for (const binding of [...preceding].reverse()) {
          const local = anchors.filter(anchor => shares(anchor[axis], binding));
          if (local.length) { anchors = local; break; }
        }
      }
      // Merged parent cells can have one instance for a whole descendant band.
      const unique = new Map<string, FormulaInstance>();
      for (const anchor of anchors) {
        const binding = anchor[axis].find(item => item.anchor === address);
        unique.set(binding?.uid ?? `${anchor.cell.row},${anchor.cell.col}`, anchor);
      }
      anchors = [...unique.values()];
      const position = Number(match[3] ?? 0), reverse = match[2] === "!", relative = !reverse && /^[+-]/.test(match[3] ?? "");
      let index = position - 1;
      if (relative) {
        const own = current[axis].find(item => item.anchor === address);
        if (!own) return [];
        const ownIndex=current[axis].findIndex(item=>item.anchor===address),preceding=current[axis].slice(0,ownIndex);
        let local=named.get(current.sheet)?.get(address)??[];
        for(const binding of [...preceding].reverse()){
          const selected=local.filter(anchor=>shares(anchor[axis],binding));
          if(selected.length){local=selected;break;}
        }
        const identities=[...new Set(local.map(anchor=>anchor[axis].find(item=>item.anchor===address)?.uid).filter((uid):uid is string=>uid!==undefined))];
        const ordinal=identities.indexOf(own.uid);
        if(ordinal<0)return[];
        index = ordinal + position;
      } else if (reverse && position < 0) index = anchors.length + position;
      if (index < 0 || index >= anchors.length) return [];
      parent = anchors[index];
    }
    if (!parent) return [];
    return candidates.length ? descendants[axis].get(parent)?.get(candidates[0].source.address) ?? [] : [];
  }
  function select(ref: FormulaReference, current: FormulaInstance, mode: "excel" | "report", global = false): FormulaInstance[] {
    const sheet = sheetFor(ref.sheet, current), start = parseAddress(ref.start), end = parseAddress(ref.end ?? ref.start);
    if (end.row < start.row || end.col < start.col) throw new Error(`Reversed formula range ${ref.start}:${ref.end}`);
    if ((end.row - start.row + 1) * (end.col - start.col + 1) > 100000) throw new Error("Formula reference exceeds 100000 cells");
    const selected: FormulaInstance[] = [];
    for (let row = start.row; row <= end.row; row++) for (let col = start.col; col <= end.col; col++) {
      const address = cellAddress({ row, col });
      if (mode === "excel") {
        if (ref.layers !== undefined) throw new Error("Excel references cannot contain report layers");
        const instance = physical.get(sheet)?.get(address);
        if (instance) selected.push(instance);
        continue;
      }
      const candidates = named.get(sheet)?.get(address) ?? [];
      let result: FormulaInstance[];
      if (ref.layers !== undefined) {
        const [rows = "", cols = ""] = ref.layers.split(";");
        const r = rows.trim() ? layered(current, candidates, rows, "rows", sheet) : undefined;
        const c = cols.trim() ? layered(current, candidates, cols, "cols", sheet) : undefined;
        result = r && c ? intersect(r, c) : r ?? c ?? [];
      } else if (global || sheet !== current.sheet) result = [...candidates];
      else {
        const r = contextual(address, current, "rows"), c = contextual(address, current, "cols");
        result = r && c ? intersect(r, c) : r ?? c ?? [...candidates];
      }
      selected.push(...result);
    }
    return selected;
  }
  const views=new Map<FormulaInstance,FormulaCellView>();
  function view(instance: FormulaInstance): FormulaCellView {
    const cached=views.get(instance);if(cached)return cached;
    const parent=(axis:"rows"|"cols")=>{const target=parents[axis].get(instance);return target?view(target):undefined;};
    const root=(axis:"rows"|"cols")=>{let target=instance;while(parents[axis].has(target))target=parents[axis].get(target)!;return view(target);};
    const index=[...instance.rows,...instance.cols].find(item=>item.anchor===instance.source.address)?.index??instance.rows[instance.rows.length-1]?.index??instance.cols[instance.cols.length-1]?.index??0;
    const result:FormulaCellView=Object.freeze({
      id:label(instance),sheetName:instance.sheet.name,origin:instance.source.address,name:instance.source.address,records:instance.scope.records,
      get row(){return instance.cell.row;},get col(){return instance.cell.col;},get rowIndex(){return instance.cell.row;},get colIndex(){return instance.cell.col;},
      ev:[...instance.rows,...instance.cols].find(item=>item.anchor===instance.source.address)?.value,expandIndex:index,ei:index,
      get rp(){return parent("rows");},get cp(){return parent("cols");},get rr(){return root("rows");},get cr(){return root("cols");},
      get value(){
        const value=evaluate(instance);
        if(instance.cell.formulaStatus==="uncomputed")throw new UnsupportedFormula(`Uncomputed dependency ${label(instance)}: ${instance.cell.formulaDiagnostic}`);
        return value;
      }
    });
    views.set(instance,result);return result;
  }
  function environment(instance:FormulaInstance,mode:"excel"|"report",scope:ReportScope,onReference?:(cells:readonly FormulaInstance[])=>void):FormulaEnvironment {
    let dynamicDepth=0;
    const env:FormulaEnvironment={
      runtime,scope,mode,
      reference:(ref,global)=>{
        const selected=select(ref,instance,mode,global);onReference?.(selected);
        return new FormulaCellSet(selected.map(view));
      },
      relatives:(value,parent)=>{
        const target=byId.get(value.id)!;
        let siblings=named.get(target.sheet)?.get(target.source.address)??[];
        if(parent){
          const owner=byId.get(parent.id)!;
          siblings=descendants.rows.get(owner)?.get(target.source.address)??descendants.cols.get(owner)?.get(target.source.address)??[];
        }
        return new FormulaCellSet(siblings.map(view));
      },
      children:(selected,address,axis)=>{
        const found:FormulaInstance[]=[];
        for(const value of selected.cells){const owner=byId.get(value.id);if(owner)found.push(...(descendants[axis].get(owner)?.get(address.toUpperCase())??[]).filter(child=>child!==owner));}
        onReference?.(found);return new FormulaCellSet(found.map(view));
      },
      dynamic:(source,kind,scope)=>{
        if(++dynamicDepth>64)throw new Error("Dynamic report formula exceeds 64 levels");
        try{
          if(source.length>65536)throw new Error("Dynamic report formula exceeds 64 KiB");
          let ast=astCache.get(source);if(!ast){ast=parseFormula(source);astCache.set(source,ast);}
          const context={...env,scope,mode:"report"as const};
          if(kind==="expand")return exportReportFormula(ast,context,instance.sheet.name);
          const value=evaluateFormulaNode(ast,context,formulaFunctions);
          if(kind==="cells"){if(!(value instanceof FormulaCellSet))throw new Error("CELLS requires a cell-set expression");return value;}
          return scalar(value);
        }finally{dynamicDepth--;}
      },
    };
    return env;
  }
  const cellMerges = new Map(report.sheets.map(sheet=>[sheet,new Map(sheet.merges.map(range=>[cellAddress(range.start),range]))]));
  function barcodeSize(instance:FormulaInstance):{width:number;height:number}{
    const {cell,sheet}=instance,merge=cellMerges.get(sheet)?.get(cellAddress(cell));
    let width=0,height=0;
    for(let col=cell.col;col<=(merge?.end.col??cell.col);col++)width+=(sheet.colWidths?.[col]??8.43)*7+5;
    for(let row=cell.row;row<=(merge?.end.row??cell.row);row++)height+=(sheet.rowHeights?.[row]??15)*4/3;
    return{width:Math.max(1,Math.round(width)),height:Math.max(1,Math.round(height))};
  }
  function evaluate(instance: FormulaInstance): unknown {
    if (state.get(instance) === "done") return instance.cell.value;
    if(state.get(instance)==="processing"&&stack[stack.length-1]===instance)return instance.cell.value;
    if (state.get(instance) === "visiting"||state.get(instance)==="processing") throw new Error(`Cyclic formula dependency: ${[...stack.slice(stack.indexOf(instance)), instance].map(label).join(" -> ")}`);
    if (stack.length >= 256) throw new Error("Formula dependency exceeds 256 levels");
    state.set(instance, "visiting"); stack.push(instance);
    const { source, cell } = instance;
    const inherited=source.styleId===undefined?instance.sheet.rowStyles?.[cell.row]??instance.sheet.colStyles?.[cell.col]:processing.styles?.[String(source.styleId)];
    cell.styleId=source.styleId??inherited?.styleId;cell.css=source.css??inherited?.css??(source.styleId===undefined?undefined:{});cell.numberFormat=source.numberFormat??inherited?.numberFormat;
    for(const key of ["displayValue","exportValue","rowVisible","colVisible","removeRow","removeCol","linkUrl","formulaStatus","formulaDiagnostic","image"] as const)delete cell[key];
    cell.linkUrl=source.linkUrl;
    const expression = source.config.formulaExpr ?? source.expression;
    const dependencies=new Set<FormulaInstance>();
    const reportMode = source.formulaMode === "report" || source.config.formulaExpr !== undefined || source.config.exportFormula===true
      || (!source.formula && expression !== undefined && isReportFormula(expression));
    let formula: string | undefined;
    if (source.formula) formula = reportMode ? source.formula : cell.formula;
    else if (reportMode) formula = expression;
    try {
      if (formula !== undefined) {
        if (!reportMode && formula.split(/("(?:[^"]|"")*")/g).some((part,index)=>index%2===0&&part.includes("#REF!"))) throw new UnsupportedFormula("Formula references a removed cell (#REF!)");
        if (!reportMode && formula.split(/("(?:[^"]|"")*")/g).some((part,index)=>index%2===0&&/[\[\]#]/.test(part))) throw new UnsupportedFormula("External, structured or spill formula requires Excel recalculation");
        const mode = reportMode ? "report" : "excel";
        const env=environment(instance,mode,instance.scope,cells=>cells.forEach(cell=>dependencies.add(cell)));
        let ast = astCache.get(formula);
        if (!ast) { ast = parseFormula(formula); astCache.set(formula, ast); }
        cell.value = scalar(evaluateFormulaNode(ast, env, formulaFunctions));
        cell.formulaStatus = "calculated";
        if ((source.formula&&reportMode)||source.config.exportFormula===true){
          const reason=formulaMaterializationReason(ast,env,cell.value);
          if(reason){cell.formula=undefined;cell.formulaDiagnostic=reason;}
          else cell.formula=exportReportFormula(ast,env,instance.sheet.name);
        }
      } else cell.value = instance.base();
      state.set(instance,"processing");
      applyCellProcessing({source,cell,...processing,formatValue:runtime.formatValue,renderBarcode:runtime.renderBarcode,barcodeSize:barcodeSize(instance),dictionaries:(instance.scope.params as {dicts?:Readonly<Record<string,Readonly<Record<string,unknown>>>>})?.dicts,evaluate(expression){
        const scope:ReportScope={...instance.scope,value:cell.value,cell:{...instance.scope.cell as Record<string,unknown>,value:cell.value,formattedValue:cell.displayValue}};
        if(!isReportFormula(expression))return runtime.evaluate(expression,scope);
        let ast=astCache.get(expression);
        if(!ast){ast=parseFormula(expression);astCache.set(expression,ast);}
        return scalar(evaluateFormulaNode(ast,environment(instance,"report",scope),formulaFunctions));
      }});
      if(cell.formula&&[...dependencies].some(dependency=>Object.prototype.hasOwnProperty.call(dependency.cell,"exportValue")&&dependency.cell.exportValue!==dependency.cell.value)){
        cell.formula=undefined;
        cell.formulaDiagnostic="Materialized result: a dependency exports a formatted or overridden value";
      }
      if(source.config.exportFormula===false)cell.formula=undefined;
      state.set(instance, "done"); return cell.value;
    } catch (err) {
      if (source.formula && !reportMode && err instanceof UnsupportedFormula) {
        cell.value = undefined; cell.formulaStatus = "uncomputed"; cell.formulaDiagnostic = err.message;
        state.set(instance, "done"); return undefined;
      }
      state.delete(instance);
      throw new Error(`${label(instance)}: ${err instanceof Error ? err.message : String(err)}`);
    } finally { stack.pop(); }
  }
  for (const instance of instances) evaluate(instance);
}
