import type { CellPosition, CellRange, RenderedReport, RenderedSheet } from "depa-data-report-contract";
import { cellAddress, parseAddress, mergeCellRows } from "./coordinates";
export interface ReferenceToken {
    sheet?: string;
    start: string;
    end?: string;
    kind: "cell" | "row" | "col";
}
const referencePattern = /^(?:(?:'((?:[^']|'')+)'|([\p{L}\p{N}_][\p{L}\p{N}_.]*))!)?(\$?[A-Z]{1,3}\$?[1-9]\d*(?::\$?[A-Z]{1,3}\$?[1-9]\d*)?|\$?[A-Z]{1,3}:\$?[A-Z]{1,3}|\$?[1-9]\d*:\$?[1-9]\d*)/iu;
/** A lexical boundary shared by formula copying and document references. Strings
 * and structured/external references are opaque; their digits are never rewritten.
 */
export function mapFormulaReferences(formula: string, map: (ref: ReferenceToken, original: string) => string): string {
    let result = "", index = 0;
    while (index < formula.length) {
        const ch = formula[index];
        if (ch === '"') {
            const start = index++;
            while (index < formula.length) {
                if (formula[index++] !== '"')
                    continue;
                if (formula[index] === '"') {
                    index++;
                    continue;
                }
                break;
            }
            result += formula.slice(start, index);
            continue;
        }
        if (ch === "[") {
            const start = index++;
            let depth = 1;
            while (index < formula.length && depth) {
                if (formula[index] === "[")
                    depth++;
                if (formula[index] === "]")
                    depth--;
                index++;
            }
            // External workbook qualifiers include the subsequent sheet and address.
            const external = /^[\p{L}\p{N}_ .']+!\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?/u.exec(formula.slice(index));
            if (external)
                index += external[0].length;
            result += formula.slice(start, index);
            continue;
        }
        const before = index ? formula[index - 1] : "";
        const match = !/[\p{L}\p{N}_.]/u.test(before) ? referencePattern.exec(formula.slice(index)) : null;
        const after = match ? formula[index + match[0].length] ?? "" : "";
        if (!match || /[\p{L}\p{N}_.(\[]/u.test(after)) {
            result += ch;
            index++;
            continue;
        }
        const [start, end] = match[3].split(":");
        const kind = /\d/.test(start) ? /[A-Z]/i.test(start) ? "cell" : "row" : "col";
        result += map({ sheet: match[1]?.replace(/''/g, "'") ?? match[2], start, end, kind }, match[0]);
        index += match[0].length;
    }
    return result;
}
export function referenceRange(ref: ReferenceToken): CellRange {
    const point = (source: string, end: boolean): CellPosition => {
        const value = source.replace(/\$/g, "");
        if (ref.kind === "row")
            return { row: Number(value) - 1, col: end ? 16383 : 0 };
        if (ref.kind === "col")
            return { col: parseAddress(`${value}1`).col, row: end ? 1048575 : 0 };
        return parseAddress(value);
    };
    return { start: point(ref.start, false), end: point(ref.end ?? ref.start, true) };
}
function contains(range: CellRange, point: CellPosition): boolean {
    return point.row >= range.start.row && point.row <= range.end.row && point.col >= range.start.col && point.col <= range.end.col;
}
function quoteSheet(name: string): string { return `'${name.replace(/'/g, "''")}'!`; }
function formatPoint(point: CellPosition, original: string, kind: ReferenceToken["kind"]): string {
    const address = cellAddress(point);
    const parts = /^([A-Z]+)(\d+)$/.exec(address)!;
    if (kind === "row")
        return `${original.startsWith("$") ? "$" : ""}${parts[2]}`;
    if (kind === "col")
        return `${original.startsWith("$") ? "$" : ""}${parts[1]}`;
    const fixed = /^(\$?)[A-Z]+(\$?)/i.exec(original)!;
    return `${fixed[1]}${parts[1]}${fixed[2]}${parts[2]}`;
}
export function copyFormula(formula: string, origin: CellPosition, output: CellPosition): string {
    return mapFormulaReferences(formula, (ref, original) => {
        const range = referenceRange(ref);
        function shift(point: CellPosition, source: string): string {
            const match = /^(\$?)[A-Z]+(\$?)/i.exec(source);
            const fixedRow = ref.kind === "col" || (ref.kind === "row" ? source.startsWith("$") : !!match?.[2]);
            const fixedCol = ref.kind === "row" || (ref.kind === "col" ? source.startsWith("$") : !!match?.[1]);
            const next = { row: point.row + (fixedRow ? 0 : output.row - origin.row), col: point.col + (fixedCol ? 0 : output.col - origin.col) };
            if (next.row < 0 || next.col < 0 || next.row > 1048575 || next.col > 16383)
                return "#REF!";
            return formatPoint(next, source, ref.kind);
        }
        const start = shift(range.start, ref.start), end = ref.end ? shift(range.end, ref.end) : undefined;
        if (start === "#REF!" || end === "#REF!")
            return "#REF!";
        return `${ref.sheet === undefined ? "" : quoteSheet(ref.sheet)}${start}${end ? `:${end}` : ""}`;
    });
}
export function createReferenceProjection(report: RenderedReport) {
    const origins = new Map(report.sheets.map(sheet => [sheet, new Map(sheet.cells.map(cell => [`${cell.row},${cell.col}`, parseAddress(cell.origin)]))]));
    const bySource = new Map(report.sheets.map(sheet => {
        const index = new Map<string, typeof sheet.cells[number][]>();
        for (const cell of sheet.cells) {
            const cells = index.get(cell.origin) ?? [];
            cells.push(cell);
            index.set(cell.origin, cells);
        }
        return [sheet, index] as const;
    }));
    const merges = new Map(report.sheets.map(sheet => [sheet, new Map(sheet.merges.map(range => [`${range.start.row},${range.start.col}`, range]))]));
    const cache = new Map(report.sheets.map(sheet => [sheet, new Map<string, CellRange[]>()]));
    function sheetFor(source: string, context: RenderedSheet): RenderedSheet | undefined {
        const same = (value: string | undefined) => value?.toLowerCase() === source.toLowerCase();
        const candidates = report.sheets.filter(sheet => same(sheet.sourceSheetId) || same(sheet.sourceSheetName));
        return candidates.find(sheet => sheet.instancePath?.[0] === context.instancePath?.[0] && sheet.instancePath?.[1] === context.instancePath?.[1])
            ?? candidates.find(sheet => sheet.instancePath?.[0] === context.instancePath?.[0]) ?? candidates[0] ?? report.sheets.find(sheet => same(sheet.name));
    }
    function ranges(sheet: RenderedSheet, source: CellRange): CellRange[] {
        const key = `${source.start.row}:${source.start.col}:${source.end.row}:${source.end.col}`, cached = cache.get(sheet)!.get(key);
        if (cached)
            return structuredClone(cached);
        const rows = new Map<number, Set<number>>();
        const add = (row: number, col: number) => { let set = rows.get(row); if (!set) {
            set = new Set();
            rows.set(row, set);
        } set.add(col); };
        const index = origins.get(sheet)!;
        // Slots fill blank/styled regions. Real instance provenance wins when an
        // in-place reservation overwrote a slot with another source cell.
        const single = source.start.row === source.end.row && source.start.col === source.end.col;
        const exact = single ? bySource.get(sheet)!.get(cellAddress(source.start)) : undefined;
        for (let row = 0; !exact && row < sheet.rowCount; row++) {
            if (sheet.rowOrigins[row] < source.start.row || sheet.rowOrigins[row] > source.end.row)
                continue;
            for (let col = 0; col < sheet.colCount; col++) {
                if (sheet.colOrigins[col] < source.start.col || sheet.colOrigins[col] > source.end.col)
                    continue;
                const actual = index.get(`${row},${col}`);
                if (!actual || contains(source, actual))
                    add(row, col);
            }
        }
        for (const cell of exact ?? sheet.cells)
            if (exact || contains(source, parseAddress(cell.origin))) {
                const merge = merges.get(sheet)!.get(`${cell.row},${cell.col}`);
                for (let row = cell.row; row <= (merge?.end.row ?? cell.row); row++)
                    for (let col = cell.col; col <= (merge?.end.col ?? cell.col); col++)
                        add(row, col);
            }
        const result=mergeCellRows(rows);
        cache.get(sheet)!.set(key, result);
        return structuredClone(result);
    }
    function bounds(sheet: RenderedSheet, source: CellRange): CellRange | undefined {
        const selected = ranges(sheet, source);
        if (!selected.length)
            return undefined;
        return { start: { row: Math.min(...selected.map(r => r.start.row)), col: Math.min(...selected.map(r => r.start.col)) },
            end: { row: Math.max(...selected.map(r => r.end.row)), col: Math.max(...selected.map(r => r.end.col)) } };
    }
    function formula(value: string, context: RenderedSheet, origin?: CellPosition, output?: CellPosition): string {
        const base = origin ? bounds(context, { start: origin, end: origin })?.start : undefined;
        return mapFormulaReferences(value, (ref, original) => {
            if (ref.sheet?.includes("["))
                return original;
            const resolved = ref.sheet === undefined ? context : sheetFor(ref.sheet, context);
            if (!resolved)
                return "#REF!";
            const target: RenderedSheet = resolved;
            const source = referenceRange(ref), mapped = bounds(target, source);
            // References beyond the used range still denote legal blank Excel cells.
            if (!mapped) {
                const dimension = (axis: "row" | "col") => axis === "row" ? target.sourceRowCount ?? Math.max(-1, ...target.rowOrigins) + 1 : target.sourceColCount ?? Math.max(-1, ...target.colOrigins) + 1;
                if (source.start.row < dimension("row") && source.start.col < dimension("col"))
                    return "#REF!";
            }
            function point(end: boolean): CellPosition {
                const initial = end ? source.end : source.start;
                function fallbackAxis(values: readonly number[], value: number, extent: number): number {
                    const mapped = (end ? values.lastIndexOf(value) : values.indexOf(value));
                    return mapped >= 0 ? mapped : value >= extent ? value + values.length - extent : -1;
                }
                const fallback = { row: fallbackAxis(target.rowOrigins, initial.row, target.sourceRowCount ?? Math.max(-1, ...target.rowOrigins) + 1), col: fallbackAxis(target.colOrigins, initial.col, target.sourceColCount ?? Math.max(-1, ...target.colOrigins) + 1) };
                const next = { ...(mapped ? end ? mapped.end : mapped.start : fallback) };
                if (origin && output && base) {
                    const raw = end ? ref.end ?? ref.start : ref.start;
                    const fixed = /^(\$?)[A-Z]+(\$?)/i.exec(raw);
                    const fixedRow = ref.kind === "col" || (ref.kind === "row" ? raw.startsWith("$") : !!fixed?.[2]);
                    const fixedCol = ref.kind === "row" || (ref.kind === "col" ? raw.startsWith("$") : !!fixed?.[1]);
                    if (!fixedRow)
                        next.row = target === context && initial.row === origin.row ? output.row : next.row + output.row - base.row;
                    if (!fixedCol)
                        next.col = target === context && initial.col === origin.col ? output.col : next.col + output.col - base.col;
                }
                return next;
            }
            const start = point(false), end = ref.end ? point(true) : undefined;
            if (start.row < 0 || start.col < 0 || (end && (end.row < 0 || end.col < 0)))
                return "#REF!";
            return `${ref.sheet === undefined ? "" : quoteSheet(target.name)}${formatPoint(start, ref.start, ref.kind)}${end ? `:${formatPoint(end, ref.end!, ref.kind)}` : ""}`;
        });
    }
    return { sheetFor, ranges, bounds, formula };
}
export type ReferenceProjection = ReturnType<typeof createReferenceProjection>;
