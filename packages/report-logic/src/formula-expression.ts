import type { ReportExpressionRuntime, ReportScope } from "depa-data-report-contract";
import { mergeCellPositions } from "./coordinates";

export interface FormulaReference { sheet?: string; start: string; end?: string; layers?: string }
export interface FormulaCellView { readonly id: string; readonly sheetName: string; readonly origin: string; readonly row: number; readonly col: number; readonly value: unknown; readonly expandIndex: number; readonly ev?: unknown; readonly rp?: FormulaCellView; readonly cp?: FormulaCellView; readonly rr?: FormulaCellView; readonly cr?: FormulaCellView; readonly name?:string; readonly rowIndex?:number; readonly colIndex?:number; readonly ei?:number; readonly records?:readonly unknown[] }
export class FormulaCellSet {
  constructor(readonly cells: readonly FormulaCellView[]) {}
  get value(): unknown {
    if (this.cells.length > 1) throw new Error(`Formula requires one cell, received ${this.cells.length}`);
    return this.cells[0]?.value ?? null;
  }
}
export class UnsupportedFormula extends Error {}
export interface FormulaEnvironment {
  runtime: ReportExpressionRuntime;
  scope: ReportScope;
  reference(ref: FormulaReference, global?: boolean): FormulaCellSet;
  relatives(cell: FormulaCellView, parent?: FormulaCellView): FormulaCellSet;
  children(parents:FormulaCellSet,address:string,axis:"rows"|"cols"):FormulaCellSet;
  dynamic(source:string,kind:"cells"|"evaluate"|"expand",scope:ReportScope):unknown;
  mode?:"excel"|"report";
}
export type FormulaNode =
  | { type: "literal"; value: unknown }
  | { type: "array"; items:FormulaNode[] }
  | { type: "object"; entries:{key:string;value:FormulaNode}[] }
  | { type: "variable"; name: string }
  | { type: "reference"; ref: FormulaReference }
  | { type: "member"; object:FormulaNode; property:string; args?:FormulaNode[] }
  | { type: "unary"; op: string; arg: FormulaNode }
  | { type: "binary"; op: string; left: FormulaNode; right: FormulaNode }
  | { type: "call"; name: string; args: FormulaNode[] };
interface Token { text: string; node?: FormulaNode }

