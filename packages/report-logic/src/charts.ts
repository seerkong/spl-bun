import type { ChartReference, CompiledReport, RenderedChart, RenderedReport, RenderedSheet, ReportExpressionRuntime } from "depa-data-report-contract";
import { createReferenceProjection, mapFormulaReferences, referenceRange } from "./references";
import { cellAddress } from "./coordinates";
import { scopeFor, type ScopeRuntime } from "./scope";
export function renderCharts(runtime: ReportExpressionRuntime, report: RenderedReport, template: CompiledReport, contexts: ReadonlyMap<RenderedSheet, ScopeRuntime>, maxItems: number): void {
    const projection = createReferenceProjection(report);
    let count = report.sheets.reduce((sum, sheet) => sum + (sheet.images?.length ?? 0), 0);
    const lookup = new Map(report.sheets.map(sheet => [sheet, new Map(sheet.cells.map(cell => [cellAddress(cell), cell]))]));
    function values(formula: string, current: RenderedSheet): unknown[] {
        const result: unknown[] = [];
        const remainder = mapFormulaReferences(formula, (ref) => {
            const target = ref.sheet ? report.sheets.find(sheet => sheet.name.toLowerCase() === ref.sheet!.toLowerCase()) : current;
            if (!target)
                throw new Error(`Unknown chart data sheet ${ref.sheet}`);
            const range = referenceRange(ref);
            if ((range.end.row - range.start.row + 1) * (range.end.col - range.start.col + 1) > 100000)
                throw new Error("Chart data reference exceeds 100000 cells");
            for (let row = range.start.row; row <= range.end.row; row++)
                for (let col = range.start.col; col <= range.end.col; col++) {
                    const cell = lookup.get(target)!.get(cellAddress({ row, col }));
                    if (cell?.formulaStatus === "uncomputed")
                        throw new Error(`Chart depends on uncomputed cell ${target.name}!${cellAddress({ row, col })}`);
                    result.push(cell?.value);
                }
            return "";
        });
        if (remainder.replace(/[\s,()=]/g, "").length)
            throw new Error(`Chart data requires cell ranges, got ${formula}`);
        return result;
    }
    for (const sheet of report.sheets) {
        const source = template.sheets.find(source => source.sourceSheetId === sheet.sourceSheetId)!;
        const output: RenderedChart[] = [];
        sheet.charts = output;
        for (const chart of source.charts ?? []) {
            try {
                const bindings = chart.bindings ?? {}, scope = { ...scopeFor(contexts.get(sheet)!, [], []), chart: { id: chart.id, name: chart.name } }, hidden = new Set<number>();
                const evaluate = (name: string, extra: Record<string, unknown> = {}) => bindings[name] === undefined ? undefined : runtime.evaluate(bindings[name], { ...scope, ...extra });
                if (bindings.chartTestExpr && !evaluate("chartTestExpr"))
                    continue;
                const seriesModels = new Map<number, Record<string, unknown>>();
                for (const reference of chart.references)
                    if (reference.seriesIndex !== undefined) {
                        const model = seriesModels.get(reference.seriesIndex) ?? { index: reference.seriesIndex };
                        if (reference.kind === "seriesName") {
                            model.name = reference.text;
                            model.nameCellRef = reference.formula;
                        }
                        if (reference.kind === "seriesData")
                            model.dataCellRef = reference.formula;
                        if (reference.kind === "seriesCategory")
                            model.catCellRef = reference.formula;
                        seriesModels.set(reference.seriesIndex, model);
                    }
                if (bindings.seriesTestExpr)
                    for (const [index, series] of seriesModels)
                        if (!evaluate("seriesTestExpr", { series }))
                            hidden.add(index);
                const references: RenderedChart["references"][number][] = [];
                for (const reference of chart.references) {
                    const extra = { series: reference.seriesIndex === undefined ? undefined : seriesModels.get(reference.seriesIndex), axis: { index: reference.axisIndex }, reference: { ...reference } };
                    if (reference.seriesIndex !== undefined && hidden.has(reference.seriesIndex))
                        continue;
                    const names: Record<ChartReference["kind"], {
                        formula: string;
                        text?: string;
                    }> = { title: { formula: "chartTitleCellRefExpr", text: "chartTitleExpr" }, seriesData: { formula: "seriesDataCellRefExpr" }, seriesCategory: { formula: "seriesCatCellRefExpr" }, seriesName: { formula: "seriesNameCellRefExpr", text: "seriesNameExpr" }, axisTitle: { formula: "axisTitleCellRefExpr", text: "axisTitleExpr" }, axisData: { formula: "axisDataCellRefExpr" } };
                    const key = names[reference.kind], replacement = evaluate(key.formula, extra);
                    let formula = replacement == null ? reference.formula : String(replacement), text = reference.text;
                    if (formula) {
                        if (["seriesData", "seriesCategory", "axisData"].includes(reference.kind))
                            formula = mapFormulaReferences(formula, (ref, original) => ref.kind === "cell" && !ref.end ? `${original}:${ref.start}` : original);
                        formula = projection.formula(formula, sheet);
                        references.push({ ...reference, formula, text: undefined, values: values(formula, sheet) });
                    }
                    else {
                        const replacement = key.text ? evaluate(key.text, extra) : undefined;
                        if (replacement != null)
                            text = String(replacement);
                        references.push({ ...reference, formula: undefined, text });
                    }
                }
                if (++count > maxItems)
                    throw new Error("Report media item limit exceeded");
                const from = projection.bounds(sheet, { start: chart.anchor.from, end: chart.anchor.from })?.start;
                const anchor = structuredClone(chart.anchor);
                if (from) {
                    const row = from.row - anchor.from.row, col = from.col - anchor.from.col;
                    anchor.from.row += row;
                    anchor.from.col += col;
                    if (anchor.to) {
                        anchor.to.row += row;
                        anchor.to.col += col;
                    }
                }
                output.push({ id: chart.id, sourceId: chart.id, name: chart.name, anchor, references, hiddenSeries: [...hidden] });
            }
            catch (error) {
                throw new Error(`${sheet.name} chart ${chart.name ?? chart.id}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
}
