import { cellAddress } from "./coordinates";
import { evaluateFormulaNode, FormulaCellSet, scalar, type FormulaCellView, type FormulaEnvironment, type FormulaNode } from "./formula-expression";
import { formulaFunctions } from "./formula-functions";

function literal(value: unknown): string {
  if (value == null) return '""';
  if (typeof value === "string") return `"${value.replace(/"/g, '""')}"`;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  throw new Error("Formula export requires a finite scalar value");
}
function addresses(cells: readonly FormulaCellView[], currentSheet: string): string {
  if (!cells.length) return '""';
  const groups = new Map<string, FormulaCellView[]>();
  for (const cell of cells) { const group = groups.get(cell.sheetName) ?? []; group.push(cell); groups.set(cell.sheetName, group); }
  const references: string[] = [];
  for (const [sheet, group] of groups) {
    const prefix = sheet === currentSheet ? "" : `'${sheet.replace(/'/g, "''")}'!`;
    const unique = [...new Map(group.map(cell => [`${cell.row},${cell.col}`, cell])).values()].sort((a,b) => a.col-b.col || a.row-b.row);
    let start = unique[0], end = start;
    const emit = () => references.push(`${prefix}${cellAddress(start)}${start === end ? "" : `:${cellAddress(end)}`}`);
    for (const cell of unique.slice(1)) {
      if (cell.col === end.col && cell.row === end.row + 1) end = cell;
      else { emit(); start = end = cell; }
    }
    emit();
  }
  return references.join(",");
}

/** Same AST and selectors as evaluation; filter sets become concrete output ranges. */
export function exportReportFormula(ast: FormulaNode, env: FormulaEnvironment, currentSheet: string): string {
  const evaluate = (node: FormulaNode) => evaluateFormulaNode(node, env, formulaFunctions);
  function print(node: FormulaNode): string {
    if (node.type === "literal") return literal(node.value);
    if(node.type==="array"||node.type==="object")throw new Error("Report container expressions require value materialization");
    if (node.type === "variable") return literal(scalar(evaluate(node)));
    if (node.type === "reference") {
      return addresses(env.reference(node.ref).cells, currentSheet);
    }
    if(node.type==="member"){
      const owner=evaluate(node.object);
      if(node.property==="value"){
        if(owner instanceof FormulaCellSet){
          if(!node.args?.length)return addresses(owner.cells,currentSheet);
          const n=Number(scalar(evaluate(node.args[0]))),cell=owner.cells[n<0?owner.cells.length+n:n];
          return cell?addresses([cell],currentSheet):literal(null);
        }
        if(owner&&typeof owner==="object"&&"id"in owner&&"origin"in owner)return addresses([owner as FormulaCellView],currentSheet);
      }
      if(node.property==="sum"&&owner instanceof FormulaCellSet){
        if(owner.cells.some(cell=>cell.value==null||!["number","boolean"].includes(typeof cell.value)))return "SQRT(-1)";
        if(owner.cells.some(cell=>typeof cell.value==="boolean"))return `SUM(${owner.cells.map(cell=>`--${addresses([cell],currentSheet)}`).join(",")})`;
        return `SUM(${addresses(owner.cells,currentSheet)})`;
      }
      const value=evaluate(node);
      if(value instanceof FormulaCellSet)return addresses(value.cells,currentSheet);
      return literal(scalar(value));
    }
    if (node.type === "unary") return node.op === "!" ? `NOT(${print(node.arg)})` : `${node.op}(${print(node.arg)})`;
    if (node.type === "binary") {
      if (node.op === "&&" || node.op === "||") return `${node.op === "&&" ? "AND" : "OR"}(${print(node.left)},${print(node.right)})`;
      let op = node.op;
      if (op === "==") op = "=";
      if (op === "!=") op = "<>";
      return `(${print(node.left)}${op}${print(node.right)})`;
    }
    const name = node.name.toUpperCase();
    if(name==="CELLS"){
      const value=evaluate(node);if(!(value instanceof FormulaCellSet))return literal(value);
      return addresses(value.cells,currentSheet);
    }
    if(name==="EVAL_EXCEL_FORMULA"||name==="EXPAND_EXCEL_FORMULA")return literal(scalar(evaluate(node)));
    if (name === "IF" && node.args.length === 2 && node.args[0].type === "literal" && typeof node.args[0].value === "string" && node.args[1].type === "reference") {
      return addresses((evaluate(node) as FormulaCellSet).cells, currentSheet);
    }
    if (["PROPORTION", "RANK", "ACCSUM"].includes(name)) {
      const selected = evaluate(node.args[0]);
      if (!(selected instanceof FormulaCellSet) || selected.cells.length !== 1) throw new Error(`${name} export requires one instance`);
      const cell = selected.cells[0];
      const parent = node.args[1] ? evaluate(node.args[1]) : undefined;
      if (parent !== undefined && (!(parent instanceof FormulaCellSet) || parent.cells.length !== 1)) throw new Error(`${name} export requires one parent instance`);
      const siblings = env.relatives(cell, parent instanceof FormulaCellSet ? parent.cells[0] : undefined).cells;
      const ref = addresses([cell], currentSheet);
      if (name === "RANK") return `RANK(${ref},(${addresses(siblings, currentSheet)}),0)`;
      if (name === "PROPORTION") return `(${ref}/SUM(${addresses(siblings, currentSheet)}))`;
      return `SUM(${addresses(siblings.slice(0, siblings.findIndex(other => other.id === cell.id) + 1), currentSheet)})`;
    }
    if (name === "NVL") return `IF(ISBLANK(${print(node.args[0])}),${print(node.args[1])},${print(node.args[0])})`;
    return `${name}(${node.args.map(print).join(",")})`;
  }
  return print(ast);
}