const priorities: Record<string, number> = { "||": 1, "&&": 2, "=": 3, "==": 3, "!=": 3, "<>": 3, "<": 3, ">": 3, "<=": 3, ">=": 3, "&": 4, "+": 5, "-": 5, "*": 6, "/": 6, "^": 7 };
function tokens(source: string): Token[] {
  const result: Token[] = [];
  let rest = source.replace(/^=/, "");
  while (rest.length) {
    const space = /^\s+/.exec(rest);
    if (space) { rest = rest.slice(space[0].length); continue; }
    if(result.length>=4096)throw new Error("Formula exceeds 4096 tokens");
    const ref = /^(?:(?:'((?:[^']|'')+)'|([\p{L}_][\p{L}\p{N}_ ]*))!)?(\$?[A-Z]{1,3}\$?[1-9]\d*)(?::(\$?[A-Z]{1,3}\$?[1-9]\d*))?(?:\[([^\]]*)\])?(?![\p{L}\p{N}_])/iu.exec(rest);
    if (ref && !rest.slice(ref[0].length).startsWith("(")) {
      result.push({ text: ref[0], node: { type: "reference", ref: { sheet: ref[1]?.replace(/''/g, "'") ?? ref[2], start: ref[3].replace(/\$/g, "").toUpperCase(), end: ref[4]?.replace(/\$/g, "").toUpperCase(), layers: ref[5] } } });
      rest = rest.slice(ref[0].length); continue;
    }
    const str = /^"((?:[^"]|"")*)"/.exec(rest);
    if (str) { result.push({ text: str[0], node: { type: "literal", value: str[1].replace(/""/g, '"') } }); rest = rest.slice(str[0].length); continue; }
    const single = /^'((?:[^']|'')*)'/.exec(rest);
    if (single) { result.push({ text: single[0], node: { type: "literal", value: single[1].replace(/''/g, "'") } }); rest = rest.slice(single[0].length); continue; }
    const num = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i.exec(rest);
    if (num) { result.push({ text: num[0], node: { type: "literal", value: Number(num[0]) } }); rest = rest.slice(num[0].length); continue; }
    const name = /^[\p{L}_][\p{L}\p{N}_.]*/u.exec(rest);
    if (name) {
      result.push({ text: name[0], node: { type: "variable", name: name[0] } });
      rest = rest.slice(name[0].length); continue;
    }
    const op = /^(?:<=|>=|<>|!=|==|&&|\|\||[().+\-*/^%&,=!<>\[\]{}:])/.exec(rest);
    if (!op) throw new UnsupportedFormula(`Unsupported formula syntax near ${rest.slice(0, 32)}`);
    result.push({ text: op[0] }); rest = rest.slice(op[0].length);
    if (result.length > 4096) throw new Error("Formula exceeds 4096 tokens");
  }
  return result;
}
export function parseFormula(source: string): FormulaNode {
  const input = tokens(source); let index = 0; let depth = 0;
  function expression(min = 0): FormulaNode {
    if (++depth > 128) throw new Error("Formula nesting exceeds 128 levels");
    const token = input[index++];
    if (!token) throw new Error("Incomplete formula");
    let node: FormulaNode;
    if (["+", "-", "!"].includes(token.text) || token.text.toUpperCase() === "NOT" && input[index]?.text !== "(") node = { type: "unary", op: token.text.toUpperCase() === "NOT" ? "!" : token.text, arg: expression(7) };
    else if (token.text === "(") { node = expression(); if (input[index++]?.text !== ")") throw new Error("Expected closing parenthesis"); }
    else if(token.text==="["){
      const items:FormulaNode[]=[];
      if(input[index]?.text!=="]")do{items.push(expression());if(input[index]?.text!==",")break;index++;}while(true);
      if(input[index++]?.text!=="]")throw new Error("Expected closing report array bracket");
      node={type:"array",items};
    }else if(token.text==="{"){
      const entries:{key:string;value:FormulaNode}[]=[];
      if(input[index]?.text!=="}")do{
        const key=input[index++]?.node;
        if(!key||!(key.type==="variable"||key.type==="literal"&&typeof key.value==="string"))throw new Error("Expected report object key");
        if(input[index++]?.text!==":")throw new Error("Expected report object colon");
        entries.push({key:key.type==="variable"?key.name:String(key.value),value:expression()});
        if(input[index]?.text!==",")break;index++;
      }while(true);
      if(input[index++]?.text!=="}")throw new Error("Expected closing report object brace");
      node={type:"object",entries};
    }
    else if (token.node?.type === "variable" && input[index]?.text === "(") {
      index++; const args: FormulaNode[] = [];
      if (input[index]?.text !== ")") do { args.push(expression()); if (input[index]?.text !== ",") break; index++; } while (true);
      if (input[index++]?.text !== ")") throw new Error(`Expected closing parenthesis for ${token.text}`);
      node = { type: "call", name: token.text, args };
    } else if (token.node) node=token.node;
    else throw new Error(`Unexpected formula token ${token.text}`);
    while(input[index]?.text==="."){
      index++;
      const member=input[index++];
      if(member?.node?.type!=="variable")throw new Error("Expected formula member name");
      const names=member.node.name.split(".");
      for(const name of names){if(!name)throw new Error("Invalid formula member");node={type:"member",object:node,property:name};}
      if(input[index]?.text==="("){
        index++;const args:FormulaNode[]=[];
        if(input[index]?.text!==")")do{args.push(expression());if(input[index]?.text!==",")break;index++;}while(true);
        if(input[index++]?.text!==")")throw new Error("Expected closing cellSet member parenthesis");
        (node as Extract<FormulaNode,{type:"member"}>).args=args;
      }
    }
    while (index < input.length) {
      const raw = input[index].text.toUpperCase();
      const op = raw === "AND" ? "&&" : raw === "OR" ? "||" : input[index].text;
      if (op === "%") { index++; node = { type: "binary", op: "/", left: node, right: { type: "literal", value: 100 } }; continue; }
      const priority = priorities[op];
      if (priority === undefined || priority < min) break;
      index++; node = { type: "binary", op, left: node, right: expression(priority + (op === "^" ? 0 : 1)) };
    }
    depth--; return node;
  }
  const ast = expression();
  if (index !== input.length) throw new Error(`Unexpected formula token ${input[index].text}`);
  return ast;
}
export const scalar = (value: unknown): unknown => value instanceof FormulaCellSet ? value.value : value;
export function values(value: unknown): unknown[] {
  if (value instanceof FormulaCellSet) return value.cells.map(cell => cell.value);
  return Array.isArray(value) ? [...value] : value == null ? [] : [value];
}
export const formulaTruthy = (value: unknown): boolean => Boolean(scalar(value));
export function formulaBinary(op: string, a: unknown, b: unknown): unknown {
  const left = scalar(a), right = scalar(b);
  switch (op) {
    case "=": case "==": return left === right || left == null && right == null;
    case "<>": case "!=": return !(left === right || left == null && right == null);
    case "<": return (left as number) < (right as number);
    case ">": return (left as number) > (right as number);
    case "<=": return (left as number) <= (right as number);
    case ">=": return (left as number) >= (right as number);
    case "&": return String(left ?? "") + String(right ?? "");
    case "+": return typeof left === "string" || typeof right === "string" ? String(left ?? "") + String(right ?? "") : Number(left ?? 0) + Number(right ?? 0);
    case "-": return Number(left ?? 0) - Number(right ?? 0);
    case "*": return Number(left ?? 0) * Number(right ?? 0);
    case "/": return Number(left ?? 0) / Number(right ?? 0);
    case "^": return Number(left ?? 0) ** Number(right ?? 0);
    default: throw new UnsupportedFormula(`Unsupported formula operator ${op}`);
  }
}

