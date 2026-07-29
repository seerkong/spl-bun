import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openSqliteCursor } from "../src";

test("real SQLite cursors use independent statement positions and close before fetch, EOF, error and abort",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"spl-sqlite-cursor-")),dbPath=join(directory,"input.db");
  const db=new Database(dbPath);db.run("create table t(id);insert into t values(1),(2),(3)");db.close();
  let opened=0,closed=0,reads=0;
  const options={observe:(event:"open"|"read"|"close")=>{if(event==="open")opened++;if(event==="close")closed++;if(event==="read")reads++;}};
  try {
    const first=openSqliteCursor({dbPath,sql:"select * from t"},options),second=openSqliteCursor({dbPath,sql:"select * from t"},options);
    expect(reads).toBe(0);
    expect(await first.cursor.fetch(2)).toEqual([{id:1},{id:2}]);
    expect(await second.cursor.fetch(1)).toEqual([{id:1}]);
    await second.cursor.close();
    expect(await first.cursor.fetch(2)).toEqual([{id:3}]);
    expect(opened).toBe(closed);
    const neverRead=openSqliteCursor({dbPath,sql:"select * from t"},options);await neverRead.cursor.close();
    expect(()=>openSqliteCursor({dbPath,sql:"select missing from t"},options)).toThrow();
    const abort=new AbortController(),cancelled=openSqliteCursor({dbPath,sql:"select * from t"},{...options,signal:abort.signal});
    abort.abort(new Error("cancel sql"));await cancelled.cursor.close();
    await expect(cancelled.cursor.fetch()).rejects.toThrow("cancel sql");
    expect(opened).toBe(closed);
  } finally {rmSync(directory,{recursive:true,force:true});}
});
