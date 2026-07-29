import {existsSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const workspace='/Users/kongweixian/infra-dev/spl-bun';
const base='.cdmt-lite/runs/holarchy-0e32cd3d67d631730d42c305c551dfec1614/';
const receiptPrefix=base+'implement-6/',folder=resolve(workspace,receiptPrefix);
const hash=(value:Uint8Array|string)=>createHash('sha256').update(value).digest('hex');
const fileHash=(path:string)=>hash(readFileSync(path));
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const save=(file:string,value:unknown)=>writeFileSync(resolve(folder,file),JSON.stringify(value,null,2)+'\n');
const run=(cmd:string[])=>Bun.spawnSync(cmd,{cwd:workspace});
const git=(args:string[])=>{const child=run(['git',...args]);if(child.exitCode)throw Error(new TextDecoder().decode(child.stderr));return child.stdout;};
const splitPaths=(bytes:Uint8Array)=>new TextDecoder().decode(bytes).split('\0').filter(Boolean);
const baseline=read(resolve(folder,'baseline.json'));
const context=read(resolve(folder,'run-context.json'));
const move=read(resolve(folder,'sort-move.json'));
const from='.cdmt-lite/missions/active/spl-stable-expression-sort/',to='.cdmt-lite/missions/archived/spl-stable-expression-sort/';
const destination=(path:string)=>path.startsWith(from)?to+path.slice(from.length):path;
const excludedReceiptPrefixes=[base+'implement-5/',receiptPrefix,...[1,2,3].map(round=>'.cdmt-lite/missions/archived/spl-text-formatting/verification/holarchy-round-'+round+'/')];
const paths=[...new Set(splitPaths(git(['ls-files','--cached','--others','--exclude-standard','-z'])))].sort();
const entries=paths.filter(path=>existsSync(resolve(workspace,path))).map(path=>[path,fileHash(resolve(workspace,path))] as [string,string]);
const current=new Map(entries),content=entries.filter(([path])=>!excludedReceiptPrefixes.some(prefix=>path.startsWith(prefix)));
const business=entries.filter(([path])=>path.startsWith('packages/')||path.startsWith('scripts/')||!path.includes('/')&&!path.startsWith('.')&&!path.endsWith('.md'));
const businessHash=hash(JSON.stringify(business)),contentHash=hash(JSON.stringify(content));

const missing:string[]=[],changed:string[]=[],movedUnchanged:string[]=[];
for(const [path,sha] of Object.entries(baseline.files)){
 const target=destination(path);
 if(!current.has(target))missing.push(path);
 else if(current.get(target)!==sha)changed.push(target);
 else if(target!==path)movedUnchanged.push(path);
}
const allowedObservedChanges=new Set([
 'packages/expression/src/parse-conversion.ts','packages/expression/__tests__/parse-conversion.test.ts','packages/expression/README.md',
 'packages/kon-spl-dsl/__tests__/parse-parity.test.ts','packages/spl-flow/__tests__/parse-parity.test.ts','packages/web-ide/__tests__/e2e/kon-execution.e2e.ts',
 '.cdmt-lite/README.md','.depa-analysis/spl-compatibility-2026-10-23/manifest.md','.depa-analysis/spl-compatibility-2026-10-23/acceptance-matrix.md',
 ...['MISSION.md','loop.md','evidence.md'].flatMap(file=>[to+file,'.cdmt-lite/missions/active/spl-parse-conversion/'+file]),
 '.cdmt-lite/missions/active/spl-parse-conversion/verification/source-parse-oracle.ts',
]);
const unexpected=changed.filter(path=>!allowedObservedChanges.has(path));
const restoredDeleted=splitPaths(git(['ls-files','--cached','-z'])).filter(path=>!baseline.files[path]&&current.has(destination(path)));
const known=new Set(Object.keys(baseline.files).map(destination));
const added=entries.filter(([path])=>!known.has(path)).map(([path])=>path);
const unexpectedAdded=added.filter(path=>!path.startsWith(receiptPrefix));
const priorFolder=resolve(workspace,base+'implement-5/');
const priorManifest=read(resolve(priorFolder,'evidence-hashes.json'));
const priorReceiptMismatches=priorManifest.files.filter(([file,sha]:[string,string])=>fileHash(resolve(priorFolder,file))!==sha);
const moveMismatches=Object.entries(move.files).filter(([file,sha])=>fileHash(resolve(workspace,to+file))!==sha);
const formattingMove=read(resolve(priorFolder,'formatting-move.json'));
const formattingMismatches=Object.entries(formattingMove.files).filter(([file,sha])=>fileHash(resolve(formattingMove.to,file))!==sha);
if(missing.length||unexpected.length||unexpectedAdded.length||restoredDeleted.length||priorReceiptMismatches.length||moveMismatches.length||formattingMismatches.length)
 throw Error(JSON.stringify({missing,unexpected,unexpectedAdded,restoredDeleted,priorReceiptMismatches,moveMismatches,formattingMismatches}));
save('preservation.json',{baselineRef:receiptPrefix+'baseline.json',sortMoveRef:receiptPrefix+'sort-move.json',
 policy:'Observed changed files are implementation observations, not a Host per-file allowlist. Actual directory authorization and restrictions are in run-context.json.',
 missing,unexpected,unexpectedAdded,restoredDeleted,priorReceiptMismatches,moveMismatches,formattingMismatches,changed,added,movedUnchanged,
 changedFiles:[...changed,...movedUnchanged.map(destination)].map(path=>resolve(workspace,path)),
 priorReceiptFilesVerified:priorManifest.files.length,formattingFilesVerified:Object.keys(formattingMove.files).length,
});

const core=run(['rg','-n','node:fs|Bun\\.file|new Function|eval\\(','packages/report-logic/src']);
if(core.exitCode!==1)throw Error('report core scan did not return no matches');
const codumentDiffHash=hash(git(['diff','--','codument'])),codumentUntrackedHash=hash(git(['ls-files','--others','--exclude-standard','codument']));
if(codumentDiffHash!=='7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049'||codumentUntrackedHash!=='1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e')throw Error('Codument drift');
const diff=run(['git','diff','--check','--',...changed]);if(diff.exitCode)throw Error(new TextDecoder().decode(diff.stdout));
const command=read(context.commandRef),identity=context.identityObservedFromCommand;
if(command.command_id!==identity.command_id||command.generation!==6||command.graph_revision!==7)throw Error('Current command identity drift');

const prefix='bun .cdmt-lite/missions/';
const definitions:[string,string,string][]=[
 ['bun test packages/expression/__tests__/parse-conversion.test.ts packages/kon-spl-dsl/__tests__/parse-parity.test.ts packages/spl-flow/__tests__/parse-parity.test.ts','focused.log','9 pass'],
 ['bun test packages/expression/__tests__/parse-conversion.test.ts packages/kon-spl-dsl packages/spl-flow','parse-focused.log','232 pass'],
 ['bun test packages/expression/__tests__/sort-semantics.test.ts packages/kon-spl-dsl packages/spl-flow','sort-focused.log','231 pass'],
 ['bun test packages/expression packages/core packages/kon-spl-dsl packages/spl-flow packages/report-logic','related.log','432 pass'],
 ['bun test','full.log','479 pass'],['bun run build','build.log','depa-data-web-server build: Exited with code 0'],
 [prefix+'active/spl-parse-conversion/verification/source-parse-oracle.ts','parse-oracle.log','592 actual Java'],
 [prefix+'active/spl-stable-expression-sort/verification/source-oracle.ts','sort-oracle.log','80 actual Java'],
 [prefix+'archived/spl-text-formatting/verification/formatter-oracle.ts','formatter-oracle.log','112 actual Java'],
 ['bun /private/tmp/spl-verify-8ffa399e-cd0f-44ea-8f58-3d1516ec68a8/extended-parse-oracle.ts','review-extended-oracle.log','152 actual Java'],
 ['bun /private/tmp/spl-verify-8ffa399e-cd0f-44ea-8f58-3d1516ec68a8/parse-entry-probes.ts','review-entry-probes.log','"cases":20,"failures":0,"inputUnchanged":true'],
 ['SPL_E2E_FRONTEND_PORT=4394 SPL_E2E_BACKEND_PORT=4396 bun run test:e2e','e2e.log','17 passed (17.9s)'],
];
const checks=definitions.map(([command,log,signal])=>{
 const path=resolve(folder,log),text=readFileSync(path,'utf8');
 if(!text.includes(signal)||/^\s*[1-9]\d* fail$/m.test(text)||/^error:|^Error:/m.test(text))throw Error('Failed verification '+log);
 return {command,exitCode:0,signal,log:path,logSha256:fileHash(path)};
});
if((readFileSync(resolve(folder,'build.log'),'utf8').match(/Exited with code 0/g)??[]).length!==13)throw Error('Expected 13 package builds');
save('business-baseline.json',{scope:'Existing tracked/nonignored packages/**, scripts/** and root non-hidden non-Markdown files.',algorithm:'SHA256 compact UTF-8 JSON sorted [relativePath,contentSHA256] array',sha256:businessHash,files:business});
save('final-worktree.json',{head:new TextDecoder().decode(git(['rev-parse','HEAD'])).trim(),round:4,implementGeneration:6,graphRevision:7,
 contentScope:'Existing tracked and nonignored files; predecessor/current generation receipts and historical formatter round receipts separately hashed.',
 contentAlgorithm:'SHA256(compact UTF-8 JSON sorted [relativePath,contentSHA256] array)',excludedReceiptPrefixes,
 worktreeContentSha256:contentHash,businessSha256:businessHash,statusZSha256:hash(git(['status','--porcelain=v1','-z'])),trackedDiffSha256:hash(git(['diff','HEAD','--binary'])),files:content,
});
save('checks.json',{round:4,implementGeneration:6,graphRevision:7,businessBaselineSha256:businessHash,checks,
 reproducer:{command:definitions[0][0],exitCode:1,expectedExitCode:1,signal:'Before the fix, 6 pass / 3 fail / 79 expects',log:resolve(folder,'before-fix.log'),logSha256:fileHash(resolve(folder,'before-fix.log'))},
 negative:{reportCoreScanCommand:"! rg -n 'node:fs|Bun\\.file|new Function|eval\\(' packages/report-logic/src",rawRgExitCode:core.exitCode,negatedExitCode:0,codumentDiffHash,codumentUntrackedHash,changedTrackedDiffCheckExitCode:diff.exitCode,
  existingGatherEof:{baselineSha256:baseline.files['packages/core/src/gather.ts'],currentSha256:fileHash(resolve(workspace,'packages/core/src/gather.ts')),note:'Existing EOF whitespace retained; not changed in this generation.'}},
 metadata:{actualIdentity:identity,commandSha256:fileHash(context.commandRef),feedback:context.feedback,predecessor:context.predecessor,bunVersion:Bun.version,lockfileSha256:fileHash(resolve(workspace,'bun.lock'))},
 reviewProbeScriptHashes:['extended-parse-oracle.ts','parse-entry-probes.ts'].map(file=>({path:'/private/tmp/spl-verify-8ffa399e-cd0f-44ea-8f58-3d1516ec68a8/'+file,sha256:fileHash('/private/tmp/spl-verify-8ffa399e-cd0f-44ea-8f58-3d1516ec68a8/'+file)})),
 oracleTemporaryDirectoriesRemaining:readdirSync('/private/tmp').filter(name=>/^spl-(sort|parse)-oracle-/.test(name)),
 disposition:'Sort/G5 closure imported from admitted independent Review generation5. Parse/G2 fixes await new independent Verify/Review; no self-approval.',
});
save('evidence-hashes.json',{algorithm:'SHA256 bytes; excludes this self-referential manifest',files:readdirSync(folder).filter(file=>file!=='evidence-hashes.json').map(file=>[file,fileHash(resolve(folder,file))])});
console.log(JSON.stringify({contentHash,businessHash,changed:changed.length,movedUnchanged:movedUnchanged.length,priorReceipts:priorManifest.files.length,checks:checks.length,preservation:'passed'}));