function evaluateMember(value:unknown,property:string,args:unknown[]|undefined,env:FormulaEnvironment,functions:Readonly<Record<string,(args:unknown[],env:FormulaEnvironment)=>unknown>>):unknown{
  if(["constructor","prototype","__proto__"].includes(property))throw new Error(`Forbidden formula member ${property}`);
  if(env.mode==="excel")throw new UnsupportedFormula(`Cell-set member ${property} requires report expression mode`);
  const arity=(min:number,max=min)=>{if(args!==undefined&&(args.length<min||args.length>max))throw new Error(`${property} expects ${min===max?min:`${min}..${max}`} arguments`);};
  if(value instanceof FormulaCellSet){
    const cells=value.cells;
    const at=(input:unknown):FormulaCellView|null=>{const n=Number(scalar(input));if(!Number.isInteger(n))throw new Error(`${property} requires an integer index`);return cells[n<0?cells.length+n:n]??null;};
    if(property==="value"){arity(0,1);return args?.length?at(args[0])?.value??null:value.value;}
    if(property==="get"){if(args?.length!==1)throw new Error("get expects one index");return at(args[0]);}
    if(property==="cell"){arity(0);if(cells.length!==1)throw new Error(`cell requires one cell, received ${cells.length}`);return cells[0];}
    if(["map","filter","flatMap"].includes(property)){
      if(args?.length!==1||typeof args[0]!=="string")throw new Error(`${property} requires one evaluator expression string`);
      const source=args[0];
      const apply=(e:FormulaCellView)=>{
        const scope={...env.scope,e};
        return isReportFormula(source)?evaluateFormulaNode(parseFormula(source),{...env,scope},functions):env.runtime.evaluate(source,scope);
      };
      if(property==="filter")return new FormulaCellSet(cells.filter(cell=>formulaTruthy(apply(cell))));
      const mapped=cells.map(apply);
      return property==="map"?mapped:mapped.flatMap(item=>item instanceof FormulaCellSet?values(item):item==null?[]:Array.isArray(item)?item:[item]);
    }
    if(property==="rowChildSet"||property==="colChildSet"){
      if(args?.length!==1||typeof args[0]!=="string")throw new Error(`${property} requires one source cell name`);
      return env.children(value,args[0],property==="rowChildSet"?"rows":"cols");
    }
    arity(0);
    switch(property){
      case "values":return values(value);
      case "cells":return Object.freeze([...cells]);
      case "size":return cells.length;
      case "firstCell":return cells[0]??null;
      case "lastCell":return cells[cells.length-1]??null;
      case "firstValue":return cells[0]?.value??null;
      case "lastValue":return cells[cells.length-1]?.value??null;
      case "isEmpty":return !cells.length;
      case "rowCount":return cells.length?cells[cells.length-1].row-cells[0].row+1:0;
      case "colCount":return cells.length?cells[cells.length-1].col-cells[0].col+1:0;
      case "cellRanges":return mergeCellPositions(cells);
      case "sum":return cells.reduce((total,cell)=>typeof cell.value==="number"?total+cell.value:typeof cell.value==="boolean"?total+Number(cell.value):NaN,0);
      case "realCells":return new FormulaCellSet([...cells]);
      case "expandIndex":if(cells.length!==1)throw new Error("expandIndex requires one cell instance");return cells[0].expandIndex;
      default:throw new Error(`Unsupported cellSet member ${property}`);
    }
  }
  if(args!==undefined)throw new Error(`Formula member ${property} is not callable`);
  if(value==null)return null;
  if(Array.isArray(value)&&property==="length")return value.length;
  if(typeof value==="object"&&Object.prototype.hasOwnProperty.call(value,property))return(value as Record<string,unknown>)[property];
  throw new Error(`Unknown formula member ${property}`);
}

