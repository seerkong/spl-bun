import type { CellPosition, CellRange, RenderedSheet } from "depa-data-report-contract";
import { cellAddress, mapFormulaReferences, referenceRange, type ReferenceProjection } from "depa-data-report-logic";
import { list, object, text, type XmlNode } from "./xml";
export function a1Range(value: string): CellRange {
    let result: CellRange | undefined;
    mapFormulaReferences(value, (ref, original) => { if (original === value)
        result = referenceRange(ref); return original; });
    if (!result)
        throw new Error(`Invalid document reference ${value}`);
    if (result.end.row < result.start.row || result.end.col < result.start.col)
        throw new Error(`Reversed document reference ${value}`);
    return result;
}
export function a1(range: CellRange): string {
    const start = cellAddress(range.start), end = cellAddress(range.end);
    return start === end ? start : `${start}:${end}`;
}
export function projectedSqref(value: string, sheet: RenderedSheet, projection: ReferenceProjection): CellRange[] {
    return value.trim().split(/\s+/).filter(Boolean).flatMap(ref => projection.ranges(sheet, a1Range(ref)));
}
function replaceFormula(node: XmlNode, sheet: RenderedSheet, projection: ReferenceProjection, origin?: CellPosition, output?: CellPosition): void {
    for (const [key, value] of Object.entries(node)) {
        if (key === "formula" || key === "formula1" || key === "formula2") {
            node[key] = list(value).map(formula => projection.formula(text(formula), sheet, origin, output));
        }
        else if (key === "@val" && node["@type"] === "formula")
            node[key] = projection.formula(text(value), sheet, origin, output);
        else if (!key.startsWith("@"))
            for (const child of list(value))
                if (child && typeof child === "object")
                    replaceFormula(object(child), sheet, projection, origin, output);
    }
}
function projectBoundsAttribute(node: XmlNode, key: string, sheet: RenderedSheet, projection: ReferenceProjection): void {
    if (!node[key])
        return;
    const bounds = projection.bounds(sheet, a1Range(text(node[key])));
    if (bounds)
        node[key] = a1(bounds);
    else
        delete node[key];
}
function projectSortState(node: XmlNode, sheet: RenderedSheet, projection: ReferenceProjection): void {
    projectBoundsAttribute(node, "@ref", sheet, projection);
    node.sortCondition = list(node.sortCondition).flatMap(raw => {
        const condition = object(raw), ranges = projection.ranges(sheet, a1Range(text(condition["@ref"])));
        return ranges.flatMap(range => {
            const result: XmlNode[] = [];
            for (let col = range.start.col; col <= range.end.col; col++)
                result.push({ ...condition, "@ref": a1({ start: { row: range.start.row, col }, end: { row: range.end.row, col } }) });
            return result;
        });
    });
}
function projectAutoFilter(filter: XmlNode, sheet: RenderedSheet, projection: ReferenceProjection): void {
    if (!filter["@ref"])
        return;
    const source = a1Range(text(filter["@ref"])), bounds = projection.bounds(sheet, source);
    if (!bounds) {
        delete filter["@ref"];
        return;
    }
    filter["@ref"] = a1(bounds);
    if (filter.filterColumn !== undefined)
        filter.filterColumn = list(filter.filterColumn).flatMap(raw => {
            const column = object(raw), point = { row: source.start.row, col: source.start.col + Number(column["@colId"]) };
            const positions = new Set<number>();
            for (const range of projection.ranges(sheet, { start: point, end: point }))
                for (let col = range.start.col; col <= range.end.col; col++)
                    positions.add(col);
            return [...positions].sort((a, b) => a - b).map(col => ({ ...structuredClone(column), "@colId": String(col - bounds.start.col) }));
        });
    if (filter.sortState)
        projectSortState(object(filter.sortState), sheet, projection);
}
/** Metadata owns XML shape; all coordinate decisions use the logic projection. */
export function projectWorksheetMetadata(worksheet: XmlNode, sheet: RenderedSheet, projection: ReferenceProjection): void {
    const validations = object(worksheet.dataValidations);
    if (worksheet.dataValidations !== undefined) {
        validations.dataValidation = list(validations.dataValidation).flatMap(raw => {
            const source = object(raw), sqref = text(source["@sqref"]), origin = a1Range(sqref.split(/\s+/)[0]).start;
            return projectedSqref(sqref, sheet, projection).map(range => {
                const result = structuredClone(source);
                result["@sqref"] = a1(range);
                replaceFormula(result, sheet, projection, origin, range.start);
                return result;
            });
        });
        validations["@count"] = String((validations.dataValidation as unknown[]).length);
        if (!Number(validations["@count"]))
            delete worksheet.dataValidations;
    }
    if (worksheet.conditionalFormatting !== undefined)
        worksheet.conditionalFormatting = list(worksheet.conditionalFormatting).flatMap(raw => {
            const source = object(raw), sqref = text(source["@sqref"]), origin = a1Range(sqref.split(/\s+/)[0]).start;
            return projectedSqref(sqref, sheet, projection).map(range => {
                const result = structuredClone(source);
                result["@sqref"] = a1(range);
                replaceFormula(result, sheet, projection, origin, range.start);
                return result;
            });
        });
    const rules=list(worksheet.conditionalFormatting).flatMap(raw=>list(object(raw).cfRule).map(object));
    if(new Set(rules.map(rule=>rule["@priority"])).size!==rules.length){
        rules.sort((a,b)=>Number(a["@priority"])-Number(b["@priority"]));
        rules.forEach((rule,index)=>rule["@priority"]=String(index+1));
    }
    if (worksheet.autoFilter) {
        projectAutoFilter(object(worksheet.autoFilter), sheet, projection);
        if (!object(worksheet.autoFilter)["@ref"])
            delete worksheet.autoFilter;
    }
    if (worksheet.sortState) {
        projectSortState(object(worksheet.sortState), sheet, projection);
        if (!object(worksheet.sortState)["@ref"])
            delete worksheet.sortState;
    }
    for (const axis of ["row", "col"] as const) {
        const node = object(worksheet[`${axis}Breaks`]), slots = axis === "row" ? sheet.rowOrigins : sheet.colOrigins;
        if (worksheet[`${axis}Breaks`] === undefined)
            continue;
        node.brk = list(node.brk).flatMap(raw => {
            const source = object(raw), id = Number(source["@id"]), mapped = slots.lastIndexOf(id);
            return mapped < 0 ? [] : [{ ...source, "@id": String(mapped) }];
        });
        node["@count"] = String((node.brk as unknown[]).length);
        node["@manualBreakCount"] = String((node.brk as unknown[]).filter(raw => object(raw)["@man"] === "1").length);
    }
    for (const raw of list(object(worksheet.sheetViews).sheetView)) {
        const view = object(raw);
        if (view["@tabSelected"] !== undefined)
            view["@tabSelected"] = "0";
        // Frozen split counts and topLeftCell describe the viewport, not a repeated
        // record. Keep them fixed; selections refer to actual cells and are projected.
        for (const rawSelection of list(view.selection)) {
            const selection = object(rawSelection);
            if (selection["@sqref"]) {
                const ranges = projectedSqref(text(selection["@sqref"]), sheet, projection);
                selection["@sqref"] = ranges.length ? ranges.map(a1).join(" ") : "A1";
            }
            if (selection["@activeCell"]) {
                const ranges = projection.ranges(sheet, a1Range(text(selection["@activeCell"])));
                selection["@activeCell"] = ranges.length ? cellAddress(ranges[0].start) : "A1";
            }
        }
    }
    for (const raw of list(object(worksheet.ignoredErrors).ignoredError)) {
        const node = object(raw);
        if (node["@sqref"])
            node["@sqref"] = projectedSqref(text(node["@sqref"]), sheet, projection).map(a1).join(" ");
    }
}
export function projectDefinedNames(workbook: XmlNode, plans: readonly {
    sheet: RenderedSheet;
    sourceId: string;
    index: number;
}[], sourceNames: readonly string[], projection: ReferenceProjection): void {
    if (workbook.definedNames === undefined)
        return;
    const root = object(workbook.definedNames);
    root.definedName = list(root.definedName).flatMap(raw => {
        const source = object(raw), local = source["@localSheetId"], expression = text(source);
        if (local !== undefined)
            return plans.filter(plan => plan.sourceId === sourceNames[Number(local)]).map(plan => ({
                ...source, "@localSheetId": String(plan.index), "#text": projection.formula(expression, plan.sheet),
            }));
        const variants = [...new Set(plans.map(plan => projection.formula(expression, plan.sheet)))].filter(value => !value.includes("#REF!"));
        if (!variants.length)
            return [];
        // Range names spanning loop sheets become unions. Expression names retain
        // their first workbook context, matching the single global-name namespace.
        let remainder = expression;
        mapFormulaReferences(expression, (_ref, original) => { remainder = remainder.replace(original, ""); return original; });
        const value = /^[\s,]*$/.test(remainder) ? variants.join(",") : variants[0];
        return [{ ...source, "#text": value }];
    });
    if (!(root.definedName as unknown[]).length)
        delete workbook.definedNames;
}
export function projectTable(table: XmlNode, sheet: RenderedSheet, projection: ReferenceProjection, id: number, name: string): void {
    const original = a1Range(text(table["@ref"])), bounds = projection.bounds(sheet, original);
    if (!bounds)
        throw new Error(`${sheet.name}: table ${name} has no remaining cells`);
    if (table.extLst !== undefined && (a1(bounds) !== a1(original)))
        throw new Error(`${sheet.name}: table ${name}/extLst requires a relocation adapter`);
    const columns = list(object(table.tableColumns).tableColumn).map(object);
    const names = new Set<string>();
    const projected: XmlNode[] = [];
    for (let col = bounds.start.col; col <= bounds.end.col; col++) {
        const header = sheet.cells.find(cell => cell.row === bounds.start.row && cell.col === col);
        const sourceCol = header ? referenceRange({ start: header.origin, kind: "cell" }).start.col : sheet.colOrigins[col];
        const source = columns[sourceCol - original.start.col] ?? {};
        const column = structuredClone(source), base = String(header?.value ?? source["@name"] ?? `Column${projected.length + 1}`).slice(0, 250) || `Column${projected.length + 1}`;
        let label = base, index = 1;
        while (names.has(label.toLowerCase()))
            label = `${base}_${++index}`;
        names.add(label.toLowerCase());
        column["@id"] = String(projected.length + 1);
        column["@name"] = label;
        for (const key of ["calculatedColumnFormula", "totalsRowFormula"])
            if (column[key] !== undefined)
                column[key] = projection.formula(text(column[key]), sheet, { row: original.start.row + 1, col: sourceCol }, { row: bounds.start.row + 1, col });
        projected.push(column);
    }
    table["@ref"] = a1(bounds);
    table["@id"] = String(id);
    table["@name"] = name;
    table["@displayName"] = name;
    table.tableColumns = { ...object(table.tableColumns), "@count": String(projected.length), tableColumn: projected };
    if (table.autoFilter)
        projectAutoFilter(object(table.autoFilter), sheet, projection);
    if (table.sortState)
        projectSortState(object(table.sortState), sheet, projection);
}
export function renameStructuredReferences(formula: string, names: ReadonlyMap<string, string>): string {
    return formula.split(/("(?:[^"]|"")*")/g).map((part, index) => index % 2 ? part : part.replace(/([\p{L}_][\p{L}\p{N}_.]*)(?=\[)/gu, (original) => names.get(original) ?? original)).join("");
}
