import {expect,test} from 'bun:test';import {evaluateFlow} from '../src';
test('Flow parse preserves source option priority, exact values and errors through the shared builtin',async()=>{
 const result=await evaluateFlow([
  {row:1,col:'A',expr:'parse(text)'},{row:2,col:'A',expr:'parse@n(prefix)'},
  {row:3,col:'A',expr:'parse@en("true")'},{row:4,col:'A',expr:'parse@x(null)'},
  {row:5,col:'A',expr:'parse("9007199254740993")'},
 ],{scope:{text:'[1,true,null]',prefix:'12.5kg'}});
 expect(result.cells.map(cell=>cell.status)).toEqual(['ok','ok','ok','error','ok']);
 expect(result.scope.A1).toEqual([1,true,null]);expect(result.scope.A2).toBe(12.5);expect(result.scope.A3).toBe(true);expect(result.scope.A5).toBe(9007199254740993n);
 expect(result.scope.text).toBe('[1,true,null]');
});
test('Flow nonfinite parse tokens keep numeric types and source option precedence',async()=>{
 for(const [text,expected] of [['+NaN',NaN],['-NaN',NaN],['NaN%',NaN],['Infinity%',Infinity],['-Infinity%',-Infinity]] as const){
  const options=['','q','e','qe','en','qen','n','qn'];
  const result=await evaluateFlow(options.map((option,index)=>({row:index+1,col:'A',expr:'parse(text,'+JSON.stringify(option)+')'})),{scope:{text}});
  expect(result.cells.every(cell=>cell.status==='ok')).toBe(true);
  for(let i=0;i<6;i++){expect(typeof result.scope['A'+(i+1)]).toBe('number');expect(result.scope['A'+(i+1)]).toBe(expected);}
  expect(result.scope.A7).toBeNull();expect(result.scope.A8).toBeNull();expect(result.scope.text).toBe(text);
 }
});
