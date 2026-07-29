import type { CompiledCell, ReportExpressionRuntime, ReportRecord } from "depa-data-report-contract";
import { readField, scopeFor, type ExpansionItem, type ScopeRuntime } from "./scope";

function sourceIds(source: readonly unknown[], dataset: readonly ReportRecord[]): number[] {
  const positions = new Map<unknown, number[]>();
  dataset.forEach((row,id) => { const ids=positions.get(row)??[];ids.push(id);positions.set(row,ids); });
  const used=new Map<unknown,number>();
  return source.map(row => {
    const offset=used.get(row)??0,id=positions.get(row)?.[offset];
    if(id===undefined)throw new Error("Dataset expansion must retain original record identities");
    used.set(row,offset+1);return id;
  });
}
export function expandItems(runtime: ReportExpressionRuntime, context: ScopeRuntime, cell: CompiledCell, parents: readonly ExpansionItem[], foreign: readonly ExpansionItem[], axis:"r"|"c", limit:number): Array<Omit<ExpansionItem,"uid"|"anchor"|"index">> {
  const config=cell.config;
  const scope=scopeFor(context,axis==="r"?parents:foreign,axis==="c"?parents:foreign,cell);
  const dataset=config.ds??(config.expandExpr&&context.input.datasets?.[config.expandExpr]?config.expandExpr:undefined);
  let source:unknown;
  if(config.expandExpr)source=runtime.evaluate(config.expandExpr,scope);
  else if(dataset)source=scope[dataset];
  else if(config.field)source=readField(scope,config.field);
  else source=[cell.value];
  const records=source==null?[]:Array.isArray(source)?source:[source];
  const ids=dataset?sourceIds(records,context.input.datasets?.[dataset]??[]):undefined;
  let items:Array<Omit<ExpansionItem,"uid"|"anchor"|"index">>;
  if(cell.groupField){
    const groups=new Map<unknown,{value:unknown;ids:number[];records:ReportRecord[]}>(),dates=new Map<number,object>();
    records.forEach((record,index)=>{
      const value=readField(record,cell.groupField!);let key=value;
      if(value instanceof Date){const time=value.getTime();key=dates.get(time)??{};dates.set(time,key as object);}
      let group=groups.get(key);if(!group){group={value,ids:[],records:[]};groups.set(key,group);}
      group.records.push(record as ReportRecord);if(ids)group.ids.push(ids[index]);
    });
    items=[...groups.values()].map(group=>({...group,dataset,empty:false,ids:ids?group.ids:undefined}));
  }else items=records.map((value,index)=>({value,dataset,ids:ids?[ids[index]]:undefined,records:value&&typeof value==="object"?[value as ReportRecord]:[],empty:value==null}));
  items=items.slice(0,config.expandMaxCount);
  const min=config.expandMinCount??0;
  if(min>limit||items.length>limit)throw new Error(`Report ${axis==="r"?"row":"column"} limit exceeded`);
  while(items.length<min)items.push({value:undefined,dataset,ids:[],records:[],empty:true});
  if(!items.length&&config.keepExpandEmpty!==false)items.push({value:undefined,dataset,ids:[],records:[],empty:true});
  return items;
}
