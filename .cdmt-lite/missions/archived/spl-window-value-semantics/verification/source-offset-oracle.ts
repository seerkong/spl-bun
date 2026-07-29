import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {windowTable,type WindowOutputs} from '../../../../../packages/expression/src';
const source=await Bun.file('/Users/kongweixian/infra-dev/esProc/src/main/java/com/scudata/expression/Move.java').text();
function method(signature:string):string{const start=source.indexOf(signature);if(start<0)throw new Error(signature);let i=source.indexOf('{',start),depth=1;for(i++;depth;i++){if(source[i]==='{')depth++;if(source[i]==='}')depth--;}return source.slice(start,i);}
const edges=[-9,-2,-1,0,1,3,9,null],dir=mkdtempSync(join(tmpdir(),'spl-source-offset-'));
try{
writeFileSync(join(dir,'OffsetOracle.java'),`public class OffsetOracle {
static class Current{int position,size;Current(int p,int n){position=p;size=n;}int getCurrentIndex(){return position;}int length(){return size;}}
static class Context{} interface Leaf{Object calculate(Context c);}interface IParam{Leaf getLeafExpression();}
static class MessageManager{String getMessage(String s){return s;}} static class EngineMessage{static MessageManager get(){return new MessageManager();}}static class RQException extends RuntimeException{RQException(String s){super(s);}}
${method('public static int calculateIndex(Current current, IParam param, Context ctx)')}
${method('private static int[] moves(Current current, Number start, Number end)')}
public static void main(String[] args){Integer[] edges={${edges.map(n=>n===null?'null':n).join(',')}};
for(int n=1;n<=6;n++)for(int p=1;p<=n;p++){
Current c=new Current(p,n);
for(int i=0;i<edges.length;i++)for(int j=0;j<edges.length;j++){int[] range=moves(c,edges[i],edges[j]);long sum=0;int count=0;if(range!=null)for(int k=range[0];k<=range[1];k++){sum+=k;count++;}System.out.println(n+"|"+p+"|f"+(i*edges.length+j)+"|"+sum+"|"+count);}
for(int offset=-9;offset<=9;offset++){final int o=offset;int position=calculateIndex(c,()->ctx->o,new Context());System.out.println(n+"|"+p+"|o"+(offset+9)+"|"+position);}
}}}
`);
let child=Bun.spawnSync(['javac','-d',dir,join(dir,'OffsetOracle.java')]);if(child.exitCode)throw new Error(new TextDecoder().decode(child.stderr));
child=Bun.spawnSync(['java','-cp',dir,'OffsetOracle']);if(child.exitCode)throw new Error(new TextDecoder().decode(child.stderr));
const results=new Map<number,Record<string,unknown>[]>();
for(let n=1;n<=6;n++){
 const outputs:WindowOutputs={frames:[],lag:[],lead:[]};
 for(let i=0;i<edges.length;i++)for(let j=0;j<edges.length;j++){
  const frame={start:edges[i],end:edges[j]};outputs.frames!.push({...frame,as:'f'+(i*edges.length+j),column:'id',kind:'sum'},{...frame,as:'c'+(i*edges.length+j),kind:'count'});
 }
 for(let offset=-9;offset<=9;offset++)outputs[offset<0?'lag':'lead']!.push({column:'id',as:'o'+(offset+9),offset:Math.abs(offset),defaultValue:0});
 results.set(n,windowTable({schema:[{name:'id',type:'number'}],rows:Array.from({length:n},(_,i)=>({id:i+1}))},{orderBy:[{column:'id'}],outputs}).rows);
}
let count=0;
for(const line of new TextDecoder().decode(child.stdout).trim().split('\n')){
 const [n,p,key,value,size]=line.split('|'),row=results.get(Number(n))![Number(p)-1];
 if((row[key]??0)!==Number(value)||size!==undefined&&row['c'+key.slice(1)]!==Number(size))throw new Error(`Source offset mismatch ${line}: ${JSON.stringify(row)}`);count++;
}
console.log(`${count} actual Java Move offset/range cases matched windowTable (inclusive endpoints, clipping, empty/reverse ranges, partition edges)`);
}finally{rmSync(dir,{recursive:true,force:true});}
