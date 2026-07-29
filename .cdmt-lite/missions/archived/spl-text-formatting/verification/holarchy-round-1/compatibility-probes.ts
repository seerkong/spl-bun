import { evaluateExpression, isDecimal } from '/Users/kongweixian/infra-dev/spl-bun/packages/expression/src';
import { runSplKon, toQueryResult } from '/Users/kongweixian/infra-dev/spl-bun/packages/kon-spl-dsl/src';
import { evaluateFlow } from '/Users/kongweixian/infra-dev/spl-bun/packages/spl-flow/src';
const table = { schema: [{name:'a'}], rows: [{a:2},{a:1}] };
const duplicates = { schema: [{name:'a'}], rows: [{a:2},{a:1},{a:2}] };
const cases = [
  "table.sort('a')", "table.sort('a','desc')", "table.sort@z('a')", "duplicates.sort@u('a')", "table.sort('missing')", "table.sort('a*rate')",
  "parse('true')", "parse('null')", "parse('[1,2]')", "parse('1e3')", "parse('12.5kg','n')", "parse('bad','n')", "parse@q('\"a\" trailing')", "parse@x('42')",
  "json_parse('{\"id\":9007199254740993}')", "format('%h',1)", "string(decimal('-1e-400'),'0.000;(0.000)')",
];
function encode(value: unknown): unknown {
  if (typeof value === 'bigint' || isDecimal(value)) return {type:typeof value==='bigint'?'long':'decimal',text:String(value)};
  if (value instanceof Date) return {type:'Date',iso:value.toISOString()};
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]));
  return {type:typeof value,value};
}
for (const source of cases) {
  try { console.log(JSON.stringify({source,result:encode(evaluateExpression(source,{table,duplicates,rate:-1}))})); }
  catch(error) { console.log(JSON.stringify({source,error:String(error)})); }
}
console.log(JSON.stringify({entry:'Kon',source:'input.sort@z("a")',result:toQueryResult(runSplKon('(spl_eval :{expr="input.sort@z(\'a\')"})',{tables:{input:{columns:['a'],rows:table.rows}}}).value)}));
const flow=await evaluateFlow([{row:1,col:'A',expr:"parse('true')"}],{});
console.log(JSON.stringify({entry:'Flow',source:"parse('true')",status:flow.cells[0].status,result:encode(flow.scope.A1)}));
console.log(JSON.stringify({inputUnchanged:JSON.stringify(table.rows)==='[{"a":2},{"a":1}]'}));
