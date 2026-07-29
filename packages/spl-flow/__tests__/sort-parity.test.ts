import {expect,test} from 'bun:test';
import {evaluateFlow} from '../src';
test('Flow sorting uses the shared row AST and rejects unknown options and fields',async()=>{
 const input={schema:['id','a'].map(name=>({name})),rows:[{id:0,a:2},{id:1,a:1},{id:2,a:2}]};
 const result=await evaluateFlow([
  {row:1,col:'A',expr:'input.sort@u(a)'},{row:2,col:'A',expr:'input.sort(a:direction)'},
  {row:3,col:'A',expr:'input.sort(missing)'},{row:4,col:'A',expr:'input.sort@x(a)'},
 ],{scope:{input,direction:-1}});
 expect(result.cells.map(cell=>cell.status)).toEqual(['ok','ok','error','error']);
 for(const key of ['A1','A2']) expect((result.scope[key] as any).rows.map((row:any)=>row.id)).toEqual([0,2,1]);
 expect(input.rows.map(row=>row.id)).toEqual([0,1,2]);
});
