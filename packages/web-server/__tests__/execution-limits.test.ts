import { describe, expect, test } from "bun:test";
import { createExecutionRuntime, runIsolated } from "../src/execution";

const forever = '(spl_flow :{ cells = [{ row = 1 col = A expr = "goto A1" }] })';
const normal = { kind: "kon" as const, source: '(spl_eval :{ expr = "1+41" })', config: {} };

describe("isolated execution", () => {
  test("terminates a running Kon flow loop, releases its slot, then computes normally", async () => {
    const runtime = createExecutionRuntime(1);
    await expect(runIsolated(runtime, { job: { ...normal, source: forever } }, { timeoutMs: 100 })).rejects.toThrow("timed out");
    expect(runtime.workers.size).toBe(0);
    expect(await runIsolated(runtime, { job: normal })).toEqual({ status: "ok", result: 42 });
  });
  test("cancellation terminates the worker; concurrency capacity is explicit", async () => {
    const runtime = createExecutionRuntime(1);
    const controller = new AbortController();
    const work = runIsolated(runtime, { job: { ...normal, source: forever }, signal: controller.signal });
    await expect(runIsolated(runtime, { job: normal })).rejects.toThrow("capacity");
    controller.abort();
    await expect(work).rejects.toThrow("cancelled");
    expect(runtime.workers.size).toBe(0);
    expect(await runIsolated(runtime, { job: normal })).toMatchObject({ result: 42 });
  });
});

test('worker serializes exact long/decimal query cells as lossless text',async()=>{
 const runtime=createExecutionRuntime(1);
 const job={kind:'kon' as const,source:'(spl_derive :{in=input cols={id="long(id)+1" total="decimal(amount)*3"}})',config:{tables:{input:{columns:['id','amount'],rows:[{id:'9007199254740993',amount:'0.1'}]}}}};
 expect(await runIsolated(runtime,{job})).toMatchObject({status:'ok',data:{rows:[{id:'9007199254740994',total:'0.3'}]}});
 expect(runtime.workers.size).toBe(0);
});
