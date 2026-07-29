import type { RenderedReport, ReportConfig, CellRange } from "depa-data-report-contract";
import type { FormulaInstance } from "./formula-evaluation";
/** Visibility and physical deletion are separate. Geometry is projected again
 * after deletion; the caller then recalculates references over retained instances.
 */
export function applyVisibility(report: RenderedReport, instances: FormulaInstance[], config: ReportConfig | undefined): boolean {
    let changed = false;
    const retained = new Set<FormulaInstance>();
    for (const sheet of report.sheets) {
        const own = instances.filter(instance => instance.sheet === sheet), removeRows = new Set<number>(), removeCols = new Set<number>();
        const hiddenRows: Record<number, boolean> = { ...sheet.hiddenRows }, hiddenCols: Record<number, boolean> = { ...sheet.hiddenCols };
        const rowFlags = new Map<number, boolean>(), colFlags = new Map<number, boolean>();
        const mergeByStart = new Map(sheet.merges.map(merge => [`${merge.start.row},${merge.start.col}`, merge]));
        for (const instance of own) {
            const cell = instance.cell, merge = mergeByStart.get(`${cell.row},${cell.col}`);
            for (let row = cell.row; row <= (merge?.end.row ?? cell.row); row++) {
                if (cell.removeRow)
                    removeRows.add(row);
                if (cell.rowVisible !== undefined)
                    rowFlags.set(row, (rowFlags.get(row) ?? true) && cell.rowVisible);
            }
            for (let col = cell.col; col <= (merge?.end.col ?? cell.col); col++) {
                if (cell.removeCol)
                    removeCols.add(col);
                if (cell.colVisible !== undefined)
                    colFlags.set(col, (colFlags.get(col) ?? true) && cell.colVisible);
            }
        }
        for (const [row, visible] of rowFlags)
            hiddenRows[row] = !visible;
        for (const [col, visible] of colFlags)
            hiddenCols[col] = !visible;
        if (config?.removeHiddenCell) {
            for (const [key, value] of Object.entries(hiddenRows))
                if (value)
                    removeRows.add(Number(key));
            for (const [key, value] of Object.entries(hiddenCols))
                if (value)
                    removeCols.add(Number(key));
        }
        if (!removeRows.size && !removeCols.size) {
            sheet.hiddenRows = Object.fromEntries(Object.entries(hiddenRows).filter(([, hidden]) => hidden));
            sheet.hiddenCols = Object.fromEntries(Object.entries(hiddenCols).filter(([, hidden]) => hidden));
            for (const instance of own)
                retained.add(instance);
            continue;
        }
        const rows = sheet.rowOrigins.map((origin, index) => ({ origin, index })).filter(({ index }) => !removeRows.has(index));
        const cols = sheet.colOrigins.map((origin, index) => ({ origin, index })).filter(({ index }) => !removeCols.has(index));
        const rr = new Map(rows.map(({ index }, next) => [index, next])), cc = new Map(cols.map(({ index }, next) => [index, next]));
        const mapRange = (merge: CellRange): CellRange | undefined => {
            let r0: number | undefined, r1: number | undefined, c0: number | undefined, c1: number | undefined;
            for (let row = merge.start.row; row <= merge.end.row; row++)
                if (rr.has(row)) {
                    r0 ??= rr.get(row);
                    r1 = rr.get(row);
                }
            for (let col = merge.start.col; col <= merge.end.col; col++)
                if (cc.has(col)) {
                    c0 ??= cc.get(col);
                    c1 = cc.get(col);
                }
            if (r0 === undefined || r1 === undefined || c0 === undefined || c1 === undefined)
                return undefined;
            return { start: { row: r0, col: c0 }, end: { row: r1, col: c1 } };
        };
        for (const instance of own) {
            const cell = instance.cell, merge = mergeByStart.get(`${cell.row},${cell.col}`);
            const mapped = mapRange(merge ?? { start: { row: cell.row, col: cell.col }, end: { row: cell.row, col: cell.col } });
            if (!mapped)
                continue;
            cell.row = mapped.start.row;
            cell.col = mapped.start.col;
            retained.add(instance);
        }
        function remapEntries<T>(source:Readonly<Record<number,T>>|undefined,map:Map<number,number>):Record<number,T>{
            return Object.fromEntries(Object.entries(source??{}).flatMap(([key,value])=>map.has(Number(key))?[[map.get(Number(key))!,value]]:[]));
        }
        const remapHidden = (source: Readonly<Record<number, boolean>>, map: Map<number, number>) => Object.fromEntries(Object.entries(source).flatMap(([key, value]) => value && map.has(Number(key)) ? [[map.get(Number(key))!, true]] : []));
        sheet.hiddenRows = remapHidden(hiddenRows, rr);
        sheet.hiddenCols = remapHidden(hiddenCols, cc);
        if (removeRows.size || removeCols.size) {
            changed = true;
            sheet.merges = sheet.merges.flatMap(merge => { const mapped = mapRange(merge); return mapped ? [mapped] : []; });
            sheet.rowOrigins = rows.map(({ origin }) => origin);
            sheet.colOrigins = cols.map(({ origin }) => origin);
            sheet.rowCount = rows.length;
            sheet.colCount = cols.length;
            sheet.rowHeights = remapEntries(sheet.rowHeights, rr);
            sheet.colWidths = remapEntries(sheet.colWidths, cc);
            sheet.rowStyles=remapEntries(sheet.rowStyles,rr);
            sheet.colStyles=remapEntries(sheet.colStyles,cc);
        }
        sheet.cells = own.filter(instance => retained.has(instance)).map(instance => instance.cell).sort((a, b) => a.row - b.row || a.col - b.col);
    }
    for (let i = instances.length - 1; i >= 0; i--)
        if (!retained.has(instances[i]))
            instances.splice(i, 1);
    return changed;
}
