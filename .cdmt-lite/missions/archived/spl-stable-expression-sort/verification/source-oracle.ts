/** Actual Sequence.sort/sort_u and CommonComparator bodies, compiled in an
 * isolated harness. AST projection, 1-based storage/context, scalar equality
 * and stable Arrays.sort are harness adapters, not a full esProc runtime. */
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';
import {sortRows,decimal} from '../../../../../packages/expression/src';
const root='/Users/kongweixian/infra-dev/esProc/src/main/java/', jar='/Users/kongweixian/infra-dev/esProc/lib/icu4j-60.3.jar';
const files=['com/scudata/dm/Sequence.java','com/scudata/dm/comparator/CommonComparator.java','com/scudata/dm/comparator/ArrayComparator2.java'];
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
 }throw Error('unclosed '+signature);
}
type Value=number|string|boolean|null|bigint|Date|ReturnType<typeof decimal>;
const fixtures:Value[][][]=[[[2,0],[1,1],[2,2]],[[1,2],[2,1],[1,1],[1,2]],[[null,1],[2,0],[null,0],[1,2]],
 [[9007199254740993n,0],[9007199254740992n,1],[decimal('9007199254740992.1'),2]],
 [[decimal('0.1'),0],[0.1,1],[decimal('0.10'),2]],[[new Date(2),0],[new Date(1),1],[new Date(2),2]],
 [['z',0],['ä',1],['a',2]],[['b',0],['a',1],['b',2]],[[false,1],[true,0],[false,0]],[]];
function java(v:Value):string {if(v===null)return 'null';if(v instanceof Date)return `new Date(${+v}L)`;
 if(typeof v==='bigint')return `Long.valueOf("${v}")`;if(typeof v==='object')return `new BigDecimal("${v}")`;
 return typeof v==='string'?JSON.stringify(v):typeof v==='number'&&!Number.isInteger(v)?v+'d':String(v);}
