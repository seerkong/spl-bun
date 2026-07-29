import { expect, test } from "bun:test";
import { Cursor, evaluateExpression, deriveCursor, projectCursor, selectCursor } from "../src";

function tracked(length:number) {
  const stats={reads:0,closed:0};
  const cursor=new Cursor<number>(()=>{let next=1;return{next(){stats.reads++;return next<=length?{done:false,value:next++}:{done:true,value:undefined};},return(){stats.closed++;return{done:true,value:undefined};}};});
  return {cursor,stats};
}

test("production cursor advances, serializes commands, stays lazy and terminates exactly once",async()=>{
  const {cursor,stats}=tracked(5);
  expect(stats.reads).toBe(0);
  expect(await cursor.fetch(2)).toEqual([1,2]);
  expect(await cursor.skip(1)).toBe(1);
  expect(await cursor.fetch(2)).toEqual([4,5]);
  expect(cursor.position).toBe(5);
  expect(await cursor.fetch(2)).toEqual([]);
  expect(cursor.state).toBe("eof");
  await cursor.close();await cursor.close();expect(stats.closed).toBe(1);
  const another=tracked(5);
  expect(await Promise.all([another.cursor.fetch(2),another.cursor.skip(1),another.cursor.fetch(2)])).toEqual([[1,2],1,[4,5]]);
  await another.cursor.close();
  await expect(another.cursor.fetch(1)).rejects.toThrow("closed");
});

test("cursor transforms consume only demand and materialization is explicitly bounded",async()=>{
  const {cursor,stats}=tracked(1000000);
  const derived=cursor.filter(value=>value%2===0).map(value=>({v:value*2}));
  expect(await derived.fetch(2)).toEqual([{v:4},{v:8}]);
  expect(stats.reads).toBe(4);
  await derived.close();expect(stats.closed).toBe(1);
  const limited=tracked(5);
  await expect(limited.cursor.collect(3)).rejects.toThrow("maxRows");
  expect(limited.stats.reads).toBe(4);expect(limited.stats.closed).toBe(1);
  const broken=tracked(10);
  await expect(broken.cursor.map(()=>{throw new Error("mapper failed");}).fetch()).rejects.toThrow("mapper failed");
  expect(broken.stats.closed).toBe(1);
  const early=tracked(10);for await(const value of early.cursor){expect(value).toBe(1);break;}
  expect(early.stats.closed).toBe(1);
  await expect(Cursor.from([1]).fetch(1025)).rejects.toThrow("1024");
});

test("cooperative pending reads close on abort and timeout without returning late values",async()=>{
  for(const timeout of [false,true]){
    const abort=new AbortController();let closed=0;
    const cursor=new Cursor<number>(signal=>({next:()=>new Promise<IteratorResult<number>>(resolve=>signal.addEventListener("abort",()=>resolve({done:true,value:undefined}),{once:true})),return:()=>{closed++;return{done:true,value:undefined};}}),{signal:abort.signal,...timeout?{timeoutMs:10}:{}});
    const pending=cursor.fetch(1);
    if(!timeout)setTimeout(()=>abort.abort(new Error("stop")),5);
    await expect(pending).rejects.toThrow(timeout?"timed out":"stop");
    expect(closed).toBe(1);await cursor.close();expect(closed).toBe(1);
  }
});

test("row cursor select/derive/project remain lazy, preserve schema and require bounded materialization",async()=>{
  const rows=[{v:0},{v:2},{v:3}],source=Cursor.from(rows,{columns:["v"]});
  const derived=projectCursor(deriveCursor(selectCursor(source,"v>0"),{a:"v+1",b:"a+1"}),["b"]);
  expect(source.position).toBe(0);
  expect(derived.columns).toEqual(["b"]);
  expect(await derived.fetch(1)).toEqual([{b:4}]);
  expect(source.position).toBe(2);
  await derived.close();expect(rows).toEqual([{v:0},{v:2},{v:3}]);
  const input=Cursor.from([{v:2}],{columns:["v"]});
  expect(()=>selectCursor(input,"missing>0")).toThrow("missing");
  const expression=evaluateExpression("input.derive({a:'v+1'}).project(['a'])",{input}) as Cursor<Record<string,unknown>>;
  expect(await expression.collect(1)).toEqual([{a:3}]);
  expect(()=>evaluateExpression("input.sort('v')",{input})).toThrow("collect");
});

test("cursor cleanup failure is terminal and preserves the triggering error",async()=>{
  let closes=0;
  const cursor=new Cursor<number>({next(){throw new Error("read failed");},return(){closes++;throw new Error("release failed");}});
  await expect(cursor.fetch(1)).rejects.toThrow("read failed; cursor cleanup failed: release failed");
  expect(cursor.state).toBe("error");expect(closes).toBe(1);
  await expect(cursor.close()).rejects.toThrow("release failed");expect(closes).toBe(1);
});
