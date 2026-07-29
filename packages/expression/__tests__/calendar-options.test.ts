import {expect,test} from 'bun:test';
import {evaluateExpression as e} from '../src';
function parts(value:unknown){const d=value as Date;return [d.getFullYear(),d.getMonth()+1,d.getDate(),d.getHours()];}
test('elapse and dateadd preserve month end, e clamps original day, and both leave inputs intact',()=>{
 const a=new Date(2024,1,29,12);const scope={a};
 expect(parts(e('elapse@m(a,1)',scope))).toEqual([2024,3,31,12]);
 expect(parts(e('elapse@me(a,1)',scope))).toEqual([2024,3,29,12]);
 expect(parts(e('dateadd@y(a,1)',scope))).toEqual([2025,2,28,12]);
 expect(parts(e('elapse@q(a,1)',scope))).toEqual([2024,5,31,12]);
 expect(parts(e('elapse@m(a,-1)',scope))).toEqual([2024,1,31,12]);
 expect(e('elapse@ms(a,1234)',scope)).toEqual(new Date(a.getTime()+1234));
 expect(e('elapse@s(a,2)',scope)).toEqual(new Date(a.getTime()+2000));
 expect(parts(a)).toEqual([2024,2,29,12]);
 expect(()=>e('elapse@x(a,1)',scope)).toThrow('unsupported');
 expect(()=>e('elapse(a,[])',scope)).toThrow('finite numeric');
 expect(()=>e('elapse(a,2147483648)',scope)).toThrow('32-bit');
});
test('interval supports boundaries, compound units, reverse ranges, week markers and fractional units',()=>{
 const a=new Date(2024,0,31,12),b=new Date(2025,2,2,12),scope={a,b};
 for(const [opt,value] of [['y',1],['m',14],['q',4],['ym',101],['ymd',10102],['md',1302]] as const)expect(e(`interval@${opt}(a,b)`,scope)).toBe(value);
 expect(e('interval@1(a,b)',scope)).toBe(e('interval@1(b,a)',scope));
 expect(e('interval@ms(a,b)',scope)).toBe(b.getTime()-a.getTime());
 expect(e('datediff@ms(b,a)',scope)).toBe(b.getTime()-a.getTime());
 expect(e('interval@sr(a,b)',scope)).toBe((b.getTime()-a.getTime())/1000);
 expect(e('interval(null,b)',scope)).toBeNull();expect(()=>e('interval@z(a,b)',scope)).toThrow('unsupported');
});
test('DST calendar shift, fixed source buckets and elapsed days are separate contracts',()=>{
 const code=`import {evaluateExpression as e} from './packages/expression/src';const a=new Date(2024,2,9,12),b=e('elapse(a,1)',{a});console.log(JSON.stringify([b.getHours(),e('interval(a,b)',{a,b}),e('datediff(b,a)',{a,b}),e('interval@r(a,b)',{a,b}),e('b-a',{a,b})]));`;
 const child=Bun.spawnSync([process.execPath,'-e',code],{cwd:import.meta.dir+'/../../..',env:{...process.env,TZ:'America/New_York'}});
 expect(child.exitCode).toBe(0);expect(JSON.parse(new TextDecoder().decode(child.stdout))).toEqual([12,1,23/24,23/24,1]);
});
