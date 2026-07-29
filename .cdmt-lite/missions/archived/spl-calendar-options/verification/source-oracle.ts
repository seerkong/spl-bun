import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {evaluateExpression} from '../../../../../packages/expression/src';
const source=await Bun.file('/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/util/Variant.java').text();
function method(signature:string):string {
 const start=source.indexOf(signature);if(start<0)throw new Error(signature);
 let i=source.indexOf('{',start),depth=1;for(i++;depth;i++){if(source[i]==='{')depth++;if(source[i]==='}')depth--;}
 return source.slice(start,i);
}
const signatures=['public static Date elapse(Date date, int diff, String opt)','private static long yearInterval(Date date1, Date date2)','private static long quaterInterval(Date date1, Date date2)','private static long monthInterval(Date date1, Date date2)','private static long weekInterval(Date date1, Date date2)','private static long weekInterval_7(Date date1, Date date2)','private static long weekInterval_1(Date date1, Date date2)','public static long dayInterval(Date date1, Date date2)','public static long secondInterval(Date date1, Date date2)','private static long millisecondInterval(Date date1, Date date2)','public static long interval(Date date1, Date date2, String opt)','public static double realInterval(Date date1, Date date2, String opt)'];
const dates=[[2024,1,31,12],[2024,2,29,12],[2024,3,9,12],[2024,3,11,0],[2025,1,1,0],[1999,12,31,12],[2000,1,1,0],[2023,5,31,23]];
const options=['','y','q','m','s','ms','w','1','7','ym','ymd','md','yd','r','yr','qr','mr','sr','wr'];
const elapseOpts=['','y','ye','q','qe','m','me','s','ms'];
const dir=mkdtempSync(join(tmpdir(),'spl-source-calendar-'));
try{
const java=`import java.util.*; public class CalendarOracle {
static final long BASEDATE = date(2000,1,1,0).getTime();
static Date date(int y,int m,int d,int h){Calendar c=Calendar.getInstance();c.clear();c.set(y,m-1,d,h,0,0);return c.getTime();}
static class DateFactory {static DateFactory get(){return new DateFactory();} Calendar getCalendar(){return Calendar.getInstance();} int field(Date d,int f){Calendar c=getCalendar();c.setTime(d);return c.get(f);}int year(Date d){return field(d,Calendar.YEAR);}int month(Date d){return field(d,Calendar.MONTH);}int week(Date d){return field(d,Calendar.DAY_OF_WEEK);}}
${signatures.map(method).join('\n')}
public static void main(String[] args){
Date[] dates={${dates.map(x=>`date(${x.join(',')})`).join(',')}};
String[] opts={${options.map(x=>JSON.stringify(x)).join(',')}};
for(int i=0;i<dates.length;i++)for(int j=0;j<dates.length;j++)for(String opt:opts){double result=opt.contains("r")?realInterval(dates[i],dates[j],opt):interval(dates[i],dates[j],opt.isEmpty()?null:opt);System.out.println("i|"+i+"|"+j+"|"+opt+"|"+result);}
String[] shifts={${elapseOpts.map(x=>JSON.stringify(x)).join(',')}};
for(int i=0;i<dates.length;i++)for(int n:new int[]{-13,-1,0,1,13})for(String opt:shifts)System.out.println("e|"+i+"|"+n+"|"+opt+"|"+elapse(dates[i],n,opt.isEmpty()?null:opt).getTime());
System.out.println("decimal|"+new java.math.BigDecimal("2").divide(new java.math.BigDecimal("3"),16,java.math.RoundingMode.HALF_UP));
}}
`;
writeFileSync(join(dir,'CalendarOracle.java'),java);
let child=Bun.spawnSync(['javac','-d',dir,join(dir,'CalendarOracle.java')]);if(child.exitCode)throw new Error(new TextDecoder().decode(child.stderr));
const zones=process.env.SPL_ORACLE_CHILD?[process.env.TZ!]:['UTC','America/New_York','Asia/Shanghai'];
for(const zone of zones){
 if(!process.env.SPL_ORACLE_CHILD){const runner=Bun.spawnSync([process.execPath,import.meta.path],{env:{...process.env,TZ:zone,SPL_ORACLE_CHILD:'1'}});process.stdout.write(runner.stdout);if(runner.exitCode)throw new Error(new TextDecoder().decode(runner.stderr));continue;}
 child=Bun.spawnSync(['java',`-Duser.timezone=${zone}`,'-cp',dir,'CalendarOracle']);if(child.exitCode)throw new Error(new TextDecoder().decode(child.stderr));
 const values=dates.map(x=>new Date(x[0],x[1]-1,x[2],x[3]));let count=0;
 for(const line of new TextDecoder().decode(child.stdout).trim().split('\n')){
  const [kind,i,j,opt,result]=line.split('|');if(kind==='decimal'){if(String(evaluateExpression("decimal('2')/3",{}))!==i)throw new Error(line);continue;}
  const expression=kind==='i'?`interval${opt?'@'+opt:''}(a,b)`:`elapse${opt?'@'+opt:''}(a,${j})`;
  const value=evaluateExpression(expression,{a:values[Number(i)],b:values[Number(j)]});const actual=value instanceof Date?value.getTime():value;
  if(actual!==Number(result))throw new Error(`${zone} ${line}: TS ${String(actual)} expression ${expression}`);count++;
 }
 console.log(`${zone}: ${count} exact source calendar comparisons + Java BigDecimal division passed`);
}
}finally{rmSync(dir,{recursive:true,force:true});}
