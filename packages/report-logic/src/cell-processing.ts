import type { CompiledCell, RenderedCell, ReportConfig, ReportStyle, ReportExpressionRuntime } from "depa-data-report-contract";
import { imageData } from "./image-data";
import { scalar } from "./formula-expression";
interface ProcessInput {
    source: CompiledCell;
    cell: RenderedCell;
    evaluate(source: string): unknown;
    styles?: Readonly<Record<string, ReportStyle>>;
    config?: ReportConfig;
    formatValue?(value: unknown, numberFormat: string): string;
    dictionaries?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
    renderBarcode?: ReportExpressionRuntime["renderBarcode"];
    barcodeSize?: {
        width: number;
        height: number;
    };
}
function scalarValue(value: unknown): void {
    if (value !== null && value !== undefined && !['number', 'string', 'boolean', 'bigint'].includes(typeof value) && !(value instanceof Date))
        throw new Error("Cell processing value must be a scalar");
}
function selectStyle(input: ProcessInput, value: unknown): void {
    if (value == null)
        return;
    const key = String(value), style = input.styles?.[key];
    if (!style)
        throw new Error(`Unknown report style ${key}`);
    input.cell.styleId = style.styleId;
    input.cell.css = style.css;
    input.cell.numberFormat = style.numberFormat;
}
/** The patch is a value, not a mutable cell or service container. */
export function applyCellProcessing(input: ProcessInput): void {
    const { source, cell, evaluate } = input, config = source.config;
    if (config.processExpr && !/^QRCODE\(\s*\)$/.test(config.processExpr)) {
        const patch = evaluate(config.processExpr);
        if (!patch || typeof patch !== "object" || Array.isArray(patch))
            throw new Error("processExpr must return a cell patch object");
        for (const [key, raw] of Object.entries(patch)) {
            const value=scalar(raw);
            switch (key) {
                case "value":
                    scalarValue(value);
                    cell.value = value;
                    cell.formula = undefined;
                    cell.formulaStatus = undefined;
                    break;
                case "displayValue":
                    scalarValue(value);
                    cell.displayValue = value;
                    break;
                case "exportValue":
                    scalarValue(value);
                    cell.exportValue = value;
                    break;
                case "styleId":
                    selectStyle(input, value);
                    break;
                case "linkUrl":
                    cell.linkUrl = value == null ? undefined : String(value);
                    break;
                case "image":
                    cell.image = imageData(value);
                    break;
                default: throw new Error(`Unsupported cell patch field ${key}`);
            }
        }
    }
    if (config.imageExpr)
        cell.image = imageData(evaluate(config.imageExpr));
    if (config.barcodeFormat || config.processExpr && /^QRCODE\(\s*\)$/.test(config.processExpr)) {
        if (cell.value !== null && cell.value !== undefined && String(cell.value) !== "") {
            if (!input.renderBarcode)
                throw new Error("QRCODE requires an explicit runtime.renderBarcode port");
            cell.image = imageData(input.renderBarcode({ content: String(cell.value), format: config.barcodeFormat ?? "QR_CODE", width: config.barcodeWidth?config.barcodeWidth:input.barcodeSize?.width??128, height:config.barcodeHeight?config.barcodeHeight:input.barcodeSize?.height??128, options: config.barcodeOptions }));
        }
    }
    if (config.rowTestExpr)
        cell.removeRow = !Boolean(evaluate(config.rowTestExpr));
    if (config.colTestExpr)
        cell.removeCol = !Boolean(evaluate(config.colTestExpr));
    if (config.visibleExpr) {
        const visible = Boolean(evaluate(config.visibleExpr));
        if (config.expandType === "c")
            cell.colVisible = visible;
        else
            cell.rowVisible = visible;
    }
    if (config.styleIdExpr)
        selectStyle(input, evaluate(config.styleIdExpr));
    if (cell.displayValue === undefined && cell.numberFormat && input.formatValue)
        cell.displayValue = input.formatValue(cell.value, cell.numberFormat);
    if (config.formatExpr)
        cell.displayValue = evaluate(config.formatExpr);
    else if (config.dict) {
        const dictionary = input.dictionaries?.[config.dict];
        if (!dictionary || typeof dictionary !== "object")
            throw new Error(`Unknown report dictionary ${config.dict}; pass params.dicts explicitly`);
        const key = String(cell.value ?? "");
        cell.displayValue = Object.prototype.hasOwnProperty.call(dictionary, key) ? dictionary[key] : cell.value;
        scalarValue(cell.displayValue);
    }
    if (config.linkExpr)
        cell.linkUrl = String(evaluate(config.linkExpr) ?? "");
    if ((config.exportFormattedValue ?? input.config?.exportFormattedValue) && cell.displayValue !== undefined)
        cell.exportValue = cell.displayValue;
}
