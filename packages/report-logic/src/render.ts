import type { CompiledCell, CompiledReport, RenderedCell, RenderedReport, RenderLimits, ReportExpressionRuntime, RenderedSheet, ReportInput, ReportScope, CellRange } from "depa-data-report-contract";
import { createReferenceProjection } from "./references";
import { evaluateReportCells, type FormulaInstance } from "./formula-evaluation";
import { instantiateSheets } from "./sheet-instances";
import { layoutSheet, layoutBindings, type LayoutCell } from "./layout";
import { datasetView, immutableInput, readField, scopeFor, type ExpansionItem, type ScopeRuntime } from "./scope";
import { applyVisibility } from "./visibility";
import { renderImages } from "./media";
import { renderCharts } from "./charts";
export function reportLimits(config: RenderLimits) {
    const limits = { maxSheets: config.maxSheets ?? 100, maxRows: config.maxRows ?? 20000, maxColumns: config.maxColumns ?? 512, maxCells: config.maxCells ?? 100000, maxMediaItems: config.maxMediaItems??1000, maxMediaBytes: config.maxMediaBytes??20*1024*1024 };
    for (const [key, value] of Object.entries(limits))
        if (!Number.isSafeInteger(value) || value < 1)
            throw new Error(`Invalid report limit ${key}`);
    if (limits.maxRows > 1048576 || limits.maxColumns > 16384)
        throw new Error("Report limits exceed Excel dimensions");
    return limits;
}
function valueFor(runtime: ReportExpressionRuntime, cell: CompiledCell, scope: ReportScope, rows: ExpansionItem[], cols: ExpansionItem[], context: ScopeRuntime): unknown {
    if ([...rows, ...cols].some(item => item.empty) && (cell.expression !== undefined || cell.textTemplate !== undefined || cell.fieldBinding || cell.config.expandType))
        return undefined;
    if (cell.expression !== undefined)
        return runtime.evaluate(cell.expression, scope);
    const own = [...rows, ...cols].find(item => item.anchor === cell.address);
    if (cell.groupField)
        return own?.value;
    if (cell.fieldBinding) {
        const records = cell.fieldBinding.dataset ? datasetView(context, cell.fieldBinding.dataset, rows, cols) : scope.records;
        return readField(records[0], cell.fieldBinding.path);
    }
    if (cell.config.expandType && own) {
        if (cell.config.field)
            return readField(own.value, cell.config.field);
        if (own.value === null || typeof own.value !== "object")
            return own.value;
    }
    if (cell.textTemplate !== undefined)
        return cell.textTemplate.replace(/\$\{([^{}]+)\}/g, (_, expression: string) => String(runtime.evaluate(expression, scope) ?? ""));
    return cell.value;
}
export function renderReport(runtime: ReportExpressionRuntime, input: ReportInput & {
    template: CompiledReport;
}, config: RenderLimits = {}): RenderedReport {
    const limits = reportLimits(config), data = immutableInput(input), instances: FormulaInstance[] = [];
    const contexts=new Map<RenderedSheet,ScopeRuntime>();
    let total = 0;
    const report: RenderedReport = { sheets: instantiateSheets(runtime, input.template, data, limits.maxSheets).map(({ sheet, context, instanceId, instancePath }) => {
            const layout = layoutSheet(runtime, context, sheet, { ...limits, maxCells: limits.maxCells - total });
            const { rowOrigins, colOrigins } = layout;
            total += rowOrigins.length * colOrigins.length;
            if (total > limits.maxCells)
                throw new Error("Report cell limit exceeded");
            const cells: RenderedCell[] = [], merges: CellRange[] = [], output: RenderedSheet = { ...sheet, images:[], charts:[], cells, merges, instanceId, instancePath, rowCount: rowOrigins.length, colCount: colOrigins.length, rowOrigins, colOrigins, sourceRowCount: sheet.rowCount, sourceColCount: sheet.colCount,
                rowHeights: Object.fromEntries(rowOrigins.flatMap((origin, row) => sheet.rowHeights?.[origin] ? [[row, sheet.rowHeights[origin]]] : [])),
                rowStyles:Object.fromEntries(rowOrigins.flatMap((origin,row)=>sheet.rowStyles?.[origin]?[[row,sheet.rowStyles[origin]]]:[])),
                colStyles:Object.fromEntries(colOrigins.flatMap((origin,col)=>sheet.colStyles?.[origin]?[[col,sheet.colStyles[origin]]]:[])),
                colWidths: Object.fromEntries(colOrigins.flatMap((origin, col) => sheet.colWidths?.[origin] ? [[col, sheet.colWidths[origin]]] : [])),
                hiddenRows: Object.fromEntries(rowOrigins.flatMap((origin, row) => sheet.hiddenRows?.[origin] ? [[row, true]] : [])),
                hiddenCols: Object.fromEntries(colOrigins.flatMap((origin, col) => sheet.hiddenCols?.[origin] ? [[col, true]] : [])) };
            const metadata = new Map<LayoutCell, FormulaInstance>();
            contexts.set(output,context);
            for (const node of layout.cells) {
                const source = node.source, rows = layoutBindings(node, "r"), cols = layoutBindings(node, "c"), scope = scopeFor(context, rows, cols, source);
                let formula = source.formula;
                const cell: RenderedCell = { row: node.row, col: node.col, origin: source.address, styleId: source.styleId, numberFormat: source.numberFormat, css: source.css, formula, formulaMode: source.formulaMode };
                cells.push(cell);
                const instance: FormulaInstance = { cell, source, sheet: output, scope, rows, cols, base: () => valueFor(runtime, source, scope, rows, cols, context) };
                metadata.set(node, instance);
                instances.push(instance);
                if (node.rowSpan > 1 || node.colSpan > 1)
                    merges.push({ start: { row: node.row, col: node.col }, end: { row: node.row + node.rowSpan - 1, col: node.col + node.colSpan - 1 } });
            }
            for (const [node, instance] of metadata) {
                instance.rowParent = node.rowParent ? metadata.get(node.rowParent) : undefined;
                instance.colParent = node.colParent ? metadata.get(node.colParent) : undefined;
            }
            cells.sort((a, b) => a.row - b.row || a.col - b.col);
            return output;
        }) };
    function refreshFormulas(): void {
        const projection = createReferenceProjection(report);
        for (const instance of instances)
            if (instance.source.formula && instance.source.formulaMode !== "report") {
                instance.cell.formula = projection.formula(instance.source.formula, instance.sheet, instance.source, instance.cell);
            }
    }
    do {
        refreshFormulas();
        evaluateReportCells(runtime, report, instances, { styles: input.template.styles, config: input.template.config });
    } while (applyVisibility(report, instances, input.template.config));
    const projection = createReferenceProjection(report);
    for (const instance of instances) {
        if (instance.cell.value === instance.source.value)
            instance.cell.richText = instance.source.richText;
        if (instance.cell.linkUrl?.startsWith("#"))
            instance.cell.linkUrl = `#${projection.formula(instance.cell.linkUrl.slice(1), instance.sheet, instance.source, instance.cell)}`;
        if (instance.source.arrayFormulaRange) {
            const sourceRange = instance.source.arrayFormulaRange;
            if (sourceRange.start.row === sourceRange.end.row && sourceRange.start.col === sourceRange.end.col) {
                instance.cell.arrayFormulaRange = { start: { row: instance.cell.row, col: instance.cell.col }, end: { row: instance.cell.row, col: instance.cell.col } };
                continue;
            }
            const selected = projection.ranges(instance.sheet, instance.source.arrayFormulaRange);
            if (selected.length !== 1)
                throw new Error(`${instance.sheet.name}!${instance.source.address}: array formula range is no longer a rectangle`);
            instance.cell.arrayFormulaRange = selected[0];
        }
    }
    for (const sheet of report.sheets) {
        const arrays = sheet.cells.filter(cell => cell.arrayFormulaRange);
        for (let i = 0; i < arrays.length; i++)
            for (let j = i + 1; j < arrays.length; j++) {
                const a = arrays[i].arrayFormulaRange!, b = arrays[j].arrayFormulaRange!;
                if (a.start.row <= b.end.row && a.end.row >= b.start.row && a.start.col <= b.end.col && a.end.col >= b.start.col)
                    throw new Error(`${sheet.name}!${arrays[j].origin}: overlapping expanded array formula ranges`);
            }
    }
    renderImages(runtime,report,input.template,instances,limits);
    renderCharts(runtime,report,input.template,contexts,limits.maxMediaItems);
    return report;
}
