import os, json, subprocess, pathlib, datetime, hashlib, sys
out = pathlib.Path(__file__).parent
source = pathlib.Path('/Users/kongweixian/infra-dev/spl-bun')
snapshot = out / 'workspace'
groups = {
    'source-oracles': [('sort-oracle', ['bun','.cdmt-lite/missions/archived/spl-stable-expression-sort/verification/source-oracle.ts'], source), ('parse-oracle', ['bun','.cdmt-lite/missions/active/spl-parse-conversion/verification/source-parse-oracle.ts'], source), ('formatter-oracle', ['bun','.cdmt-lite/missions/archived/spl-text-formatting/verification/formatter-oracle.ts'], source)],
    'focused': [('sort-focused', ['bun','test','packages/expression/__tests__/sort-semantics.test.ts','packages/kon-spl-dsl','packages/spl-flow'], source), ('parse-focused', ['bun','test','packages/expression/__tests__/parse-conversion.test.ts','packages/kon-spl-dsl','packages/spl-flow'], source)],
    'related': [('related', ['bun','test','packages/expression','packages/core','packages/kon-spl-dsl','packages/spl-flow','packages/report-logic'], source)],
    'full-build': [('full', ['bun','test'], snapshot), ('build', ['bun','run','build'], snapshot)],
    'oracles': [('formatter-oracle', ['bun','.cdmt-lite/missions/archived/spl-text-formatting/verification/formatter-oracle.ts'], source), ('compatibility-probes', ['bun','.cdmt-lite/missions/archived/spl-text-formatting/verification/holarchy-round-1/compatibility-probes.ts'], source)],
    'e2e': [('e2e', ['bun','run','test:e2e'], snapshot)],
}
results = []
for name, command, cwd in groups[sys.argv[1]]:
    env = dict(os.environ, TMPDIR=str(out/'tmp')+'/', SPL_E2E_FRONTEND_PORT='4394', SPL_E2E_BACKEND_PORT='4396')
    log = out / (name+'.log')
    start = datetime.datetime.now(datetime.timezone.utc).isoformat()
    print('START', name, start, str(cwd), flush=True)
    with log.open('wb') as stream:
        child = subprocess.run(command, cwd=cwd, env=env, stdout=stream, stderr=subprocess.STDOUT)
    item = dict(name=name, command=command, cwd=str(cwd), start=start, end=datetime.datetime.now(datetime.timezone.utc).isoformat(), exitCode=child.returncode, log=str(log), logSha256=hashlib.sha256(log.read_bytes()).hexdigest())
    results.append(item)
    (out/(sys.argv[1]+'.json')).write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print(json.dumps(item), flush=True)
    print('\n'.join(log.read_text(errors='replace').splitlines()[-12:]), flush=True)
