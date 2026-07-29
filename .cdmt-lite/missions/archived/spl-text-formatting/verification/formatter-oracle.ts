import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {builtins,decimal} from '../../../../../packages/expression/src';
type Value=string|number|boolean|null|{long:string}|{decimal:string}|{date:number[]}|{double:number};
const date={date:[2024,2,29,13,4,5,123]};
const nullPatterns=[
 '%c','%C','%8c','%-8C','%1$c/%<C','%1$8c/%<C/%<-8c',
 ...['f','e','E','g','G'].flatMap(conversion=>['%','%.0','%.2','%8.2','%-8.2','%08.2','%+8.2','%(8.2'].map(prefix=>prefix+conversion)),
 '%1$8.2e/%<E/%<.0g','%s','%S','%d','%X','%tF',
];
const invalidNullPatterns=['%.1c','%.0C','%+c','%05c','%#C','%-c','%.2d','%.1x','%#g','%,e','%0f','%+ f','%<c','%tq'];
const cases:{pattern:string;values:Value[]}[]=[
 {pattern:'%s / %S / %.3s',values:['abc','abc','abcdef']},{pattern:'%2$s:%1$04d:%<x',values:[15,'id']},
 {pattern:'%b %b %b',values:[0,false,null]},{pattern:'%c %C',values:[65,98]},
 ...['%08d','%+8d','%(8d','%,d','% d','%-8d'].map(pattern=>({pattern,values:[-1234]})),
 {pattern:'%d',values:[{long:'9007199254740993'}]},{pattern:'%#08x/%#o',values:[255,8]},
 {pattern:'%x/%x',values:[-1,{long:'-1'}]},
 ...['0.00001234','999.999','0.0001','100000'].map(value=>({pattern:'%.3g',values:[{decimal:value}]})),
 ...['%08.2f','%+,.2f','%(12.2f','%.2e','%.3g','%#.0f'].map(pattern=>({pattern,values:[{decimal:'-1234.565'}]})),
 {pattern:'%.2f %.1f %.3g',values:[2.675,0.15,{double:12}]},
 {pattern:'%tF %<tT %<tL %<tN',values:[date]},{pattern:'%1$ta %1$tB %1$tj %1$tz %1$tY',values:[date]},
 {pattern:'%tr / %<tD / %<tR / %<tQ',values:[date]},{pattern:'%5%:%n%s',values:['after']},
 {pattern:'%s/%d/%tF',values:[null,null,null]},
 ...['-1e-400','1e-400'].map(value=>({pattern:'%e / %+.2f / %.3g',values:[{decimal:value},{decimal:value},{decimal:value}]})),
 ...nullPatterns.map(pattern=>({pattern,values:[null]})),
];
const numeric=[{value:'1200.50',pattern:'#,##0.00'},{value:'-1200.50',pattern:'#,##0.00;(#,##0.00)'},{value:'0.125',pattern:'0.0%'},{value:'9007199254740993',pattern:'#,##0'},{value:'1234567.89',pattern:'#,##,##0.00'},{value:'1.2',pattern:'000.00##'},{value:'0.1',pattern:'#.00'},{value:'1',pattern:'0.'},...['-1e-400','1e-400'].map(value=>({value,pattern:'0.000;(0.000)'}))];
const datePatterns=['yyyy-MM-dd HH:mm:ss.SSS','EEE, MMM d, yyyy','yyyyMMdd\'T\'HHmmss','yyyy D a hh:mm','yyyy-MM-dd Z XXX'];
function ts(value:Value):unknown {if(!value||typeof value!=='object')return value;if('double'in value)return value.double;if('long'in value)return BigInt(value.long);if('decimal'in value)return decimal(value.decimal);return new Date(value.date[0],value.date[1]-1,...value.date.slice(2) as [number,number,number,number,number]);}
function java(value:Value):string {if(value===null)return 'null';if(typeof value==='string')return JSON.stringify(value);if(typeof value==='number')return Number.isInteger(value)?`Integer.valueOf(${value})`:`Double.valueOf(${value})`;if(typeof value==='boolean')return String(value);if('double'in value)return `Double.valueOf(${value.double})`;if('long'in value)return `Long.valueOf("${value.long}")`;if('decimal'in value)return `new java.math.BigDecimal("${value.decimal}")`;return `date(${value.date.join(',')})`;}
const dir=mkdtempSync(join(tmpdir(),'spl-format-oracle-')),jar='/Users/kongweixian/infra-dev/esProc/lib/icu4j-60.3.jar';
try{
writeFileSync(join(dir,'FormatOracle.java'),`import java.util.*;import java.text.*; public class FormatOracle {
static Date date(int y,int m,int d,int h,int min,int s,int ms){Calendar c=Calendar.getInstance();c.clear();c.set(y,m-1,d,h,min,s);c.set(Calendar.MILLISECOND,ms);return c.getTime();}
static void out(String text){System.out.println(Base64.getEncoder().encodeToString(text.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}
static void invalid(String pattern){try{out("accepted:"+String.format(pattern,new Object[]{null}));}catch(IllegalFormatException error){out("rejected");}}
public static void main(String[]args){Locale.setDefault(Locale.US);
${cases.map(item=>`out(String.format(${JSON.stringify(item.pattern)},new Object[]{${item.values.map(java).join(',')}}));`).join('\n')}
${numeric.map(item=>`{com.ibm.icu.text.DecimalFormat f=new com.ibm.icu.text.DecimalFormat(${JSON.stringify(item.pattern)});f.setRoundingMode(java.math.BigDecimal.ROUND_HALF_UP);out(f.format(new java.math.BigDecimal("${item.value}")));}`).join('\n')}
${datePatterns.map(pattern=>`out(new SimpleDateFormat(${JSON.stringify(pattern)},Locale.US).format(${java(date)}));`).join('\n')}
${invalidNullPatterns.map(pattern=>`invalid(${JSON.stringify(pattern)});`).join('\n')}
}}`);
let child=Bun.spawnSync(['javac','-cp',jar,'-d',dir,join(dir,'FormatOracle.java')]);if(child.exitCode)throw new Error(new TextDecoder().decode(child.stderr));
child=Bun.spawnSync(['java',`-Duser.timezone=${Intl.DateTimeFormat().resolvedOptions().timeZone}`,'-cp',`${dir}:${jar}`,'FormatOracle']);if(child.exitCode)throw new Error(new TextDecoder().decode(child.stderr));
const expected=new TextDecoder().decode(child.stdout).trim().split('\n').map(text=>Buffer.from(text,'base64').toString());
const actual=[...cases.map(item=>builtins.format(item.pattern,...item.values.map(ts))),...numeric.map(item=>builtins.string(decimal(item.value),item.pattern)),...datePatterns.map(pattern=>builtins.string(ts(date),pattern)),...invalidNullPatterns.map(pattern=>{try{return 'accepted:'+builtins.format(pattern,null);}catch{return 'rejected';}})];
if(actual.length!==expected.length)throw new Error(`Oracle result count mismatch: TS ${actual.length} Java ${expected.length}`);
actual.forEach((value,index)=>{if(value!==expected[index])throw new Error(`Format case ${index}: ${JSON.stringify(cases[index])}; TS ${JSON.stringify(value)} Java ${JSON.stringify(expected[index])}`);});
console.log(`${actual.length} actual Java Formatter / ICU DecimalFormat / SimpleDateFormat cases passed (${nullPatterns.length} null results and ${invalidNullPatterns.length} null protocol rejections)`);
}finally{rmSync(dir,{recursive:true,force:true});}
