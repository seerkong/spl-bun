import { expect, test } from 'bun:test';
import { evaluateExpression as e, decimal, builtins, sortRows } from '../src';

const table = () => ({schema:['id','a','b'].map(name=>({name,type:'number'})),rows:[
 {id:0,a:1,b:2},{id:1,a:2,b:1},{id:2,a:1,b:1},{id:3,a:1,b:2},
]});
const ids = (value: any) => value.rows.map((row: any)=>row.id);
test('sort binds row expressions, outer scope and multi-key directions without changing input',()=>{
 const t=table(), before=structuredClone(t), scope={t,rate:-1,direction:-1};
 expect(ids(e('t.sort(a*rate,b)',scope))).toEqual([1,2,0,3]);
 expect(ids(e("t.sort('a*rate',b:direction)",scope))).toEqual([1,0,3,2]);
 expect(ids(e('t.sort@z(a:1,b:-1)',scope))).toEqual([0,3,2,1]);
 expect(ids(e("t.sort('a','desc')",scope))).toEqual([1,0,2,3]);
 expect(t).toEqual(before);expect(scope.rate).toBe(-1);
});
test('sort@u hierarchically groups key prefixes in encounter order and retains duplicate records',()=>{
 const t=table();
 expect(ids(e('t.sort@u(a,b)',{t}))).toEqual([0,3,2,1]);
 expect(ids(e('t.sort@uz0(a,b)',{t}))).toEqual([0,3,2,1]);
 expect(e('[2,1,2].sort@u()',{})).toEqual([2,2,1]);
 expect(e('[2,1,2].sort@z()',{})).toEqual([2,2,1]);
 expect(e('[2,1,2].sort()',{})).toEqual([1,2,2]);
});
test('sort keys project once, numeric keys stay exact and nulls follow source direction/0 rules',()=>{
 let calls=0;const t=table();
 expect(ids(e('t.sort(key(a),b)',{t},{...builtins,key:(x:unknown)=>{calls++;return x;}}))).toEqual([2,0,3,1]);
 expect(calls).toBe(4);
 const rows=[{id:0,k:9007199254740993n},{id:1,k:null},{id:2,k:decimal('9007199254740992.1')},{id:3}];
 const input={schema:['id','k'].map(name=>({name})),rows};
 expect(ids(e('input.sort(k)',{input,k:999}))).toEqual([1,3,2,0]);
 expect(ids(e('input.sort@z(k)',{input}))).toEqual([0,2,1,3]);
 expect(ids(e('input.sort@0(k)',{input}))).toEqual([2,0,1,3]);
 expect(ids(e('input.sort@z0(k)',{input}))).toEqual([0,2,1,3]);
 expect(sortRows([new Date(2),new Date(1)], [{value:v=>v}]).map(Number)).toEqual([1,2]);
 expect(e("['z','ä','a'].sort(_; 'de_DE')",{})).toEqual(['a','ä','z']);
});
test('sort validates schema, protocols, key types and order overloads even on empty inputs',()=>{
 const t=table(), empty={...t,rows:[]};
 for(const source of ['t.sort(missing)','empty.sort(missing)',"t.sort('missing')",'t.sort@x(a)','t.sort@o(a)','t.sort@n(a)','t.sort@zz(a)',"t.sort(a:'desc')",'t.sort()',"t.sort(a;123)","t.sort(a;'zz_ZZ')",'t.sort(a;1,2)'])
  expect(()=>e(source,{t,empty})).toThrow();
 expect(()=>sortRows([1,'1'],[{value:v=>v}])).toThrow('incompatible');
 expect(()=>sortRows([{}],[{value:v=>v}])).toThrow('keys');
 expect(ids(e('empty.sort(a)',{empty}))).toEqual([]);
});
