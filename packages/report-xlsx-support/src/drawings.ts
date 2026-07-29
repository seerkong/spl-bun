import type { DrawingAnchor, DrawingMarker, ReportImageData, TemplateImage, TemplateChart, RenderedSheet } from "depa-data-report-contract";
import { parseReportProperties, createReferenceProjection, cellAddress, parseAddress } from "depa-data-report-logic";
import { chartEntries, projectChartXml } from "./chart-xml";
import { object, list, text, parseXml, type XmlNode } from "./xml";
import { resolvePart, relativePart, relPathFor } from "./part-paths";
const decoder = new TextDecoder();
function local(key: string): string { return key.split(":").pop()!; }
function child(node: XmlNode, name: string): unknown { return node[Object.keys(node).find(key => local(key) === name) ?? name]; }
function setChild(node: XmlNode, name: string, value: unknown, prefix = "xdr"): void { node[Object.keys(node).find(key => local(key) === name) ?? `${prefix}:${name}`] = value; }
function load(parts: ReadonlyMap<string, Uint8Array>, path: string): XmlNode {
    const bytes = parts.get(path);
    if (!bytes)
        throw new Error(`Missing drawing part ${path}`);
    return parseXml(decoder.decode(bytes));
}
function rootOf(doc: XmlNode): XmlNode { return object(doc[Object.keys(doc).find(key => local(key) === "wsDr") ?? "xdr:wsDr"]); }
function marker(value: unknown): DrawingMarker {
    const node = object(value);
    return { row: Number(text(child(node, "row"))), col: Number(text(child(node, "col"))), rowOffsetEMU: Number(text(child(node, "rowOff")) || 0), colOffsetEMU: Number(text(child(node, "colOff")) || 0) };
}
function anchorOf(node: XmlNode): DrawingAnchor {
    const extent = object(child(node, "ext")), position = object(child(node, "pos"));
    return { from: child(node, "from") ? marker(child(node, "from")) : { row: 0, col: 0, colOffsetEMU: Number(position["@x"] ?? 0), rowOffsetEMU: Number(position["@y"] ?? 0) }, to: child(node, "to") ? marker(child(node, "to")) : undefined, widthEMU: extent["@cx"] === undefined ? undefined : Number(extent["@cx"]), heightEMU: extent["@cy"] === undefined ? undefined : Number(extent["@cy"]) };
}
function dataType(path: string): ReportImageData["mimeType"] {
    const ext = path.split(".").pop()?.toLowerCase();
    const types: Record<string, ReportImageData["mimeType"]> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp" };
    if (!ext || !types[ext])
        throw new Error(`Unsupported image type in ${path}`);
    return types[ext];
}
export function validateImage(data: ReportImageData,location="Report image"): void {
    const bytes = data.bytes, view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const signatures: Record<string, boolean> = {
        "image/png": bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value),
        "image/jpeg": bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
        "image/gif": bytes.length >= 10 && /^GIF8[79]a$/.test(decoder.decode(bytes.slice(0, 6))),
        "image/bmp": bytes.length >= 26 && bytes[0] === 66 && bytes[1] === 77,
    };
    if (!signatures[data.mimeType] || bytes.length > 5 * 1024 * 1024)
        throw new Error(`${location}: invalid or oversized ${data.mimeType} image bytes`);
    if (data.mimeType === "image/png" && (view.getUint32(16) > 10000 || view.getUint32(20) > 10000 || !view.getUint32(16) || !view.getUint32(20)))
        throw new Error(`${location}: PNG dimensions must be 1..10000 pixels`);
}
interface SourceDrawing {
    path: string;
    root: XmlNode;
    anchors: {
        id: string;
        kind: string;
        node: XmlNode;
    }[];
    relationships: XmlNode[];
}
function sourceDrawing(parts: ReadonlyMap<string, Uint8Array>, sheetPath: string, worksheet: XmlNode): SourceDrawing | undefined {
    if (!worksheet.drawing)
        return undefined;
    const relationId = object(worksheet.drawing)["@r:id"], relationships = list(object(load(parts, relPathFor(sheetPath)).Relationships).Relationship).map(object), relation = relationships.find(rel => rel["@Id"] === relationId);
    if (!relation || relation["@TargetMode"] === "External")
        throw new Error(`${sheetPath}: invalid drawing relationship`);
    const path = resolvePart(sheetPath, text(relation["@Target"])), root = rootOf(load(parts, path));
    const anchors = Object.entries(root).filter(([key]) => /Anchor$/.test(local(key))).flatMap(([kind, values]) => list(values).map((node, index) => ({ id: `${path}#${kind}:${index}`, kind, node: object(node) })));
    const rels = parts.has(relPathFor(path)) ? list(object(load(parts, relPathFor(path)).Relationships).Relationship).map(object) : [];
    return { path, root, anchors, relationships: rels };
}
export function readSheetDrawings(parts: ReadonlyMap<string, Uint8Array>, sheetPath: string, worksheet: XmlNode): {
    images: TemplateImage[];
    charts: TemplateChart[];
} {
    const source = sourceDrawing(parts, sheetPath, worksheet), images: TemplateImage[] = [], charts: TemplateChart[] = [];
    if (!source)
        return { images, charts };
    for (const { id, node } of source.anchors) {
        const frame = object(child(node, "graphicFrame")), chartLink = object(child(object(child(object(child(frame, "graphic")), "graphicData")), "chart"));
        if (chartLink["@r:id"]) {
            const relation = source.relationships.find(rel => rel["@Id"] === chartLink["@r:id"]);
            if (!relation || relation["@TargetMode"] === "External")
                throw new Error(`${sheetPath}: invalid chart relationship`);
            const path = resolvePart(source.path, text(relation["@Target"])), properties = object(child(object(child(frame, "nvGraphicFramePr")), "cNvPr")), description = text(properties["@descr"]), name = text(properties["@name"]);
            const bindings = parseReportProperties(description.match(/----+([\s\S]*)$/)?.[1], `${sheetPath} chart ${name}`);
            const supported = new Set(["chartTestExpr", "chartTitleExpr", "chartTitleCellRefExpr", "seriesTestExpr", "seriesDataCellRefExpr", "seriesCatCellRefExpr", "seriesNameCellRefExpr", "seriesNameExpr", "axisDataCellRefExpr", "axisTitleCellRefExpr", "axisTitleExpr"]);
            const inertBindings:Record<string,string>={};
            for (const property of Object.keys(bindings)) {
                if(supported.has(property))continue;
                // Upstream declares direct series arrays but only leaves an
                // extension comment at runtime. Preserve those declarations.
                if(["seriesDataExpr","seriesCatExpr"].includes(property)||property.includes(":")){inertBindings[property]=bindings[property];delete bindings[property];}
                else throw new Error(`${sheetPath}: unsupported chart property ${property}`);
            }
            charts.push({ id, name, anchor: anchorOf(node), bindings, inertBindings, references: chartEntries(load(parts, path)).references.map(entry => entry.reference) });
            continue;
        }
        const picture = object(child(node, "pic"));
        if (!Object.keys(picture).length)
            continue;
        const properties = object(child(object(child(picture, "nvPicPr")), "cNvPr")), name = text(properties["@name"]), description = text(properties["@descr"]);
        const blip = object(child(object(child(picture, "blipFill")), "blip")), rel = source.relationships.find(rel => rel["@Id"] === blip["@r:embed"]);
        if (!rel || rel["@TargetMode"] === "External")
            throw new Error(`${sheetPath}: image ${name} must contain embedded bytes`);
        const path = resolvePart(source.path, text(rel["@Target"])), bytes = parts.get(path);
        if (!bytes)
            throw new Error(`Missing image part ${path}`);
        const data = { bytes: bytes.slice(), mimeType: dataType(path) };
        validateImage(data,`${sheetPath} image ${name}`);
        const suffix = description.match(/----+([\s\S]*)$/)?.[1], config = parseReportProperties(suffix, `${sheetPath} image ${name}`);
        for (const key of Object.keys(config))
            if (key !== "testExpr" && key !== "dataExpr")
                throw new Error(`${sheetPath}: unsupported image property ${key}`);
        images.push({ id, name, description: description.split(/----+/)[0].trim(), anchor: anchorOf(node), data, ...config });
    }
    return { images, charts };
}
function markerXml(value: DrawingMarker): XmlNode { return { "xdr:col": String(value.col), "xdr:colOff": String(value.colOffsetEMU ?? 0), "xdr:row": String(value.row), "xdr:rowOff": String(value.rowOffsetEMU ?? 0) }; }
export interface DrawingWriter {
    parts: ReadonlyMap<string, Uint8Array>;
    sourceSheetPath: string;
    sheetPath: string;
    worksheet: XmlNode;
    sheet: RenderedSheet;
    relationships: XmlNode[];
    allocate(kind: "drawing" | "image" | "chart", extension: string): string;
    write(path: string, node: XmlNode): void;
    writeBytes(path: string, bytes: Uint8Array): void;
    contentType(path: string, type: string): void;
    removePart(path: string): void;
}
export function writeSheetDrawings(input: DrawingWriter): void {
    const { sheet, worksheet } = input, source = sourceDrawing(input.parts, input.sourceSheetPath, worksheet);
    const images = sheet.images ?? [], charts = sheet.charts ?? [];
    if (source) {
        input.removePart(source.path);
        input.removePart(relPathFor(source.path));
        for (const rel of source.relationships.filter(rel => text(rel["@Type"]).endsWith("/chart"))) {
            const path = resolvePart(source.path, text(rel["@Target"]));
            input.removePart(path);
            input.removePart(relPathFor(path));
        }
    }
    input.relationships.splice(0, input.relationships.length, ...input.relationships.filter(rel => !text(rel["@Type"]).endsWith("/drawing")));
    delete worksheet.drawing;
    const unknown = source?.anchors.filter(anchor => !child(anchor.node, "pic") && !child(object(child(object(child(object(child(anchor.node, "graphicFrame")), "graphic")), "graphicData")), "chart")) ?? [];
    if (!images.length && !charts.length && !unknown.length)
        return;
    const path = input.allocate("drawing", "xml"), rels: XmlNode[] = (source?.relationships ?? []).filter(rel => !text(rel["@Type"]).endsWith("/chart")).map(rel => {
        const result = structuredClone(rel);
        if (result["@TargetMode"] !== "External")
            result["@Target"] = relativePart(path, resolvePart(source!.path, text(result["@Target"])));
        return result;
    }), anchors: XmlNode[] = [];
    function newId(prefix: string): string { let id = prefix; while (rels.some(rel => rel["@Id"] === id))
        id += "_"; return id; }
    let index = 0;
    const objectIds = new Set<string>();
    let objectSequence = 0;
    function visit(node: XmlNode, fn: (name: string, node: XmlNode) => void): void { for (const [name, value] of Object.entries(node))
        if (!name.startsWith("@"))
            for (const item of list(value))
                if (item && typeof item === "object") {
                    const nested = object(item);
                    fn(local(name), nested);
                    visit(nested, fn);
                } }
    if (source)
        visit(source.root, (name, node) => { if (name === "cNvPr")
            objectIds.add(text(node["@id"])); });
    function objectId(): string { while (objectIds.has(String(++objectSequence)))
        ; const id = String(objectSequence); objectIds.add(id); return id; }
    for (const image of images) {
        validateImage(image.data,`${sheet.name} image ${image.name??image.id}`);
        const extension = image.data.mimeType.split("/")[1].replace("jpeg", "jpg"), mediaPath = input.allocate("image", extension), id = newId(`rIdImage${++index}`);
        input.writeBytes(mediaPath, image.data.bytes);
        input.contentType(mediaPath, image.data.mimeType);
        rels.push({ "@Id": id, "@Type": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image", "@Target": relativePart(path, mediaPath) });
        const original = source?.anchors.find(anchor => anchor.id === image.sourceId), picture = original ? structuredClone(object(child(original.node, "pic"))) : {
            "xdr:nvPicPr": { "xdr:cNvPr": { "@id": String(index), "@name": image.name ?? `Report image ${index}` }, "xdr:cNvPicPr": { "a:picLocks": { "@noChangeAspect": "1" } } },
            "xdr:blipFill": { "a:blip": {}, "a:stretch": { "a:fillRect": {} } }, "xdr:spPr": { "a:xfrm": {}, "a:prstGeom": { "@prst": "rect", "a:avLst": {} } },
        };
        const properties = object(child(object(child(picture, "nvPicPr")), "cNvPr"));
        properties["@id"] = objectId();
        properties["@name"] = `${image.name ?? "Report image"} ${index}`;
        properties["@descr"] = image.description ?? "";
        const blip = object(child(object(child(picture, "blipFill")), "blip"));
        blip["@r:embed"] = id;
        delete blip["@r:link"];
        if (original) {
            const oldBlip = object(child(object(child(object(child(original.node, "pic")), "blipFill")), "blip")), oldRelation = source!.relationships.find(rel => rel["@Id"] === oldBlip["@r:embed"]), oldBytes = oldRelation ? input.parts.get(resolvePart(source!.path, text(oldRelation["@Target"]))) : undefined;
            if (!oldBytes || oldBytes.length !== image.data.bytes.length || oldBytes.some((byte, index) => byte !== image.data.bytes[index]))
                delete blip[Object.keys(blip).find(key => local(key) === "extLst") ?? "a:extLst"];
        }
        function offset(point: DrawingMarker): {
            x: number;
            y: number;
        } {
            let x = point.col * (8.43 * 7 + 5), y = point.row * 20;
            for (const [index, value] of Object.entries(sheet.colWidths ?? {}))
                if (Number(index) < point.col)
                    x += value * 7 + 5 - (8.43 * 7 + 5);
            for (const [index, value] of Object.entries(sheet.rowHeights ?? {}))
                if (Number(index) < point.row)
                    y += value * 4 / 3 - 20;
            return { x: Math.round(x * 9525) + (point.colOffsetEMU ?? 0), y: Math.round(y * 9525) + (point.rowOffsetEMU ?? 0) };
        }
        const start = offset(image.anchor.from), end = image.anchor.to ? offset(image.anchor.to) : undefined, transform = object(child(object(child(picture, "spPr")), "xfrm"));
        setChild(transform, "off", { "@x": String(start.x), "@y": String(start.y) }, "a");
        setChild(transform, "ext", { "@cx": String(end ? end.x - start.x : image.anchor.widthEMU ?? 952500), "@cy": String(end ? end.y - start.y : image.anchor.heightEMU ?? 952500) }, "a");
        setChild(object(child(picture, "spPr")), "xfrm", transform, "a");
        const anchor: XmlNode = { ...Object.fromEntries(Object.entries(original?.node ?? {}).filter(([key]) => key.startsWith("@"))), "xdr:from": markerXml(image.anchor.from) };
        if (image.anchor.to)
            anchor["xdr:to"] = markerXml(image.anchor.to);
        else
            anchor["xdr:ext"] = { "@cx": String(image.anchor.widthEMU ?? 952500), "@cy": String(image.anchor.heightEMU ?? 952500) };
        anchor["xdr:pic"] = picture;
        anchor["xdr:clientData"] = structuredClone(child(original?.node ?? {}, "clientData") ?? {});
        anchors.push(anchor);
    }
    for (const chart of charts) {
        const original = source?.anchors.find(anchor => anchor.id === chart.sourceId);
        if (!original)
            throw new Error(`${sheet.name}: missing source chart ${chart.sourceId}`);
        const frame = structuredClone(object(child(original.node, "graphicFrame"))), link = object(child(object(child(object(child(frame, "graphic")), "graphicData")), "chart")), sourceRel = source!.relationships.find(rel => rel["@Id"] === link["@r:id"]);
        if (!sourceRel)
            throw new Error(`${sheet.name}: missing source chart relationship`);
        const sourcePath = resolvePart(source!.path, text(sourceRel["@Target"])), chartPath = input.allocate("chart", "xml"), doc = load(input.parts, sourcePath);
        projectChartXml(doc, chart);
        input.write(chartPath, doc);
        input.contentType(chartPath, "application/vnd.openxmlformats-officedocument.drawingml.chart+xml");
        if (input.parts.has(relPathFor(sourcePath))) {
            const doc = load(input.parts, relPathFor(sourcePath)), root = object(doc.Relationships);
            root.Relationship = list(root.Relationship).map(object).filter(rel => !text(rel["@Type"]).endsWith("/package")).map(rel => {
                if (rel["@TargetMode"] !== "External")
                    rel["@Target"] = relativePart(chartPath, resolvePart(sourcePath, text(rel["@Target"])));
                return rel;
            });
            input.write(relPathFor(chartPath), doc);
        }
        const id = newId(`rIdChart${++index}`);
        link["@r:id"] = id;
        const properties = object(child(object(child(frame, "nvGraphicFramePr")), "cNvPr"));
        properties["@id"] = objectId();
        properties["@descr"] = text(properties["@descr"]).split(/----+/)[0].trim();
        rels.push({ "@Id": id, "@Type": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart", "@Target": relativePart(path, chartPath) });
        const anchor: XmlNode = { ...Object.fromEntries(Object.entries(original.node).filter(([key]) => key.startsWith("@"))), "xdr:from": markerXml(chart.anchor.from) };
        if (chart.anchor.to)
            anchor["xdr:to"] = markerXml(chart.anchor.to);
        else
            anchor["xdr:ext"] = { "@cx": String(chart.anchor.widthEMU ?? 3810000), "@cy": String(chart.anchor.heightEMU ?? 2857500) };
        anchor["xdr:graphicFrame"] = frame;
        anchor["xdr:clientData"] = structuredClone(child(original.node, "clientData") ?? {});
        anchors.push(anchor);
    }
    const projection = createReferenceProjection({ sheets: [sheet] });
    for (const original of unknown) {
        const from = anchorOf(original.node).from, address = cellAddress(from), selected = sheet.cells.filter(cell => cell.origin === address);
        const positions = selected.length ? selected : projection.ranges(sheet, { start: from, end: from }).map(range => range.start);
        if (!positions.length && (from.row >= (sheet.sourceRowCount ?? sheet.rowCount) || from.col >= (sheet.sourceColCount ?? sheet.colCount))) {
            const mapped = projection.formula(address, sheet);
            if (!mapped.includes("#REF!"))
                positions.push(parseAddress(mapped.replace(/\$/g, "")));
        }
        for (const [copyIndex, position] of positions.entries()) {
            const node = structuredClone(original.node), anchor = anchorOf(node), row = position.row - from.row, col = position.col - from.col;
            if (copyIndex) {
                const ids = new Map<string, string>();
                visit(node, (name, value) => { if (name === "cNvPr") {
                    const old = text(value["@id"]), next = objectId();
                    value["@id"] = next;
                    ids.set(old, next);
                } });
                visit(node, (name, value) => { if (name === "stCxn" || name === "endCxn") {
                    const next = ids.get(text(value["@id"]));
                    if (!next)
                        throw new Error(`${sheet.name}: repeated connector drawing needs an instance connection adapter`);
                    value["@id"] = next;
                } });
            }
            anchor.from.row += row;
            anchor.from.col += col;
            setChild(node, "from", markerXml(anchor.from));
            if (anchor.to) {
                anchor.to.row += row;
                anchor.to.col += col;
                setChild(node, "to", markerXml(anchor.to));
            }
            anchors.push(node);
        }
    }
    // Preserve each anchor's sizing mode rather than coercing two-cell images.
    const root: XmlNode = { ...Object.fromEntries(Object.entries(source?.root ?? {}).filter(([key]) => key.startsWith("@"))), "@xmlns:xdr": "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing", "@xmlns:a": "http://schemas.openxmlformats.org/drawingml/2006/main", "@xmlns:c": "http://schemas.openxmlformats.org/drawingml/2006/chart", "@xmlns:r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships" };
    for (const anchor of anchors) {
        const kind = anchor["xdr:to"] ? "xdr:twoCellAnchor" : "xdr:oneCellAnchor";
        const values = list(root[kind]);
        values.push(anchor);
        root[kind] = values;
    }
    input.write(path, { "xdr:wsDr": root });
    input.write(relPathFor(path), { Relationships: { "@xmlns": "http://schemas.openxmlformats.org/package/2006/relationships", Relationship: rels } });
    input.contentType(path, "application/vnd.openxmlformats-officedocument.drawing+xml");
    let id = "rIdReportDrawing";
    while (input.relationships.some(rel => rel["@Id"] === id))
        id += "_";
    input.relationships.push({ "@Id": id, "@Type": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing", "@Target": relativePart(input.sheetPath, path) });
    worksheet.drawing = { "@r:id": id };
}
