import type { ChartReference, RenderedChart } from "depa-data-report-contract";
import { list, object, text, type XmlNode } from "./xml";
function key(node: XmlNode, name: string, prefix = "c"): string { return Object.keys(node).find(key => key.split(":").pop() === name) ?? `${prefix}:${name}`; }
function child(node: XmlNode, name: string): unknown { return node[key(node, name)]; }
function ensure(node: XmlNode, name: string): XmlNode { const nameKey = key(node, name); if (node[nameKey] === undefined)
    node[nameKey] = {}; return object(node[nameKey]); }
function findText(node: unknown): string {
    if (!node || typeof node !== "object")
        return "";
    if (Array.isArray(node))
        return node.map(findText).join("");
    return Object.entries(object(node)).map(([name, value]) => name.split(":").pop() === "t" ? text(value) : name.startsWith("@") ? "" : findText(value)).join("");
}
interface Entry {
    reference: ChartReference;
    holder: XmlNode;
    isTitle: boolean;
    removeEmpty(): void;
}
export function chartEntries(doc: XmlNode): {
    references: Entry[];
    series: {
        parent: XmlNode;
        key: string;
        nodes: XmlNode[];
        indices: number[];
    }[];
    chart: XmlNode;
    space: XmlNode;
    axes: XmlNode[];
} {
    const axes: XmlNode[] = [];
    const space = object(doc[key(doc, "chartSpace")]), chart = ensure(space, "chart"), plot = ensure(chart, "plotArea"), references: Entry[] = [], groups: {
        parent: XmlNode;
        key: string;
        nodes: XmlNode[];
        indices: number[];
    }[] = [];
    function add(parent: XmlNode, name: string, reference: ChartReference, isTitle = false): void {
        const nameKey = key(parent, name), created = parent[nameKey] === undefined, container = ensure(parent, name), holder = isTitle ? ensure(container, "tx") : container;
        const ref = object(child(holder, "numRef") ?? child(holder, "strRef")), formula = text(child(ref, "f")) || undefined;
        const direct = text(child(holder, "v")) || findText(child(holder, "rich")) || undefined;
        references.push({ reference: { ...reference, formula, text: direct }, holder, isTitle, removeEmpty() { if (created)
                delete parent[nameKey]; } });
    }
    add(chart, "title", { id: "title", kind: "title" }, true);
    let seriesIndex = 0, axisIndex = 0;
    for (const [plotKey, values] of Object.entries(plot))
        for (const [typeIndex, value] of list(values).entries()) {
            if (plotKey.startsWith("@"))
                continue;
            const node = object(value), serKey = key(node, "ser"), series = list(node[serKey]).map(object), indices: number[] = [];
            if (series.length) {
                groups.push({ parent: node, key: serKey, nodes: series, indices });
                for (const ser of series) {
                    const index = seriesIndex++;
                    indices.push(index);
                    const id = `${plotKey}:${typeIndex}/series:${index}`;
                    add(ser, "tx", { id: `${id}/name`, kind: "seriesName", seriesIndex: index });
                    for (const [name, kind] of [["cat", "seriesCategory"], ["xVal", "seriesCategory"], ["val", "seriesData"], ["yVal", "seriesData"], ["bubbleSize", "seriesData"]] as const)
                        if (child(ser, name) !== undefined)
                            add(ser, name, { id: `${id}/${name}`, kind, seriesIndex: index });
                }
            }
            if (/(?:cat|val|date|ser)Ax$/.test(plotKey)) {
                axes.push(node);
                const index = axisIndex++;
                add(node, "title", { id: `${plotKey}:${typeIndex}/title`, kind: "axisTitle", axisIndex: index }, true);
                if (child(node, "data") !== undefined)
                    add(node, "data", { id: `${plotKey}:${typeIndex}/data`, kind: "axisData", axisIndex: index });
            }
        }
    return { references, series: groups, chart, space, axes };
}
function ordered(node: XmlNode, names: readonly string[]): void {
    const entries = Object.entries(node).sort(([a], [b]) => {
        const rank = (value: string) => value.startsWith("@") ? -1 : names.includes(value.split(":").pop()!) ? names.indexOf(value.split(":").pop()!) : names.length;
        return rank(a) - rank(b);
    });
    for (const name of Object.keys(node))
        delete node[name];
    Object.assign(node, Object.fromEntries(entries));
}
export function projectChartXml(doc: XmlNode, chart: RenderedChart): void {
    const entries = chartEntries(doc), references = new Map(chart.references.map(reference => [reference.id, reference]));
    for (const entry of entries.references) {
        const reference = references.get(entry.reference.id);
        if (!reference)
            continue;
        const holder = entry.holder;
        if (reference.formula) {
            const numeric = child(holder, "numRef") !== undefined || reference.kind === "seriesData" || reference.kind === "axisData", refName = numeric ? "numRef" : "strRef", cacheName = numeric ? "numCache" : "strCache";
            const ref = object(child(holder, refName));
            for (const name of ["numRef", "strRef", "numLit", "strLit", "rich", "v"])
                delete holder[key(holder, name)];
            ref[key(ref, "f")] = reference.formula.replace(/^=/, "");
            const previous = object(child(ref, cacheName)), values = reference.values ?? [];
            const points = values.flatMap((value, index) => {
                if (value == null)
                    return [];
                const scalar = value instanceof Date ? value.getTime() / 86400000 + 25569 : value;
                if (numeric && (typeof scalar !== "number" || !Number.isFinite(scalar)))
                    return [];
                return [{ "@idx": String(index), "c:v": String(scalar) }];
            });
            const preserved = Object.fromEntries(Object.entries(previous).filter(([name]) => !["pt", "ptCount", "formatCode"].includes(name.split(":").pop()!)));
            ref[key(ref, cacheName)] = { ...preserved, ...numeric ? { "c:formatCode": text(child(previous, "formatCode")) || "General" } : {}, "c:ptCount": { "@val": String(values.length) }, "c:pt": points };
            holder[key(holder, refName)] = ref;
        }
        else if (reference.text !== undefined) {
            for (const name of ["numRef", "strRef", "numLit", "strLit"])
                delete holder[key(holder, name)];
            if (entry.isTitle) {
                const rich = object(child(holder, "rich"));
                // Preserve paragraph/run style while replacing textual content.
                let assigned = false;
                function replace(node: XmlNode): void { for (const [name, value] of Object.entries(node)) {
                    if (name.split(":").pop() === "t") {
                        node[name] = assigned ? "" : reference!.text;
                        assigned = true;
                    }
                    else if (!name.startsWith("@"))
                        for (const child of list(value))
                            if (child && typeof child === "object")
                                replace(object(child));
                } }
                replace(rich);
                if (!assigned)
                    Object.assign(rich, { "a:bodyPr": {}, "a:lstStyle": {}, "a:p": { "a:r": { "a:t": reference.text } } });
                holder[key(holder, "rich")] = rich;
            }
            else
                holder[key(holder, "v")] = reference.text;
        }
        else
            entry.removeEmpty();
    }
    for (const group of entries.series) {
        group.parent[group.key] = group.nodes.filter((_node, index) => !chart.hiddenSeries?.includes(group.indices[index]));
        for (const ser of group.nodes)
            ordered(ser, ["idx", "order", "tx", "spPr", "invertIfNegative", "pictureOptions", "marker", "explosion", "dPt", "dLbls", "trendline", "errBars", "cat", "val", "xVal", "yVal", "bubbleSize", "bubble3D", "smooth", "shape", "extLst"]);
    }
    for (const axis of entries.axes) {
        if (child(axis, "title"))
            ordered(object(child(axis, "title")), ["tx", "layout", "overlay", "spPr", "txPr", "extLst"]);
        ordered(axis, ["axId", "scaling", "delete", "axPos", "majorGridlines", "minorGridlines", "title", "numFmt", "majorTickMark", "minorTickMark", "tickLblPos", "spPr", "txPr", "crossAx", "crosses", "crossesAt", "auto", "lblAlgn", "lblOffset", "tickLblSkip", "tickMarkSkip", "noMultiLvlLbl", "crossBetween", "majorUnit", "minorUnit", "dispUnits", "extLst"]);
    }
    delete entries.space[key(entries.space, "externalData")];
    if (child(entries.chart, "title"))
        ordered(object(child(entries.chart, "title")), ["tx", "layout", "overlay", "spPr", "txPr", "extLst"]);
    ordered(entries.chart, ["title", "autoTitleDeleted", "pivotFmts", "view3D", "floor", "sideWall", "backWall", "plotArea", "legend", "plotVisOnly", "dispBlanksAs", "showDLblsOverMax", "extLst"]);
}
