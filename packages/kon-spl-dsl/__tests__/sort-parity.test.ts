import {expect,test} from 'bun:test';
import {runSplKon,toQueryResult} from '../src';
test('Kon expression and native sorting share exact, stable row semantics and schema diagnostics',()=>{
 const input={columns:['id','a'],rows:[{id:0,a:2},{id:1,a:1},{id:2,a:2}]};
 for(const expr of ['input.sort@z(a)','input.sort@u(a)','input.sort(a*rate)']) {
  const value=runSplKon(`(spl_eval :{expr=${JSON.stringify(expr)} with={rate=-1}})`,{tables:{input}}).value;
  expect(toQueryResult(value)!.rows.map(row=>row.id)).toEqual([0,2,1]);
 }
 expect(toQueryResult(runSplKon('(spl_sort :{in=input by=[{col=a desc=true}]})',{tables:{input}}).value)!.rows.map(row=>row.id)).toEqual([0,2,1]);
 expect(()=>runSplKon('(spl_sort :{in=input by=missing})',{tables:{input}})).toThrow('missing');
 expect(()=>runSplKon('(spl_sort :{in=input by=[{col=a desc=bad}]})',{tables:{input}})).toThrow('desc');
 expect(()=>runSplKon('(spl_sort :{in=input by=[{col=a unknown=true}]})',{tables:{input}})).toThrow('col/desc');
 expect(()=>runSplKon('(spl_eval :{expr="input.sort@x(a)"})',{tables:{input}})).toThrow();
 expect(input.rows.map(row=>row.id)).toEqual([0,1,2]);
});
