import type { CompiledReport, DrawingAnchor, RenderedReport, RenderedSheet, ReportExpressionRuntime, RenderedImage } from "depa-data-report-contract";
import type { FormulaInstance } from "./formula-evaluation";
import { cellAddress } from "./coordinates";
import { imageData } from "./image-data";
export function shiftAnchor(anchor: DrawingAnchor, row: number, col: number): DrawingAnchor {
    const result = structuredClone(anchor);
    result.from.row += row;
    result.from.col += col;
    if (result.to) {
        result.to.row += row;
        result.to.col += col;
    }
    for (const point of [result.from, ...result.to ? [result.to] : []])
        if (!Number.isInteger(point.row) || !Number.isInteger(point.col) || point.row < 0 || point.col < 0 || point.row >= 1048576 || point.col >= 16384)
            throw new Error("Image anchor outside Excel dimensions");
    return result;
}
export function renderImages(runtime: ReportExpressionRuntime, report: RenderedReport, template: CompiledReport, instances: readonly FormulaInstance[], limits: {
    maxMediaItems: number;
    maxMediaBytes: number;
}): void {
    let count = 0, total = 0;
    function add(sheet: RenderedSheet, image: RenderedImage): void {
        if (++count > limits.maxMediaItems)
            throw new Error("Report media item limit exceeded");
        total += image.data.bytes.length;
        if (total > limits.maxMediaBytes)
            throw new Error("Report media byte limit exceeded");
        (sheet.images as RenderedImage[]).push(image);
    }
    for (const sheet of report.sheets) {
        sheet.images = [];
        const source = template.sheets.find(source => source.sourceSheetId === sheet.sourceSheetId)!;
        const own = instances.filter(instance => instance.sheet === sheet);
        for (const model of source.images ?? []) {
            const merged = source.merges.find(range => model.anchor.from.row >= range.start.row && model.anchor.from.row <= range.end.row && model.anchor.from.col >= range.start.col && model.anchor.from.col <= range.end.col);
            const origin = merged?.start ?? model.anchor.from;
            for (const instance of own.filter(instance => instance.source.address === cellAddress(origin))) {
                try {
                    const scope = { ...instance.scope, value: instance.cell.value, image: { name: model.name, description: model.description, anchor: structuredClone(model.anchor) } };
                    if (model.testExpr && !runtime.evaluate(model.testExpr, scope))
                        continue;
                    const data = model.dataExpr ? imageData(runtime.evaluate(model.dataExpr, scope), model.data) : imageData(model.data);
                    if (!data)
                        continue;
                    add(sheet, { id: `${model.id}:${instance.cell.row}:${instance.cell.col}`, sourceId: model.id, name: model.name, description: model.description, data, anchor: shiftAnchor(model.anchor, instance.cell.row - origin.row, instance.cell.col - origin.col) });
                }
                catch (error) {
                    throw new Error(`${sheet.name}!${instance.source.address} image ${model.id}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }
        for (const instance of own)
            if (instance.cell.image) {
                const cell = instance.cell, merge = sheet.merges.find(range => range.start.row === cell.row && range.start.col === cell.col);
                let width = 0, height = 0;
                for (let col = cell.col; col <= (merge?.end.col ?? cell.col); col++)
                    width += (sheet.colWidths?.[col] ?? 8.43) * 7 + 5;
                for (let row = cell.row; row <= (merge?.end.row ?? cell.row); row++)
                    height += (sheet.rowHeights?.[row] ?? 15) * 4 / 3;
                add(sheet, { id: `cell:${cell.row}:${cell.col}`, name: `${instance.source.address} image`, data: imageData(cell.image)!, anchor: { from: { row: cell.row, col: cell.col }, widthEMU: Math.round(width * 9525), heightEMU: Math.round(height * 9525) } });
            }
    }
}
