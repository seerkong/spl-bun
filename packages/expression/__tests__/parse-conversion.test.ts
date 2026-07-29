import {expect,test} from 'bun:test';
import {evaluateExpression as e,builtins,splParse} from '../src';
test('parse defaults convert scalar text, scientific/long numbers and data-only JSON',()=>{
 for(const [text,value] of [['true',true],['false',false],['null',null],['',null],['   ','   '],['1e3',1000],['5%',0.05],['0xFF',255],['42L',42],['bad','bad'],['"12"','"12"']] as const)
  expect(splParse(text)).toEqual(value);
 expect(e('parse(text)',{text:'9007199254740993'})).toBe(9007199254740993n);
 expect(Object.is(splParse('-0'),0)).toBe(true);
 expect(Object.is(splParse('-0.0'),-0)).toBe(true);
 expect(splParse('1E3D')).toBe(1000);expect(splParse('1f%')).toBe(0.01);
 expect(splParse('[1,true,null,"x",{"a":2}]')).toEqual([1,true,null,'x',{a:2}]);
 expect(splParse('{a:1,b:[2,],name:"ok"}')).toEqual({a:1,b:[2,null],name:'ok'});
 expect(splParse('{}')).toBe('{}');
 expect(splParse('[9007199254740993]')).toEqual(['9007199254740993']);
 const object=splParse('{"__proto__":{"polluted":1}}') as any;
 expect(Object.getPrototypeOf(object)).toBe(Object.prototype);expect(object.__proto__).toEqual({polluted:1});
 expect(({} as any).polluted).toBeUndefined();
});
test('parse q/e/n follows source quote scan, escaping and option priority',()=>{
 expect(splParse('  "first" trailing "last"','q')).toBe('"first"');
 expect(splParse('before "value"','q')).toBe('before "value"');
 expect(splParse('  "a\\\"b" trailing','q')).toBe('"a\\\"b"');
 expect(splParse('  "a\\n\\u4e2d\\b" trailing','qe')).toBe('a\n中b');
 expect(splParse('\\u0031\\u0032','e')).toBe(12);
 expect(splParse('"12"','en')).toBe('12');
 expect(splParse('true','en')).toBe(true);
 expect(splParse('"12" ignored','qn')).toBe('"12"');
 expect(splParse('  -12.5kg','n')).toBe(-12.5);
 expect(splParse('1e3','n')).toBe(1);
 expect(splParse('5%','n')).toBe(5);
 for(const text of ['bad','+12kg','1.2.3','-','   '])expect(splParse(text,'n')).toBeNull();
});
test('parse recognizes source nonfinite tokens without changing option priority or overflow policy',()=>{
 const cases:[string,number][]=[['+NaN',NaN],['-NaN',NaN],['NaN%',NaN],['Infinity%',Infinity],['-Infinity%',-Infinity]];
 for(const [text,expected] of cases){
  const scope={text};
  for(const option of ['','q','e','qe','en','qen']) {
   const value=e('parse(text,option)',{...scope,option});
   expect(typeof value).toBe('number');expect(value).toBe(expected);
  }
  for(const option of ['n','qn'])expect(splParse(text,option)).toBeNull();
  const captured=e('regex@p(text,pattern)',{text,pattern:'^(.+)$'}) as unknown[];
  expect(typeof captured[0]).toBe('number');expect(captured).toEqual([expected]);
  expect(splParse('"'+text+'"','q')).toBe('"'+text+'"');
  expect(splParse('"'+text+'"','qe')).toBe(text);
  expect(scope.text).toBe(text);
 }
 for(const text of ['1e999','-1e999','1e999%'])expect(()=>splParse(text)).toThrow('overflow');
 for(const text of ['nan','infinity','NaNx','Infinity%%'])expect(splParse(text)).toBe(text);
 expect(e('if(false,parse("1e999"),parse("+NaN"))',{})).toBeNaN();
});
test('parse uses validated default calendar patterns and preserves non-string input authority',()=>{
 for(const [text,parts] of [['2024-02-29',[2024,2,29,0,0,0]],['2024-2-9 12:3:4',[2024,2,9,12,3,4]],['12:30:59',[1970,1,1,12,30,59]]] as const){
  const date=splParse(text) as Date;
  expect(date).toBeInstanceOf(Date);expect([date.getFullYear(),date.getMonth()+1,date.getDate(),date.getHours(),date.getMinutes(),date.getSeconds()]).toEqual(parts);
 }
 for(const text of ['2023-02-29','2024-13-01','2024-02-29x','25:00:00'])expect(splParse(text)).toBe(text);
 const value={a:[1,2]};expect(splParse(value)).toBe(value);expect(value).toEqual({a:[1,2]});
});
test('parse rejects malformed protocols before shortcuts, resources and escapes; overrides and lazy calls retain their contract',()=>{
 for(const source of ['parse()','parse(1,2,3)','parse@q(1,"e")','parse(1;"q")','parse@x(1)','parse(null,123)'])expect(()=>e(source,{})).toThrow();
 for(const text of ['x\\','\\u12','\\uxxxx'])expect(()=>splParse(text,'e')).toThrow();
 expect(()=>splParse('1e999')).toThrow('overflow');
 expect(()=>splParse('['.repeat(130)+']'.repeat(130))).toThrow('nesting');
 expect(e('if(false,parse@x(1),7)',{})).toBe(7);
 expect(e('parse@x(1,2)',{}, {...builtins,parse:()=>9})).toBe(9);
});
