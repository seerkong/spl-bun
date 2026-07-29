import { evaluateFormulaNode, FormulaCellSet, formulaTruthy, scalar, type FormulaEnvironment, type FormulaNode } from "./formula-expression";
import { formulaFunctions } from "./formula-functions";
const macros=new Set(["IF","IFERROR","NVL","AND","OR","SWITCH"]);
const numeric=new Set(["SUM","PRODUCT","SUMPRODUCT","COUNT","AVERAGE","MIN","MAX","MEDIAN","STDEV","VAR"]);
/** Excel cannot express every report/SPL type or lazy macro with the same native
 * function. Keep a current value rather than emit a formula with other semantics.
 * This inspection never evaluates a branch the report evaluator did not take.
 */
export function formulaMaterializationReason(ast:FormulaNode,env:FormulaEnvironment,result:unknown):string|undefined{
  if(result==null)return "Report null is materialized as an empty cell";
  if(result instanceof Date||typeof result==="number"&&!Number.isFinite(result))return "Report temporal/error value is materialized";
  function opaque(node:FormulaNode):boolean{
    if(node.type==="array"||node.type==="object")return true;
    if(node.type==="call")return !formulaFunctions[node.name.toUpperCase()]&&!macros.has(node.name.toUpperCase())||node.args.some(opaque);
    if(node.type==="member")return["map","flatMap"].includes(node.property)||opaque(node.object)||(node.args??[]).some(opaque);
    if(node.type==="unary")return opaque(node.arg);
    if(node.type==="binary")return opaque(node.left)||opaque(node.right);
    return false;
  }
  if(opaque(ast))return "SPL/dynamic/member transformation is materialized";
  const evaluate=(node:FormulaNode)=>evaluateFormulaNode(node,env,formulaFunctions);
  function visit(node:FormulaNode):string|undefined{
    if(node.type==="array"||node.type==="object")return "Report container expressions are materialized";
    if(node.type==="literal"||node.type==="variable")return undefined;
    if(node.type==="reference")return env.reference(node.ref).cells.some(cell=>cell.value instanceof Date)?"Temporal cell representation is materialized":undefined;
    if(node.type==="member")return visit(node.object);
    if(node.type==="unary")return visit(node.arg)??(!["number","boolean"].includes(typeof scalar(evaluate(node.arg)))?"Report unary coercion is materialized":undefined);
    if(node.type==="binary"){
      if(node.op==="&&"||node.op==="||")return "Lazy report logic is materialized";
      const nested=visit(node.left)??visit(node.right);if(nested)return nested;
      const left=scalar(evaluate(node.left)),right=scalar(evaluate(node.right));
      if(node.op==="&")return typeof left==="boolean"||typeof right==="boolean"?"Report boolean text is materialized":undefined;
      if(typeof left!==typeof right||typeof left!=="number"&&typeof left!=="boolean")return "Report text/null coercion is materialized";
      return undefined;
    }
    const name=node.name.toUpperCase();
    if(["COUNTIF","SUMIF","CONCAT","IFERROR","AND","OR","SWITCH"].includes(name))return "Report predicate/text/lazy semantics are materialized";
    if(name==="IF"){
      if(node.args.length===2&&node.args[0].type==="literal"&&typeof node.args[0].value==="string"&&node.args[1].type==="reference")return visit(node.args[1]);
      const condition=scalar(evaluate(node.args[0]));
      if(typeof condition!=="boolean"&&typeof condition!=="number")return "Report condition coercion is materialized";
      const selected=formulaTruthy(condition)?node.args[1]:node.args[2];
      return visit(node.args[0])??(selected?visit(selected):undefined);
    }
    if(name==="NVL"){
      const input=evaluate(node.args[0]);
      if(input==null||input instanceof FormulaCellSet&&!input.cells.length)return "Report empty selection is materialized";
      const selected=scalar(input)==null?node.args[1]:node.args[0];return visit(selected);
    }
    if(name==="RANK"&&typeof scalar(evaluate(node.args[0]))!=="number")return "Report nonnumeric rank is materialized";
    if(name==="PROPORTION"&&scalar(evaluate(node.args[0]))instanceof Date)return "Report temporal proportion is materialized";
    for(const arg of node.args){
      const nested=visit(arg);if(nested)return nested;
      if(numeric.has(name)){
        const value=evaluate(arg);
        if(value instanceof FormulaCellSet){if(!value.cells.length&&name==="PRODUCT")return "Report empty product is materialized";}
        else if(typeof value!=="number")return "Number-only report arguments are materialized";
      }
      if(name==="COUNTA"){const value=evaluate(arg);if(value instanceof FormulaCellSet&&!value.cells.length)return "Report empty COUNTA is materialized";}
    }
    return undefined;
  }
  return visit(ast);
}
