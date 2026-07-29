import {existsSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const workspace='/Users/kongweixian/infra-dev/spl-bun';
const relative='.cdmt-lite/runs/holarchy-0e32cd3d67d631730d42c305c551dfec1614/implement-5/';
const folder=resolve(workspace,relative);
const hash=(value:Uint8Array|string)=>createHash('sha256').update(value).digest('hex');
const fileHash=(path:string)=>hash(readFileSync(path));
const save=(file:string,value:unknown)=>writeFileSync(resolve(folder,file),JSON.stringify(value,null,2)+'\n');
const run=(cmd:string[])=>Bun.spawnSync(cmd,{cwd:workspace});
const git=(args:string[])=>{const child=run(['git',...args]);if(child.exitCode)throw Error(new TextDecoder().decode(child.stderr));return child.stdout;};
const baseline=JSON.parse(readFileSync(resolve(folder,'baseline.json'),'utf8'));
const previous=JSON.parse(readFileSync(resolve(folder,'formatting-move.json'),'utf8'));
const from='.cdmt-lite/missions/active/spl-text-formatting/',to='.cdmt-lite/missions/archived/spl-text-formatting/';
const receiptPrefixes=[relative,...[1,2,3].map(round=>to+'verification/holarchy-round-'+round+'/')];
const trackedAndUntracked=[...new Set(new TextDecoder().decode(git(['ls-files','--cached','--others','--exclude-standard','-z'])).split('\0').filter(Boolean))].sort();
const entries=trackedAndUntracked.filter(path=>existsSync(resolve(workspace,path))).map(path=>[path,fileHash(resolve(workspace,path))] as [string,string]);
const current=new Map(entries);
const content=entries.filter(([path])=>!receiptPrefixes.some(prefix=>path.startsWith(prefix)));
const business=entries.filter(([path])=>path.startsWith('packages/')||path.startsWith('scripts/')||!path.includes('/')&&!path.startsWith('.')&&!path.endsWith('.md'));
const contentHash=hash(JSON.stringify(content)),businessHash=hash(JSON.stringify(business));
const changedExisting:string[]=[],missingExisting:string[]=[],movedUnchanged:string[]=[];
for(const [path,sha] of Object.entries(baseline.files)) {
 const destination=path.startsWith(from)?to+path.slice(from.length):path;
 if(!current.has(destination))missingExisting.push(path);
 else if(current.get(destination)!==sha)changedExisting.push(destination);
 else if(path!==destination)movedUnchanged.push(path);
}
const baselineDestinations=new Set(Object.keys(baseline.files).map(path=>path.startsWith(from)?to+path.slice(from.length):path));
const added=entries.filter(([path])=>!baselineDestinations.has(path)).map(([path])=>path);
const historicalReceiptMismatches=Object.entries(previous.files).filter(([file,sha])=>file.startsWith('verification/holarchy-round-')&&fileHash(resolve(workspace,to+file))!==sha).map(([file])=>file);
const expectedExistingChanges=new Set([
 ...['ast.ts','parser.ts','binding.ts','evaluator.ts','memberRegistry.ts','functions.ts','index.ts'].map(file=>'packages/expression/src/'+file),
 'packages/expression/README.md','packages/kon-spl-dsl/src/words/sort.ts','packages/web-ide/__tests__/e2e/kon-execution.e2e.ts',
 '.cdmt-lite/README.md','.depa-analysis/spl-compatibility-2026-10-23/manifest.md','.depa-analysis/spl-compatibility-2026-10-23/acceptance-matrix.md',
 ...['MISSION.md','loop.md','evidence.md'].map(file=>to+file),
]);
const unexpectedChanges=changedExisting.filter(path=>!expectedExistingChanges.has(path));
if(missingExisting.length||historicalReceiptMismatches.length||unexpectedChanges.length)throw Error(JSON.stringify({missingExisting,historicalReceiptMismatches,unexpectedChanges}));
save('preservation.json',{baselineRef:relative+'baseline.json',formattingMoveRef:relative+'formatting-move.json',
 note:'Observed changes are not a Host per-file allowlist. Directory policy is in run-context.json. Existing deleted files remain absent; all non-declared existing contents and historical receipts retained.',
 missingExisting,unexpectedChanges,historicalReceiptMismatches,changedExisting,added,movedUnchanged,
 changedFiles:[...changedExisting,...added.filter(path=>!path.startsWith(relative))].map(path=>resolve(workspace,path)),
});
const core=run(['rg','-n','node:fs|Bun\\.file|new Function|eval\\(','packages/report-logic/src']);
if(core.exitCode!==1)throw Error('report IO/eval scan failed: '+new TextDecoder().decode(core.stdout));
const codumentDiffHash=hash(git(['diff','--','codument'])),codumentUntrackedHash=hash(git(['ls-files','--others','--exclude-standard','codument']));
if(codumentDiffHash!=='7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049'||codumentUntrackedHash!=='1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e')throw Error('Codument baseline drift');
const context=JSON.parse(readFileSync(resolve(folder,'run-context.json'),'utf8'));
const command=JSON.parse(readFileSync(context.commandRef,'utf8'));
save('final-worktree.json',{head:new TextDecoder().decode(git(['rev-parse','HEAD'])).trim(),round:3,
 contentAlgorithm:'SHA256(compact UTF-8 JSON sorted [relativePath,contentSHA256] array)',
 contentScope:'Existing tracked and nonignored untracked files; historical formatting round receipts and current implement-5 receipts excluded from content fingerprint, recorded separately.',
 excludedReceiptPrefixes:receiptPrefixes,worktreeContentSha256:contentHash,businessSha256:businessHash,
 statusZSha256:hash(git(['status','--porcelain=v1','-z'])),trackedDiffSha256:hash(git(['diff','HEAD','--binary'])),files:content,
});
save('business-baseline.json',{scope:'All existing tracked/nonignored packages/**, scripts/** and root non-hidden non-Markdown files.',algorithm:'SHA256 compact UTF-8 JSON sorted [relativePath,contentSHA256] array',sha256:businessHash,files:business});
const validations=[
 {command:'bun test packages/expression/__tests__/sort-semantics.test.ts packages/kon-spl-dsl packages/spl-flow',log:'sort-focused.log',signal:'229 pass / 626 expects / 39 files'},
 {command:'bun test packages/expression/__tests__/parse-conversion.test.ts packages/kon-spl-dsl packages/spl-flow',log:'parse-focused.log',signal:'229 pass / 656 expects / 39 files'},
 {command:'bun test packages/expression packages/core packages/kon-spl-dsl packages/spl-flow packages/report-logic',log:'related.log',signal:'429 pass / 1538 expects / 74 files'},
 {command:'bun test',log:'full.log',signal:'476 pass / 1846 expects / 89 files'},
 {command:'bun run build',log:'build.log',signal:'13 packages exit0'},
 {command:'bun .cdmt-lite/missions/active/spl-stable-expression-sort/verification/source-oracle.ts',log:'sort-oracle.log',signal:'80 actual Java source sort cases matched'},
 {command:'bun .cdmt-lite/missions/active/spl-parse-conversion/verification/source-parse-oracle.ts',log:'parse-oracle.log',signal:'504 actual Java Parse cases matched'},
 {command:'bun .cdmt-lite/missions/archived/spl-text-formatting/verification/formatter-oracle.ts',log:'formatter-oracle.log',signal:'112 actual Java/ICU comparisons passed'},
 {command:'SPL_E2E_FRONTEND_PORT=4394 SPL_E2E_BACKEND_PORT=4396 bun run test:e2e',log:'e2e.log',signal:'17 passed (18.8s), exact parse/numeric prefix/descending browser assertions'},
];
const changedTrackedDiff=run(['git','diff','--check','--',...changedExisting]);
if(changedTrackedDiff.exitCode)throw Error(new TextDecoder().decode(changedTrackedDiff.stdout));
// Exit codes below are the completed command receipts from this generation.
// Oracle logs contain success only after all comparisons and compilation pass.
for(const check of validations){const log=readFileSync(resolve(folder,check.log),'utf8');if(/(^|\n)error:|(^|\n)Error:|[1-9][0-9]* fail\n/.test(log))throw Error('Failed log '+check.log);}
save('checks.json',{round:3,implementGeneration:5,graphRevision:6,businessBaselineSha256:businessHash,
 checks:validations.map(check=>({...check,exitCode:0,log:resolve(folder,check.log),logSha256:fileHash(resolve(folder,check.log))})),
 negative:{reportCoreScanCommand:"! rg -n 'node:fs|Bun\\.file|new Function|eval\\(' packages/report-logic/src",reportCoreScanExitCode:0,rawRgExitCode:core.exitCode,codumentDiffHash,codumentUntrackedHash,changedTrackedDiffCheckExitCode:changedTrackedDiff.exitCode,
  globalDiffCheck:{exitCode:2,preexistingWarning:'packages/core/src/gather.ts:219: new blank line at EOF',baselineFileSha256:baseline.files['packages/core/src/gather.ts'],currentFileSha256:fileHash(resolve(workspace,'packages/core/src/gather.ts')),note:'Existing dirty content retained; current generation did not edit this file.'}},
 environment:{bunVersion:Bun.version,lockfileSha256:fileHash(resolve(workspace,'bun.lock')),commandFileSha256:fileHash(context.commandRef),actualCommandIdentity:context.identityObservedFromCommand,commandIdentityStillPresent:JSON.stringify(command).includes(context.identityObservedFromCommand.command_id)},
 oracleTemporaryDirectoriesRemaining:readdirSync('/private/tmp').filter(name=>/^spl-(sort|parse)-oracle-/.test(name)),
 independentReview:'Pending for new sort/parse missions. Formatting closure used admitted gap-review generation3. No self-approval or native approvals performed.',
});
const receipts=readdirSync(folder).filter(file=>file!=='evidence-hashes.json').map(file=>[file,fileHash(resolve(folder,file))]);
save('evidence-hashes.json',{algorithm:'SHA256 bytes; excludes this self-referential manifest',files:receipts});
console.log(JSON.stringify({contentHash,businessHash,changedExisting:changedExisting.length,added:added.length,movedUnchanged:movedUnchanged.length,preservation:'passed',checks:validations.length}));
