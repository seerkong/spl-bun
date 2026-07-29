import pathlib,json,subprocess,hashlib,datetime,time,os,signal
base=pathlib.Path('/private/tmp/spl-parse-closeout-20261024');work=base/'workspace';logs=base/'fresh-checks';logs.mkdir(exist_ok=True)
checks=[
 ('parse-focused',['bun','test','packages/expression/__tests__/parse-conversion.test.ts','packages/kon-spl-dsl','packages/spl-flow'],{},'232 pass',120),
 ('parse-oracle',['bun','.cdmt-lite/missions/active/spl-parse-conversion/verification/source-parse-oracle.ts'],{},'592 actual Java',120),
 ('full',['bun','test'],{},'479 pass',120),
 ('build',['bun','run','build'],{},'depa-data-web-server build: Exited with code 0',300),
 ('e2e',['bun','run','test:e2e'],{'SPL_E2E_FRONTEND_PORT':'4394','SPL_E2E_BACKEND_PORT':'4396'},'17 passed',180),
]
receipts=[]
for name,cmd,env,expected,timeout in checks:
    p=logs/(name+'.log');assert not p.exists(),str(p)
    start=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.monotonic()
    with p.open('wb') as f:
        child=subprocess.Popen(cmd,cwd=work,env={**os.environ,**env},stdout=f,stderr=subprocess.STDOUT,start_new_session=True)
        try:code=child.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid,signal.SIGTERM)
            try:child.wait(timeout=5)
            except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);child.wait()
            code=124
    data=p.read_bytes();receipt={'name':name,'command':cmd,'env':env,'cwd':str(work),'startedAt':start,'elapsedSeconds':round(time.monotonic()-t,3),'exitCode':code,'expectedSignal':expected,'signalPresent':expected in data.decode(errors='replace'),'log':str(p),'sha256':hashlib.sha256(data).hexdigest()};receipts.append(receipt)
    (logs/'checks.json').write_text(json.dumps(receipts,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(receipt,ensure_ascii=False),flush=True)
    if code!=0 or not receipt['signalPresent']:raise SystemExit('Check failed: '+name+'; original log preserved')
print('All parse mission acceptance commands passed without workflow dispatch.',flush=True)
