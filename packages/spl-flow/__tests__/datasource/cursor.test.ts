import { expect,test } from "bun:test";
import { mkdtempSync,writeFileSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openCsvCursor } from "../../src";

test("CSV stream preserves import types and quoted newlines; failure/break/early-close release once",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"spl-csv-cursor-")),path=join(directory,"input.csv");
  let opened=0,closed=0;
  const options={observe:(event:"open"|"read"|"close")=>{if(event==="open")opened++;if(event==="close")closed++;}};
  try {
    writeFileSync(path,'id,label\n001,"a,b"\n2,"line\nbreak"');
    const source=await openCsvCursor(path,options);
    expect(source.columns).toEqual(["id","label"]);
    expect(await source.cursor.fetch(1)).toEqual([{id:"001",label:"a,b"}]);
    expect(await source.cursor.fetch(2)).toEqual([{id:2,label:"line\nbreak"}]);
    expect(closed).toBe(1);
    const early=await openCsvCursor(path,options);await early.cursor.close();await early.cursor.close();
    const broken=await openCsvCursor(path,options);for await(const _ of broken.cursor)break;
    writeFileSync(path,"id,v\n1,2,3");
    const malformed=await openCsvCursor(path,options);
    await expect(malformed.cursor.fetch()).rejects.toThrow();
    expect(opened).toBe(closed);
  } finally {rmSync(directory,{recursive:true,force:true});}
});
