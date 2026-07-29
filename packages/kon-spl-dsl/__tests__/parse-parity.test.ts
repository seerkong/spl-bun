import {expect,test} from 'bun:test';import {runSplKon,toQueryResult} from '../src';
test('Kon parse shares default scalar, JSON, exact values, options and diagnostics',()=>{
 const input={columns:['value'],rows:[{value:'true'},{value:'1e3'},{value:'9007199254740993'}]};
 const value=runSplKon('(spl_derive :{in=input cols={parsed="parse(value)"}})',{tables:{input}}).value;
 expect(toQueryResult(value)!.rows.map(row=>row.parsed)).toEqual([true,1000,9007199254740993n]);
 expect(runSplKon('(spl_eval @n :{expr="parse(text)"})',{scope:{text:'12.5kg'}}).value).toBe(12.5);
 expect(runSplKon('(spl_eval :{expr="parse(text)"})',{scope:{text:'[1,true,null]'}}).value).toEqual([1,true,null]);
 expect(()=>runSplKon('(spl_eval :{expr="parse@x(null)"})')).toThrow();
 expect(input.rows.map(row=>row.value)).toEqual(['true','1e3','9007199254740993']);
});
test('Kon nonfinite parse tokens retain numeric types and n controls through the shared evaluator',()=>{
 for(const [text,expected] of [['+NaN',NaN],['-NaN',NaN],['NaN%',NaN],['Infinity%',Infinity],['-Infinity%',-Infinity]] as const){
  for(const option of ['','q','e','qe','en','qen']){
   const source=`(spl_eval :{expr=${JSON.stringify('parse(text,'+JSON.stringify(option)+')')}})`;
   const value=runSplKon(source,{scope:{text}}).value;
   expect(typeof value).toBe('number');expect(value).toBe(expected);
  }
  for(const option of ['n','qn'])expect(runSplKon(`(spl_eval :{expr="parse@${option}(text)"})`,{scope:{text}}).value).toBeNull();
 }
});
