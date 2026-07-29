import {expect,test} from 'bun:test';
import {evaluateExpression as e,builtins,decimal} from '../src';
test('Java format strings bind indexed/reused arguments, exact numeric values and date components',()=>{
 expect(e(`format('%2$s:%1$04d:%<x',15,'id')`,{})).toBe('id:0015:f');
 expect(e(`format('%s: %,.2f','total',decimal('1234.565'))`,{})).toBe('total: 1,234.57');
 expect(e(`format('%d',long('9007199254740993'))`,{})).toBe('9007199254740993');
 expect(e(`format('%#.0f / %.3g',2.5,0.00001234)`,{})).toBe('3. / 1.23e-05');
 expect(e(`format('%tF %<tT',datetime(2024,2,29,13,4,5))`,{})).toBe('2024-02-29 13:04:05');
 expect(e(`format(datetime(2024,2,29),'date')`,{})).toBe((e(`datetime(2024,2,29)`,{}) as Date).toISOString().slice(0,10));
 expect(builtins.format('%f/%f',Infinity,NaN)).toBe('Infinity/NaN');
});
test('string/number patterns retain exact values, grouped digits, negative subpatterns and null/fallback',()=>{
 expect(e(`string(decimal('1200.5'),'#,##0.00')`,{})).toBe('1,200.50');
 expect(e(`string(long('9007199254740993'),'#,##0')`,{})).toBe('9,007,199,254,740,993');
 expect(e(`string(decimal('-12.3'),'0.00;(0.00)')`,{})).toBe('(12.30)');
 expect(e(`number('1,200.50','#,##0.00')`,{})).toBe(1200.5);
 expect(e(`number('(12.30)','0.00;(0.00)')`,{})).toBe(-12.3);
 expect(e(`number('12.5%','0.0%')`,{})).toBe(0.125);
 expect(e(`number('bad',7)`,{})).toBe(7);expect(e(`number('bad')`,{})).toBeNull();
 expect(e(`string(null)`,{})).toBeNull();expect(e(`string(datetime(2024,2,29,13,4,5),'yyyy-MM-dd HH:mm:ss')`,{})).toBe('2024-02-29 13:04:05');
 expect(e(`string([1,2,null],'000')`,{})).toBe('001,002,null');
 expect(e(`string@uq(text)`,{text:'中\n"'})).toBe('"\\u4E2D\\n\\\""');
});
test('invalid or unsupported format protocols fail and explicit replacements keep their own contracts',()=>{
 for(const source of ["format('%d','bad')","format('%s %s',1)","format('%q',1)","format('%+x',1)","format('%.2d',1)","format('%0d',1)","format('%10001s','x')","string(datetime(2024,1,1),'YYYY')","format@x('%s',1)","number@x('1')"])expect(()=>e(source,{})).toThrow();
 expect(e("format@x('%q',1)",{}, {...builtins,format:()=>99})).toBe(99);
});

test('source numeric text conversion includes trim, percent and hexadecimal forms',()=>{
 expect(e("number(' 5% ')",{})).toBe(0.05);expect(e("number('0xFF')",{})).toBe(255);
 expect(e("' 5% '+2",{})).toBe(2.05);expect(e("number('9007199254740993')",{})).toBe(9007199254740993n);
 expect(()=>e("format('%D',1)",{})).toThrow('Unsupported');
});

test('exact Decimal signs survive Number underflow in Formatter and numeric subpatterns', () => {
 const negative = decimal('-1e-400')!, positive = decimal('1e-400')!;
 const scope = { negative, positive };
 expect(e("format('%e / %+e',negative,positive)",scope)).toBe('-1.000000e-400 / +1.000000e-400');
 expect(e("format('%.2f / %.3g',negative,negative)",scope)).toBe('-0.00 / -1.00e-400');
 expect(e("string(negative,'0.000;(0.000)')",scope)).toBe('(0.000)');
 expect(e("string(positive,'0.000;(0.000)')",scope)).toBe('0.000');
 expect(e("string(negative,'0.000')",scope)).toBe('-0.000');
 expect(e("format('%e',decimal('-0'))",{})).toBe('0.000000e+00');
 expect(builtins.format('%f',-0)).toBe('-0.000000');
 expect([String(negative),String(positive)]).toEqual(['-1e-400','1e-400']);
});

test('protocol validation precedes string and null shortcuts while valid null and overrides remain usable', () => {
 for (const source of ["string('x',123)","string('x','',123)","string(null,123)","string(null,'',123)","format('%tq',null)","format('%Tq',null)"])
  expect(()=>e(source,{})).toThrow();
 expect(e("format('%tF / %d / %s',null,null,null)",{})).toBe('null / null / null');
 expect(e("string(null,'yyyy')",{})).toBeNull();
 expect(e("string('x',null)",{})).toBe('x');
 expect(e("string(12,null)",{})).toBe('12');
 expect(e("string@q('x',123)",{}, {...builtins,string:()=> 'custom'})).toBe('custom');
 expect(e("format('%tq',null)",{}, {...builtins,format:()=> 'custom'})).toBe('custom');
});

test('null character formats keep Java casing, padding and argument reuse while rejecting illegal protocols', () => {
 const scope = { value: null };
 expect(e("format('%c/%C',value,value)",scope)).toBe('null/NULL');
 expect(e("format('%1$8c/%<C/%<-8c',value)",scope)).toBe('    null/NULL/null    ');
 for (const pattern of ['%.1c','%.0C','%+c','%05c','%#C','%-c'])
  expect(()=>builtins.format(pattern,null)).toThrow();
 expect(builtins.format('%c',undefined)).toBe('null');
 expect(e("format('%c',value)",scope,{...builtins,format:()=> 'custom'})).toBe('custom');
 expect(scope).toEqual({value:null});
});

test('null floating conversions apply precision and uppercase before padding and ignore numeric sign/zero fill', () => {
 for (const conversion of ['f','e','E','g','G']) {
  const upper = conversion === conversion.toUpperCase();
  expect(builtins.format('%'+conversion,null)).toBe(upper?'NULL':'null');
  expect(builtins.format('%.2'+conversion,null)).toBe(upper?'NU':'nu');
  expect(builtins.format('%08.2'+conversion,null)).toBe(upper?'      NU':'      nu');
  expect(builtins.format('%-8.2'+conversion,null)).toBe(upper?'NU      ':'nu      ');
  expect(builtins.format('%+8.2'+conversion,null)).toBe(upper?'      NU':'      nu');
  expect(builtins.format('%(8.2'+conversion,null)).toBe(upper?'      NU':'      nu');
  expect(builtins.format('%.0'+conversion,null)).toBe('');
 }
 expect(e("format('%1$8.2e/%<E/%<.0g',null)",{})).toBe('      nu/NULL/');
 expect(e("format('%s/%d/%X/%tF',null,null,null,null)",{})).toBe('null/null/NULL/null');
 for (const pattern of ['%.2d','%.1x','%#g','%,e','%0f','%+ f','%tq'])
  expect(()=>builtins.format(pattern,null)).toThrow();
});