export function evaluateFormulaNode(node: FormulaNode, env: FormulaEnvironment, functions: Readonly<Record<string, (args: unknown[], env: FormulaEnvironment) => unknown>>): unknown {
  const visit = (next: FormulaNode): unknown => evaluateFormulaNode(next, env, functions);
  if (node.type === "literal") return node.value;
  if(node.type==="array"||node.type==="object"){
    if(env.mode==="excel")throw new UnsupportedFormula("Report container literals require report expression mode");
    if(node.type==="array")return node.items.map(visit);
    return Object.fromEntries(node.entries.map(entry=>[entry.key,visit(entry.value)]));
  }
  if (node.type === "variable") {
    if (/^(true|false)$/i.test(node.name)) return node.name.toLowerCase() === "true";
    if (/^null$/i.test(node.name)) return null;
    return env.runtime.evaluate(node.name, env.scope);
  }
  if (node.type === "reference") return env.reference(node.ref);
  if (node.type === "member") return evaluateMember(visit(node.object),node.property,node.args?.map(visit),env,functions);
  if (node.type === "unary") {
    const value = scalar(visit(node.arg));
    return node.op === "!" ? !formulaTruthy(value) : node.op === "-" ? -Number(value) : Number(value);
  }
  if (node.type === "binary") {
    const left = visit(node.left);
    if (node.op === "&&") return formulaTruthy(left) && formulaTruthy(visit(node.right));
    if (node.op === "||") return formulaTruthy(left) || formulaTruthy(visit(node.right));
    return formulaBinary(node.op, left, visit(node.right));
  }
  const name = node.name.toUpperCase();
  if(["CELLS","EVAL_EXCEL_FORMULA","EXPAND_EXCEL_FORMULA"].includes(name)){
    if(env.mode==="excel")throw new UnsupportedFormula(`${name} requires report expression mode`);
    if(node.args.length!==1)throw new Error(`${name} expects one expression string`);
    const source=scalar(visit(node.args[0]));
    if(source==null||String(source).trim()==="")return null;
    if(typeof source!=="string")throw new Error(`${name} requires an expression string`);
    return env.dynamic(source,name==="CELLS"?"cells":name==="EVAL_EXCEL_FORMULA"?"evaluate":"expand",env.scope);
  }
  if (name === "IF" && node.args.length === 2 && node.args[0].type === "literal" && typeof node.args[0].value === "string" && node.args[1].type === "reference") {
    const predicate = node.args[0].value;
    const cells = env.reference(node.args[1].ref, true).cells.filter(e => formulaTruthy(env.runtime.evaluate(predicate, { ...env.scope, e })));
    return new FormulaCellSet(cells);
  }
  if (name === "IF") {
    if (node.args.length < 2 || node.args.length > 3) throw new Error("IF expects condition, trueValue, optional falseValue");
    const branch = formulaTruthy(visit(node.args[0])) ? node.args[1] : node.args[2];
    return branch ? scalar(visit(branch)) : null;
  }
  if (name === "IFERROR") {
    try { const value = visit(node.args[0]); if (typeof value === "number" && !Number.isFinite(value)) return visit(node.args[1]); return value; }
    catch (err) { if (err instanceof UnsupportedFormula) throw err; return visit(node.args[1]); }
  }
  if (name === "NVL") { const value = scalar(visit(node.args[0])); return value == null ? scalar(visit(node.args[1])) : value; }
  if (name === "AND" || name === "OR") {
    if (!node.args.length) return false;
    if (node.args.length === 1) return visit(node.args[0]);
    return name === "AND" ? node.args.every(arg => formulaTruthy(visit(arg))) : node.args.some(arg => formulaTruthy(visit(arg)));
  }
  if (name === "SWITCH") {
    if (node.args.length < 3) throw new Error("SWITCH expects a value and case/result pairs");
    const value = scalar(visit(node.args[0]));
    for (let i = 1; i + 1 < node.args.length; i += 2) if (value === scalar(visit(node.args[i]))) return scalar(visit(node.args[i + 1]));
    return node.args.length % 2 === 0 ? scalar(visit(node.args[node.args.length - 1])) : null;
  }
  const fn = functions[name];
  if (!fn) {
    if(env.mode!=="report")throw new UnsupportedFormula(`Unsupported formula function ${node.name}`);
    const args=node.args.map(visit),scope={...env.scope};
    args.forEach((value,index)=>scope[`__reportArg${index}`]=value instanceof FormulaCellSet?values(value):value);
    return env.runtime.evaluate(`${node.name}(${args.map((_value,index)=>`__reportArg${index}`).join(",")})`,scope);
  }
  return fn(node.args.map(visit), env);
}

export function isReportFormula(source: string): boolean {
  return /(?<![\p{L}\p{N}_.])\$?[A-Z]{1,3}\$?[1-9]\d*(?![\p{L}\p{N}_(])/u.test(source.replace(/"(?:[^"]|"")*"/g, ""))
    || /\b(?:SUM|PRODUCT|SUMPRODUCT|COUNT|COUNTA|AVERAGE|MIN|MAX|NVL|PROPORTION|RANK|ACCSUM|STDEV|VAR|COUNTIF|SUMIF|CONCAT|IF|MEDIAN|AND|OR|NOT|SWITCH|CELLS|EVAL_EXCEL_FORMULA|EXPAND_EXCEL_FORMULA)\s*\(/.test(source);
}
