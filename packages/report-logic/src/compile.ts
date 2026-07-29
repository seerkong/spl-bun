import type { CellConfig, CompiledCell, CompiledReport, ReportTemplate, ExpansionBand, TemplateSheet, } from "depa-data-report-contract";
import { cellAddress, parseAddress } from "./coordinates";
const stringKeys = new Set(["expandExpr", "valueExpr", "formulaExpr", "ds", "field", "rowParent", "colParent", "rowTestExpr", "colTestExpr", "visibleExpr", "styleIdExpr", "formatExpr", "processExpr", "linkExpr", "dict", "imageExpr", "barcodeFormat"]);
const countKeys = new Set(["expandMinCount", "expandMaxCount", "expandInplaceCount", "barcodeWidth", "barcodeHeight"]);
const booleanKeys = new Set(["keepExpandEmpty", "rowExtendForSibling", "colExtendForSibling", "exportFormattedValue", "exportFormula"]);
export function parseReportProperties(annotation: string | undefined, location: string): Record<string, string> {
    const result: Record<string, string> = {};
    if (!annotation || !annotation.includes("="))
        return result;
    const lines = annotation.split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index].trim();
        if (!line)
            continue;
        const entry = /^([\w:]+)\s*=\s*(.*?)\s*$/.exec(line);
        if (!entry)
            throw new Error(`${location}: unsupported multiline annotation: ${line}`);
        const [, key] = entry;
        let raw = entry[2];
        const delimiter = raw.startsWith('"""') ? '"""' : raw.startsWith("`") ? "`" : undefined;
        if (delimiter) {
            let collected = raw.slice(delimiter.length);
            while (!collected.endsWith(delimiter)) {
                if (++index >= lines.length)
                    throw new Error(`${location}: unterminated ${key} multiline value`);
                collected += `\n${lines[index]}`;
            }
            raw = collected.slice(0, -delimiter.length).trim();
        }
        if (Object.prototype.hasOwnProperty.call(result, key))
            throw new Error(`${location}: duplicate annotation ${key}`);
        result[key] = raw;
    }
    return result;
}
function readConfig(annotation: string | undefined, location: string): CellConfig {
    const result: Record<string, unknown> = {};
    const barcodeOptions: Record<string, unknown> = {};
    for (const [original, value] of Object.entries(parseReportProperties(annotation, location))) {
        let key = original;
        if (key.startsWith("qr:")) {
            const name = key.slice(3), mapped: Record<string, string> = { format: "barcodeFormat", barcodeFormat: "barcodeFormat", width: "barcodeWidth", height: "barcodeHeight" };
            if (mapped[name])
                key = mapped[name];
            else {
                barcodeOptions[name] = value;
                continue;
            }
        }
        if (Object.prototype.hasOwnProperty.call(result, key))
            throw new Error(`${location}: conflicting annotation ${original}`);
        if (stringKeys.has(key))
            result[key] = value;
        else if (key === "formulaMode" && (value === "excel" || value === "report"))
            result[key] = value;
        else if (key === "expandType" && (value === "r" || value === "c"))
            result[key] = value;
        else if (booleanKeys.has(key) && /^(true|false)$/.test(value))
            result[key] = value === "true";
        else if (countKeys.has(key) && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)))
            result[key] = Number(value);
        else
            throw new Error(`${location}: unsupported report annotation ${key}=${value}`);
    }
    if (Object.keys(barcodeOptions).length)
        result.barcodeOptions = barcodeOptions;
    return result as CellConfig;
}
type Axis = "r" | "c";
type ParentMap = Map<string, string | undefined>;
function coordinate(cell: {
    row: number;
    col: number;
}, axis: Axis): number {
    return axis === "r" ? cell.row : cell.col;
}
function validateGraph(cells: readonly CompiledCell[], rows: ParentMap, cols: ParentMap, name: string): void {
    const state = new Map<string, number>();
    function visit(address: string, depth: number): void {
        if (depth > 256)
            throw new Error(`${name}!${address}: parent dependency exceeds 256 levels`);
        if (state.get(address) === 1)
            throw new Error(`${name}!${address}: cyclic row/column parent dependency`);
        if (state.get(address) === 2)
            return;
        state.set(address, 1);
        for (const parent of [rows.get(address), cols.get(address)])
            if (parent)
                visit(parent, depth + 1);
        state.set(address, 2);
    }
    for (const cell of cells)
        visit(cell.address, 0);
}
function setChains(cells: CompiledCell[], parents: ParentMap, axis: Axis): void {
    const byAddress = new Map(cells.map((c) => [c.address, c]));
    for (const cell of cells) {
        const chain: string[] = [];
        let current: CompiledCell | undefined = cell;
        while (current) {
            if (current.config.expandType === axis)
                chain.push(current.address);
            const parent = parents.get(current.address);
            current = parent ? byAddress.get(parent) : undefined;
        }
        if (axis === "r")
            cell.rowChain = chain.reverse();
        else
            cell.colChain = chain.reverse();
    }
}
function bandsFor(cells: readonly CompiledCell[], sheet: TemplateSheet, axis: Axis): ExpansionBand[] {
    const bands = new Map<string, ExpansionBand & {
        children: ExpansionBand[];
    }>();
    const merges = new Map(sheet.merges.map((merge) => [cellAddress(merge.start), merge]));
    for (const cell of cells)
        if (cell.config.expandType === axis) {
            bands.set(cell.address, { anchor: cell.address, start: coordinate(cell, axis), end: coordinate(cell, axis), children: [] });
        }
    for (const cell of cells) {
        const chain = axis === "r" ? cell.rowChain : cell.colChain;
        const merge = merges.get(cell.address);
        const start = coordinate(cell, axis);
        const end = merge ? coordinate(merge.end, axis) : start;
        for (const address of chain) {
            const band = bands.get(address)!;
            band.start = Math.min(band.start, start);
            band.end = Math.max(band.end, end);
        }
    }
    const roots: ExpansionBand[] = [];
    for (const cell of cells) {
        const band = bands.get(cell.address);
        if (!band)
            continue;
        const chain = axis === "r" ? cell.rowChain : cell.colChain;
        const parent = chain.length > 1 ? bands.get(chain[chain.length - 2]) : undefined;
        if (parent)
            parent.children.push(band);
        else
            roots.push(band);
    }
    function sortAndValidate(siblings: readonly ExpansionBand[]): void {
        const sorted = [...siblings].sort((a, b) => a.start - b.start);
        for (let i = 0; i < sorted.length; i++) {
            sortAndValidate(sorted[i].children);
        }
        (siblings as ExpansionBand[]).sort((a, b) => a.start - b.start);
    }
    sortAndValidate(roots);
    return roots;
}
function compileSheet(sheet: TemplateSheet) {
    for (const [key, value, max] of [["rows", sheet.rowCount, 1048576], ["columns", sheet.colCount, 16384]] as const) {
        if (!Number.isSafeInteger(value) || value < 0 || value > max)
            throw new Error(`${sheet.name}: invalid template ${key}`);
    }
    const sourceCells = [...sheet.cells];
    for (const image of sheet.images ?? []) {
        const point = image.anchor.from, merge = sheet.merges.find(range => point.row >= range.start.row && point.row <= range.end.row && point.col >= range.start.col && point.col <= range.end.col), origin = merge?.start ?? point;
        if (!sourceCells.some(cell => cell.row === origin.row && cell.col === origin.col))
            sourceCells.push({ row: origin.row, col: origin.col });
    }
    const cells: CompiledCell[] = sourceCells.map((cell) => {
        if (!Number.isInteger(cell.row) || !Number.isInteger(cell.col) || cell.row < 0 || cell.col < 0 || cell.row >= sheet.rowCount || cell.col >= sheet.colCount)
            throw new Error(`${sheet.name}: cell outside template dimensions`);
        const address = cellAddress(cell);
        const location = `${sheet.name}!${address}`;
        const config = { ...readConfig(cell.annotation, location) };
        const value = cell.value;
        if (config.formulaExpr && config.valueExpr)
            throw new Error(`${location}: formulaExpr conflicts with valueExpr`);
        let expression = config.formulaExpr ?? config.valueExpr ?? (typeof value === "string" && value.startsWith("*=") ? value.slice(2).trim() : undefined);
        let groupField: string | undefined;
        let groupShorthand = false;
        let fieldBinding: CompiledCell["fieldBinding"];
        if (typeof value === "string" && /^\*=[\^>]/.test(value)) {
            const match = /^\*=([\^>])(?:([^!@]+)!)?([^@]+?)(?:@(.+))?$/.exec(value);
            if (!match)
                throw new Error(`${location}: invalid expansion shorthand`);
            const axis = match[1] === "^" ? "r" : "c";
            if (config.expandType && config.expandType !== axis)
                throw new Error(`${location}: conflicting expansion direction`);
            config.expandType = axis;
            groupShorthand = true;
            config.ds ??= match[2]?.trim();
            config.field ??= match[3].trim();
            config.expandExpr ??= match[4]?.trim();
            expression = config.valueExpr;
        }
        else if (expression && /^([\p{L}_][\p{L}\p{N}_]*)!(.+)$/u.test(expression) && !config.valueExpr) {
            const separator = expression.indexOf("!");
            fieldBinding = { dataset: expression.slice(0, separator), path: expression.slice(separator + 1) };
            expression = undefined;
        }
        if (config.expandType && config.field && (groupShorthand || config.ds && !config.expandExpr))
            groupField = config.field;
        else if (!config.expandType && config.field)
            fieldBinding = { dataset: config.ds, path: config.field };
        if (cell.formula && (expression !== undefined || fieldBinding))
            throw new Error(`${location}: Excel formula conflicts with report expression`);
        if ((config.expandMinCount ?? 0) > (config.expandMaxCount ?? Infinity))
            throw new Error(`${location}: expandMinCount exceeds expandMaxCount`);
        return { ...cell, formulaMode: config.formulaMode ?? cell.formulaMode, address, config, expression, groupField, fieldBinding, rowChain: [], colChain: [],
            textTemplate: typeof value === "string" && value.includes("${") && expression === undefined && !groupField ? value : undefined };
    });
    const byAddress = new Map(cells.map((cell) => [cell.address, cell]));
    if (byAddress.size !== cells.length)
        throw new Error(`${sheet.name}: duplicate template cell`);
    const rows: ParentMap = new Map(), cols: ParentMap = new Map();
    const defaults: {
        r: ParentMap;
        c: ParentMap;
    } = { r: new Map(), c: new Map() };
    for (const axis of ["r", "c"] as const) {
        const key = axis === "r" ? "rowParent" : "colParent";
        const lines = new Map<number, Array<{
            cell?: CompiledCell;
            model: CompiledCell;
            position: number;
        }>>();
        for (const cell of cells) {
            const merge = sheet.merges.find(m => cell.row >= m.start.row && cell.row <= m.end.row && cell.col >= m.start.col && cell.col <= m.end.col);
            const model = merge ? byAddress.get(cellAddress(merge.start)) ?? cell : cell;
            const index = axis === "r" ? cell.row : cell.col, list = lines.get(index) ?? [];
            list.push({ cell, model, position: axis === "r" ? cell.col : cell.row });
            lines.set(index, list);
        }
        for (const merge of sheet.merges) {
            const model = byAddress.get(cellAddress(merge.start));
            if (!model)
                continue;
            for (const [line, entries] of lines) {
                const start = axis === "r" ? merge.start.row : merge.start.col, end = axis === "r" ? merge.end.row : merge.end.col;
                if (line >= start && line <= end)
                    entries.push({ model, position: axis === "r" ? merge.end.col : merge.end.row });
            }
        }
        for (const line of lines.values()) {
            line.sort((a, b) => a.position - b.position);
            let previous: string | undefined;
            for (const entry of line) {
                if (entry.cell)
                    defaults[axis].set(entry.cell.address, previous);
                if (entry.model.config.expandType === axis)
                    previous = entry.model.address;
                else if (entry.model.config[key] !== undefined)
                    previous = entry.model.config[key];
            }
        }
    }
    for (const cell of cells) {
        for (const axis of ["r", "c"] as const) {
            const key = axis === "r" ? "rowParent" : "colParent";
            const explicit = cell.config[key];
            let parent: string | undefined;
            if (explicit && explicit !== "A0") {
                const pos = parseAddress(explicit);
                const merge = sheet.merges.find((m) => pos.row >= m.start.row && pos.row <= m.end.row && pos.col >= m.start.col && pos.col <= m.end.col);
                parent = cellAddress(merge?.start ?? pos);
                if (!byAddress.has(parent))
                    throw new Error(`${sheet.name}!${cell.address}: missing ${key} ${explicit}`);
            }
            else if (!explicit) {
                const inherited = defaults[axis].get(cell.address);
                if (inherited && inherited !== "A0" && inherited !== cell.address) {
                    const pos = parseAddress(inherited), merge = sheet.merges.find(m => pos.row >= m.start.row && pos.row <= m.end.row && pos.col >= m.start.col && pos.col <= m.end.col);
                    parent = cellAddress(merge?.start ?? pos);
                }
            }
            (axis === "r" ? rows : cols).set(cell.address, parent);
        }
    }
    validateGraph(cells, rows, cols, sheet.name);
    setChains(cells, rows, "r");
    setChains(cells, cols, "c");
    // Explicit descendants can mark a multirow/multicolumn body. Fill unparented
    // cells inside that region, while A0 remains an explicit inheritance break.
    for (const axis of ["r", "c"] as const) {
        const flatten = (bands: readonly ExpansionBand[]): ExpansionBand[] => bands.flatMap((b) => [b, ...flatten(b.children)]);
        const bands = flatten(bandsFor(cells, sheet, axis));
        const parents = axis === "r" ? rows : cols;
        const key = axis === "r" ? "rowParent" : "colParent";
        for (const cell of cells) {
            if (cell.config.expandType === axis || cell.config[key] !== undefined || parents.get(cell.address))
                continue;
            const enclosing = bands.filter((b) => {
                const anchor = byAddress.get(b.anchor)!;
                if (b.anchor === cell.address || b.start === b.end || b.start > coordinate(cell, axis) || b.end < coordinate(cell, axis))
                    return false;
                if (axis === "c" && cell.row < anchor.row)
                    return false;
                return !(axis === "r" && cell.row === anchor.row && cell.col < anchor.col);
            });
            enclosing.sort((a, b) => (a.end - a.start) - (b.end - b.start));
            if (enclosing[0])
                parents.set(cell.address, enclosing[0].anchor);
        }
    }
    validateGraph(cells, rows, cols, sheet.name);
    setChains(cells, rows, "r");
    setChains(cells, cols, "c");
    for (const cell of cells) {
        cell.rowParentAddress = rows.get(cell.address);
        cell.colParentAddress = cols.get(cell.address);
    }
    return { ...sheet, sourceSheetId: sheet.sourceSheetId ?? sheet.name, sourceSheetName: sheet.sourceSheetName ?? sheet.name,
        cells, rowBands: bandsFor(cells, sheet, "r"), colBands: bandsFor(cells, sheet, "c") };
}
export function compileReport(template: ReportTemplate): CompiledReport {
    return { sheets: template.sheets.map(compileSheet), config: template.config, styles: template.styles };
}