const cases=fixtures.flatMap((keys,f)=>['','z','0','z0','u','uz0','mixed','locale'].map(option=>({keys,f,option})));
const dir=mkdtempSync(join(tmpdir(),'spl-sort-oracle-'));
try {
 const code=`import java.util.*;import java.math.*;import com.ibm.icu.text.Collator;
public class SortOracle {
 static class RQException extends RuntimeException {RQException(String s){super(s);}}
 static class MessageManager {String getMessage(String s,Object...v){return s;}}static class EngineMessage{static MessageManager get(){return new MessageManager();}}
 static class BaseRecord{int compareTo(BaseRecord b){throw new UnsupportedOperationException();}}static class SerialBytes{int compareTo(SerialBytes b){throw new UnsupportedOperationException();}}
 static class Variant{static String getDataType(Object o){return "harness";}static int compareArrays(byte[]a,byte[]b){return Arrays.compare(a,b);}
 // Equality adapter restricted to the scalar fixture domain; grouping loop is source verbatim.
 static boolean isEquals(Object a,Object b){if(a==null||b==null)return a==b;if(a instanceof Number&&b instanceof Number)return new CommonComparator(null,true,false).compare(a,b)==0;return a.equals(b);}}
 static class CommonComparator implements Comparator<Object>{final Collator collator;final boolean isAsc,isNullLast;
 CommonComparator(Collator c,boolean a,boolean n){collator=c;isAsc=a;isNullLast=n;}
 ${method(sources[1],'public int compare(Object o1, Object o2)')}}
 static class ArrayComparator2 implements Comparator<Object>{CommonComparator[]comparators;int len;ArrayComparator2(CommonComparator[]c,int n){comparators=c;len=n;}
 ${method(sources[2],'public int compare(Object o1, Object o2)')}}
 interface Expression{Object calculate(Context c);}static class Context{ComputeStack stack=new ComputeStack();ComputeStack getComputeStack(){return stack;}}
 static class ComputeStack{Current current;void push(Current c){current=c;}void pop(){current=null;}}
 static class Current{Sequence seq;int index;Current(Sequence s){seq=s;}void setCurrent(int i){index=i;}}
 static class IArray{ArrayList<Object>list=new ArrayList<>();int size(){return list.size();}Object get(int i){return list.get(i-1);}void add(Object o){list.add(o);}void set(int i,Object o){list.set(i-1,o);}}
 static class MultithreadUtil{static void sort(Object[]v,int a,int b,Comparator<Object>c){Arrays.sort(v,a,b,c);}}
 static class Sequence{IArray mems=new IArray();Sequence(int n){}IArray getMems(){return mems;}int length(){return mems.size();}
 int compareTo(Sequence s,Comparator<Object>c){throw new UnsupportedOperationException();}
 static Locale parseLocale(String s){return Locale.forLanguageTag(s.replace('_','-'));}
 Sequence calc(Expression exp,Context ctx){Sequence r=new Sequence(length());Current c=new Current(this);ctx.stack.push(c);try{for(int i=1;i<=length();i++){c.setCurrent(i);r.mems.add(exp.calculate(ctx));}}finally{ctx.stack.pop();}return r;}
 Sequence sort_u(){return sort_u(c->c.stack.current.seq.mems.get(c.stack.current.index),new Context());}
 ${method(sources[0],'private Sequence sort_u(Expression exp, Context ctx)')}
 ${method(sources[0],'private Sequence sort_u(Expression []exps, Context ctx)')}
 ${method(sources[0],'public Sequence sort(Expression[] exps, int[] orders, String loc, String opt, Context ctx)')}
 }static class Table extends Sequence{Table(){super(0);}}
 static Expression key(int i){return c->((Object[])c.stack.current.seq.mems.get(c.stack.current.index))[i];}
 public static void main(String[]args){${cases.map(({keys,option},i)=>`{Sequence s=new Sequence(0);Object[][]v={${keys.map((k,j)=>`{${java(k[0])},${java(k[1])},${j}}`).join(',')}};for(Object[]r:v)s.mems.add(r);
 Sequence result=s.sort(new Expression[]{key(0),key(1)},new int[]{${option==='z'||option==='z0'?'-1,-1':option==='mixed'?'1,-1':'1,1'}},${option==='locale'? '"de_DE"':'null'},"${option}",new Context());StringJoiner out=new StringJoiner(",");for(Object r:result.mems.list)out.add(((Object[])r)[2].toString());System.out.println("${i}|"+out);}`).join('\n')}}}
 `;
 writeFileSync(join(dir,'SortOracle.java'),code);
 for(const args of [['javac','-cp',jar,'-d',dir,join(dir,'SortOracle.java')],['java','-cp',dir+':'+jar,'SortOracle']]) {
  const child=Bun.spawnSync(args);if(child.exitCode)throw Error(new TextDecoder().decode(child.stderr));
  if(args[0]==='java')for(const line of new TextDecoder().decode(child.stdout).trim().split('\n')) {
   const [index,expected]=line.split('|'),c=cases[+index];
   const actual=sortRows(c.keys.map((k,id)=>({k,id})),[0,1].map(i=>({value:r=>r.k[i],direction:c.option==='mixed'?(i===0?1:-1):undefined})),{
    descending:c.option==='z'||c.option==='z0',nullsLast:c.option.includes('0'),groupEqual:c.option.includes('u'),locale:c.option==='locale'?'de_DE':undefined,
   }).map(r=>r.id).join(',');
   if(actual!==expected)throw Error(`Sort mismatch ${index} ${c.option}: ${actual} != ${expected}`);
  }
 }
 console.log(`${cases.length} actual Java source sort cases matched (multi-key directions, null/0, exact numeric, date, locale, stable prefix grouping; scalar/storage adapters above)`);
 console.log(JSON.stringify(files.map((file,i)=>({file,sha256:createHash('sha256').update(sources[i]).digest('hex')}))));
} finally {rmSync(dir,{recursive:true,force:true});}
