/** Source bodies run on Java, not a second TypeScript expected-value model.
 * Containers/leaf Context are isolated harness adapters. FloatingDecimal and
 * default DateFormatFactory/DateFormatX run unchanged from source. */
import {mkdtempSync,writeFileSync,readFileSync,mkdirSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';
import {splParse} from '../../../../../packages/expression/src';
const root='/Users/kongweixian/infra-dev/esProc/src/main/java/';
const files=['com/scudata/expression/fn/convert/Parse.java','com/scudata/util/Variant.java','com/scudata/common/Sentence.java','com/scudata/common/StringUtils.java','com/scudata/common/Escape.java','com/scudata/util/JSONUtil.java'];
const sources=files.map(file=>readFileSync(root+file,'utf8'));
function method(source:string,signature:string):string {
 const start=source.indexOf(signature);if(start<0)throw Error(signature);
 let i=source.indexOf('{',start),depth=0,state='code';
 for(;i<source.length;i++) {const c=source[i],next=source[i+1];
  if(state==='line'){if(c==='\n')state='code';continue;}
  if(state==='comment'){if(c==='*'&&next==='/'){state='code';i++;}continue;}
  if(state==='"'||state==="'"){if(c==='\\')i++;else if(c===state)state='code';continue;}
  if(c==='/'&&next==='/'){state='line';i++;continue;}if(c==='/'&&next==='*'){state='comment';i++;continue;}
  if(c==='"'||c==="'"){state=c;continue;}if(c==='{')depth++;if(c==='}'&&--depth===0)return source.slice(start,i+1);
 }throw Error(signature);
}
const texts=['',' ','true','false','null','True','NULL','42','-42','+42','0','-0','-0.0','1e3','1E-3','1E3D','1f%','.5','-.5','5%','0xFF','42L','1.5f','1.5D','9007199254740993','NaN','Infinity','-Infinity',
 '+NaN','-NaN','NaN%','Infinity%','-Infinity%','+Infinity','+Infinity%','+NaN%','-NaN%','NaN %','Infinity \t%',
 'bad','12.5kg','+12kg','1.2.3','-','12,34','"12"',"'12'",'  "first" trailing "last"','before "value"','"a\\\"b" trailing','"a\\n\\u4e2d\\b" tail','\\u0031\\u0032','x\\','\\u12','\\uxxxx',
 '[1,2]','[1,true,null,"x",{"a":2}]','{a:1,b:[2,],name:"ok"}','{}','[]','[1,]','{"a":1,}','{"a":null,"b":false}','["a\\b","a\\n"]','[bad,null]','[1,2','{broken}',
 '2024-02-29','2024-2-9 12:3:4','12:30:59','2023-02-29','2024-13-01','2024-02-29x','25:00:00'];
const cases=texts.flatMap(text=>['','q','e','n','qe','qn','en','qen'].map(option=>({text,option})));
const dir=mkdtempSync(join(tmpdir(),'spl-parse-oracle-'));
try {
 const copied=['com/scudata/util/FloatingDecimal.java','com/scudata/common/DateFormatFactory.java','com/scudata/common/DateFormatX.java'];
 for(const file of copied){mkdirSync(dirname(join(dir,file)),{recursive:true});writeFileSync(join(dir,file),readFileSync(root+file));}
 const methods=(index:number,signatures:string[])=>signatures.map(signature=>method(sources[index],signature)).join('\n');
 const code=`import java.util.*;import java.math.*;import com.scudata.util.FloatingDecimal;import com.scudata.common.DateFormatFactory;
public class ParseOracle {
 static class Context{} interface Leaf{Object calculate(Context c);}interface Param{Leaf getLeafExpression();}
 static class Parse{Param param;String option;${method(sources[0],'public Object calculate(Context ctx)')}}
 static class Sentence{${methods(2,['public static int scanQuotation(String str, int start, char escapeChar)','public static int scanQuotation(String str, int start)'])}}
 static class StringUtils{${methods(3,['public final static StringBuffer unicode(String s, StringBuffer sb)','public final static String unicode(String s)'])}}
 static class Escape{${methods(4,['public static String remove( String str )','public static String remove( String str, char escapeChar )'])}}
 static class Variant{${methods(1,['public static Object parse(String text, boolean removeEscAndQuote)','public static Number parseNumber(String s)','public static Integer parseInt(String s)','public static Long parseLong(String s)','public static Long parseLong(String s, int radix)','public static Object parseDate(String text)'])}}
 static class IArray extends ArrayList<Object>{}
 static class DataStruct{String[]names;DataStruct(String[]n){names=n;}int getFieldIndex(String n){return Arrays.asList(names).indexOf(n);}}
 static class BaseRecord{DataStruct ds;Object[]values;String[]getFieldNames(){return ds.names;}Object[]getFieldValues(){return values;}Object getNormalFieldValue(int i){return values[i];}void setNormalFieldValue(int i,Object v){values[i]=v;}}
 static class Record extends BaseRecord{Record(DataStruct d){ds=d;values=new Object[d.names.length];}void setDataStruct(DataStruct d){ds=d;}}
 // Java containers map to JS arrays/own-property records; Table alignment is not exercised.
 static class Sequence{IArray values=new IArray();void add(Object v){values.add(v);}boolean isPmt(){return false;}DataStruct dataStruct(){return null;}int length(){return values.size();}Object getMem(int i){return values.get(i-1);}IArray getMems(){return values;}}
 static class Table extends Sequence{DataStruct ds;Table(DataStruct d,int n){ds=d;}BaseRecord newLast(){Record r=new Record(ds);values.add(r);return r;}}
 static class JSONUtil{${methods(5,['private static int scanQuotation(char []chars, int start, int end)','private static int indexOf(char []chars, int start, int end, char c)','private static Sequence parseSequence(char []chars, int start, int end, String opt)','private static BaseRecord parseRecord(char []chars, int start, int end, String opt)','public static Object parseJSON(char []chars, int start, int end, String opt)','public static Object parseJSON(char []chars, int start, int end)','private static Object parse(String s)'])}}
 static String b64(String s){return Base64.getEncoder().encodeToString(s.getBytes(java.nio.charset.StandardCharsets.UTF_8));}
 static String encode(Object o){if(o==null)return "[\\"null\\"]";if(o instanceof String)return "[\\"s\\",\\""+b64((String)o)+"\\"]";if(o instanceof Number)return "[\\"n\\",\\""+o+"\\"]";if(o instanceof Boolean)return "[\\"b\\","+o+"]";if(o instanceof Date)return "[\\"d\\",\\""+((Date)o).getTime()+"\\"]";
 if(o instanceof Sequence){StringJoiner j=new StringJoiner(",","[\\"a\\",[","]]");for(Object v:((Sequence)o).values)j.add(encode(v));return j.toString();}
 BaseRecord r=(BaseRecord)o;StringJoiner j=new StringJoiner(",","[\\"o\\",[","]]");for(int i=0;i<r.values.length;i++)j.add("[\\""+b64(r.ds.names[i])+"\\","+encode(r.values[i])+"]");return j.toString();}
 public static void main(String[]args){String[][]cases={${cases.map(c=>`{${JSON.stringify(Buffer.from(c.text).toString('base64'))},${JSON.stringify(c.option)}}`).join(',')}};
 for(int i=0;i<cases.length;i++){String text=new String(Base64.getDecoder().decode(cases[i][0]),java.nio.charset.StandardCharsets.UTF_8);Parse p=new Parse();p.option=cases[i][1];p.param=()->c->text;
 try{System.out.println(i+"|"+encode(p.calculate(new Context())));}catch(RuntimeException e){System.out.println(i+"|[\\"error\\"]");}}}}
 `;
 writeFileSync(join(dir,'ParseOracle.java'),code);
 let child=Bun.spawnSync(['javac','-d',dir,...copied.map(file=>join(dir,file)),join(dir,'ParseOracle.java')]);
 if(child.exitCode)throw Error(new TextDecoder().decode(child.stderr));
 child=Bun.spawnSync(['java','-cp',dir,'ParseOracle']);if(child.exitCode)throw Error(new TextDecoder().decode(child.stderr));
 function same(expected:any,actual:unknown):boolean {
  const [type,value]=expected;
  if(type==='null')return actual===null;
  if(type==='s')return actual===Buffer.from(value,'base64').toString();
  if(type==='b')return actual===value;
  if(type==='d')return actual instanceof Date&&+actual===Number(value);
  if(type==='n')return typeof actual==='bigint'?actual.toString()===value:typeof actual==='number'&&(Object.is(actual,Number(value))||actual===Number(value));
  if(type==='a')return Array.isArray(actual)&&actual.length===value.length&&value.every((v:any,i:number)=>same(v,actual[i]));
  if(type==='o')return actual!==null&&typeof actual==='object'&&Object.keys(actual).length===value.length&&value.every(([key,v]:any)=>same(v,(actual as any)[Buffer.from(key,'base64').toString()]));
  return false;
 }
 const failures:string[]=[];
 for(const line of new TextDecoder().decode(child.stdout).trim().split('\n')){
  const [index,encoded]=line.split('|'),c=cases[+index],expected=JSON.parse(encoded);let actual:unknown,thrown=false;
  try{actual=splParse(c.text,c.option);}catch{thrown=true;}
  if(expected[0]==='error'? !thrown : thrown||!same(expected,actual))failures.push(`${index} ${JSON.stringify(c)}: Java ${encoded}, TS ${String(actual)} ${thrown?'THREW':''}`);
 }
 if(failures.length)throw Error(failures.join('\n'));
 console.log(`${cases.length} actual Java Parse/Variant/JSONUtil/Sentence/StringUtils cases matched; source FloatingDecimal and default DateFormatX unchanged; leaf/container adapters above, source JSON unsafe integers separately adapted as text`);
 console.log(JSON.stringify([...files,...copied].map(file=>({file,sha256:createHash('sha256').update(readFileSync(root+file)).digest('hex')}))));
}finally{rmSync(dir,{recursive:true,force:true});}
