import type { CellPosition, CellRange } from "depa-data-report-contract";

export function cellAddress({ row, col }: CellPosition): string {
  let name = "";
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + (n - 1) % 26) + name;
  }
  return `${name}${row + 1}`;
}

export function parseAddress(value: string): CellPosition {
  const match = /^([A-Z]+)([1-9]\d*)$/i.exec(value);
  if (!match) throw new Error(`Invalid cell address: ${value}`);
  let col = 0;
  for (const ch of match[1].toUpperCase()) col = col * 26 + ch.charCodeAt(0) - 64;
  const row = Number(match[2]) - 1;
  if (col > 16384 || row >= 1048576) throw new Error(`Cell outside Excel limits: ${value}`);
  return { row, col: col - 1 };
}

export function rangeAddress(range: CellRange): string {
  return `${cellAddress(range.start)}:${cellAddress(range.end)}`;
}

/** Rectangular cover of physical points, shared by cell sets and references. */
export function mergeCellRows(rows:ReadonlyMap<number,ReadonlySet<number>>):CellRange[]{
  const result:CellRange[]=[],previous=new Map<string,CellRange>();
  for(const [row,values]of [...rows].sort(([a],[b])=>a-b)){
    const cols=[...values].sort((a,b)=>a-b);
    for(let index=0;index<cols.length;){
      const start=cols[index];let end=start;
      while(++index<cols.length&&cols[index]===end+1)end=cols[index];
      const key=`${start}:${end}`,above=previous.get(key);
      if(above&&above.end.row===row-1)above.end.row=row;
      else{const range={start:{row,col:start},end:{row,col:end}};result.push(range);previous.set(key,range);}
    }
  }
  return result;
}
export function mergeCellPositions(positions:Iterable<CellPosition>):CellRange[]{
  const rows=new Map<number,Set<number>>();
  for(const point of positions){const cols=rows.get(point.row)??new Set<number>();cols.add(point.col);rows.set(point.row,cols);}
  return mergeCellRows(rows);
}
