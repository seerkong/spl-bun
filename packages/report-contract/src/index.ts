/** Inputs are caller-owned values. Plans, cell instances and files are projections. */
export type ReportRecord = Readonly<Record<string, unknown>>;
export interface CellPosition { row: number; col: number }
export interface CellRange { start: CellPosition; end: CellPosition }
export interface ReportImageData { bytes: Uint8Array; mimeType: "image/png" | "image/jpeg" | "image/gif" | "image/bmp" }
export interface DrawingMarker extends CellPosition { rowOffsetEMU?: number; colOffsetEMU?: number }
export interface DrawingAnchor { from: DrawingMarker; to?: DrawingMarker; widthEMU?: number; heightEMU?: number }
export interface TemplateImage { id: string; name?: string; description?: string; anchor: DrawingAnchor; data: ReportImageData; testExpr?: string; dataExpr?: string }
export interface RenderedImage extends Omit<TemplateImage,"testExpr"|"dataExpr"> { sourceId?: string }
export interface ChartReference { id: string; kind: "title"|"seriesData"|"seriesCategory"|"seriesName"|"axisTitle"|"axisData"; formula?: string; text?: string; seriesIndex?: number; axisIndex?: number }
export interface TemplateChart { id: string; name?: string; anchor: DrawingAnchor; bindings?: Readonly<Record<string,string>>; inertBindings?:Readonly<Record<string,string>>; references: readonly ChartReference[] }
export interface RenderedChart extends Omit<TemplateChart,"bindings"|"references"> { sourceId: string; references: readonly (ChartReference & {values?:readonly unknown[]})[]; hiddenSeries?: readonly number[] }
export interface BarcodeRequest { content: string; format: string; width: number; height: number; options?:Readonly<Record<string,unknown>> }
export interface TemplateCell extends CellPosition {
  value?: unknown;
  formula?: string;
  /** Report formulas select template instances; Excel formulas address output cells. */
  formulaMode?: "excel" | "report";
  annotation?: string;
  styleId?: number;
  numberFormat?: string;
  css?: Readonly<Record<string, string>>;
  linkUrl?: string;
  richText?: readonly { text: string; css?: Readonly<Record<string,string>> }[];
  arrayFormulaRange?: CellRange;
}
export interface TemplateSheet {
  name: string;
  sourceSheetId?: string;
  sourceSheetName?: string;
  config?: SheetConfig;
  rowCount: number;
  colCount: number;
  cells: readonly TemplateCell[];
  merges: readonly CellRange[];
  rowHeights?: Readonly<Record<number, number>>;
  colWidths?: Readonly<Record<number, number>>;
  hiddenRows?: Readonly<Record<number,boolean>>;
  hiddenCols?: Readonly<Record<number,boolean>>;
  rowStyles?: Readonly<Record<number,ReportStyle>>;
  colStyles?: Readonly<Record<number,ReportStyle>>;
  images?: readonly TemplateImage[];
  charts?: readonly TemplateChart[];
}
export interface LoopConfig {
  beginLoop?: string;
  loopItemsName?: string;
  loopVarName?: string;
  loopIndexName?: string;
  testExpr?: string;
  location?: string;
}
export interface SheetConfig extends LoopConfig {
  sheetVarName?: string;
  sheetNameExpr?: string;
}
export interface ReportStyle { styleId: number; numberFormat?: string; css?: Readonly<Record<string,string>> }
export interface ReportConfig extends LoopConfig {
  removeHiddenCell?: boolean;
  exportFormattedValue?: boolean;
  namedStyles?: Readonly<Record<string,number>>;
}
export interface ReportTemplate { sheets: readonly TemplateSheet[]; config?: ReportConfig; styles?: Readonly<Record<string,ReportStyle>> }
export interface CellConfig {
  expandType?: "r" | "c";
  expandExpr?: string;
  valueExpr?: string;
  formulaExpr?: string;
  formulaMode?: "excel" | "report";
  ds?: string;
  field?: string;
  rowParent?: string;
  colParent?: string;
  keepExpandEmpty?: boolean;
  expandMinCount?: number;
  expandMaxCount?: number;
  expandInplaceCount?: number;
  rowExtendForSibling?: boolean;
  colExtendForSibling?: boolean;
  rowTestExpr?: string;
  colTestExpr?: string;
  visibleExpr?: string;
  styleIdExpr?: string;
  formatExpr?: string;
  exportFormattedValue?: boolean;
  exportFormula?: boolean;
  dict?: string;
  processExpr?: string;
  linkExpr?: string;
  imageExpr?: string;
  barcodeFormat?: string;
  barcodeWidth?: number;
  barcodeHeight?: number;
  barcodeOptions?: Readonly<Record<string,unknown>>;
}
export interface CompiledCell extends TemplateCell {
  address: string;
  config: CellConfig;
  expression?: string;
  textTemplate?: string;
  groupField?: string;
  fieldBinding?: { path: string; dataset?: string };
  rowChain: readonly string[];
  colChain: readonly string[];
  rowParentAddress?: string;
  colParentAddress?: string;
}
export interface ExpansionBand {
  anchor: string;
  start: number;
  end: number;
  children: readonly ExpansionBand[];
}
export interface CompiledSheet extends Omit<TemplateSheet, "cells"> {
  cells: readonly CompiledCell[];
  rowBands: readonly ExpansionBand[];
  colBands: readonly ExpansionBand[];
}
export interface CompiledReport { sheets: readonly CompiledSheet[]; config?: ReportConfig; styles?: Readonly<Record<string,ReportStyle>> }
export interface ReportInput {
  datasets?: Readonly<Record<string, readonly ReportRecord[]>>;
  params?: Readonly<Record<string, unknown>>;
}
export interface ReportScope extends Record<string, unknown> {
  records: readonly ReportRecord[];
  item: unknown;
  index: number;
}
export interface ReportExpressionRuntime {
  evaluate(expression: string, scope: ReportScope): unknown;
  formatValue?(value: unknown, numberFormat: string): string;
  renderBarcode?(request: BarcodeRequest): ReportImageData;
}
export interface RenderLimits {
  maxSheets?: number;
  maxRows?: number;
  maxColumns?: number;
  maxCells?: number;
  maxMediaItems?: number;
  maxMediaBytes?: number;
}
export interface RenderedCell extends TemplateCell {
  origin: string;
  /** Native Excel formulas are retained separately; Excel recalculates their cache. */
  formula?: string;
  formulaStatus?: "calculated" | "uncomputed";
  formulaDiagnostic?: string;
  displayValue?: unknown;
  exportValue?: unknown;
  rowVisible?: boolean;
  colVisible?: boolean;
  removeRow?: boolean;
  removeCol?: boolean;
  linkUrl?: string;
  image?: ReportImageData;
}
export interface RenderedSheet extends Omit<TemplateSheet, "cells"|"images"|"charts"> {
  cells: readonly RenderedCell[];
  instanceId?: string;
  instancePath?: readonly number[];
  /** Output index -> original template index, including duplicated bands. */
  rowOrigins: readonly number[];
  colOrigins: readonly number[];
  sourceRowCount?: number;
  sourceColCount?: number;
  images?: readonly RenderedImage[];
  charts?: readonly RenderedChart[];
}
export interface RenderedReport { sheets: readonly RenderedSheet[] }
/** Codec implementations work on bytes, never implicit filesystem paths. */
export interface ReportWorkbookCodec<Archive> {
  read(bytes: Uint8Array): { template: ReportTemplate; archive: Archive };
  write(archive: Archive, report: RenderedReport): Uint8Array;
  html(report: RenderedReport): string;
}
