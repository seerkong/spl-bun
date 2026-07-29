import { mkdtempSync,openSync,writeSync,closeSync,rmSync } from "node:fs";
import { Database } from "bun:sqlite";
import { join } from "node:path";
import { openCsvCursor,openSqliteCursor } from "../../../../../packages/spl-flow/src";

const directory=mkdtempSync("/private/tmp/spl-million-cursor-"),path=join(directory,"input.csv"),dbPath=join(directory,"input.db");
const count=1000000,fd=openSync(path,"w");
try {
  writeSync(fd,"id,value\n");
  for(let start=0;start<count;start+=4096)writeSync(fd,Array.from({length:Math.min(4096,count-start)},(_,offset)=>`${start+offset},${start+offset}\n`).join(""));
} finally {closeSync(fd);}
const database=new Database(dbPath);database.run("create table input(id integer,value integer)");
const insert=database.prepare("insert into input values(?,?)");database.transaction(()=>{for(let index=0;index<count;index++)insert.run(index,index);})();insert.finalize();database.close();

try {
  for(const type of ["CSV","SQLite"] as const) {
    Bun.gc(true);
    const baseline=process.memoryUsage().rss;
    let peak=baseline,opened=0,closed=0,reads=0,firstBytes=0;
    const observe=(event:"open"|"read"|"close",bytes=0)=>{if(event==="open")opened++;if(event==="close")closed++;if(event==="read")reads++;if(reads<=1024)firstBytes=bytes;};
    const source=type==="CSV"?await openCsvCursor(path,{observe}):openSqliteCursor({dbPath,sql:"select id,value from input"},{observe});
    let rows=0,maxBatch=0;
    try {
      const first=await source.cursor.fetch(1024);
      if(first.length!==1024||reads!==1024||firstBytes>1024*1024)throw new Error(`${type} eagerly read source before demand`);
      rows=first.length;maxBatch=first.length;
      while(true){const batch=await source.cursor.fetch(1024);peak=Math.max(peak,process.memoryUsage().rss);if(!batch.length)break;maxBatch=Math.max(maxBatch,batch.length);rows+=batch.length;}
    } finally {await source.cursor.close();}
    const rssIncrease=peak-baseline;
    console.log(JSON.stringify({source:type,rows,reads,firstBytes,maxBatch,opened,closed,rssIncreaseMiB:rssIncrease/1024/1024}));
    if(rows!==count||reads!==count||maxBatch>1024||opened!==1||closed!==1||rssIncrease>64*1024*1024)throw new Error(`${type} streaming resource bound failed`);
  }
} finally {rmSync(directory,{recursive:true,force:true});}
