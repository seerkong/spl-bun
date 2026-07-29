import type { TemplateCell } from "depa-data-report-contract";
import { list, object, parseXml, text, type XmlNode } from "./xml";
import * as XLSX from "xlsx";

const color = (value: unknown): string | undefined => {
  const rgb = text(object(value)["@rgb"]);
  return /^(?:[0-9a-f]{2})?[0-9a-f]{6}$/i.test(rgb) ? `#${rgb.slice(-6)}` : undefined;
};
export function readStyles(xml: string | undefined): Array<Pick<TemplateCell, "numberFormat" | "css">> {
  if (!xml) return [];
  const root = object(parseXml(xml).styleSheet);
  const fonts = list(object(root.fonts).font).map(object);
  const fills = list(object(root.fills).fill).map(object);
  const borders = list(object(root.borders).border).map(object);
  const formats = new Map(list(object(root.numFmts).numFmt).map((v) => {
    const n = object(v); return [Number(n["@numFmtId"]), text(n["@formatCode"])];
  }));
  return list(object(root.cellXfs).xf).map((value) => {
    const xf = object(value);
    const font = fonts[Number(xf["@fontId"] ?? 0)] ?? {};
    const fill = object(fills[Number(xf["@fillId"] ?? 0)]?.patternFill);
    const border = borders[Number(xf["@borderId"] ?? 0)] ?? {};
    const alignment = object(xf.alignment);
    const css: Record<string, string> = {};
    const setColor = (key: string, source: unknown) => { const c = color(source); if (c) css[key] = c; };
    setColor("color", font.color);
    if (fill["@patternType"] === "solid") setColor("background-color", fill.fgColor);
    if (font.b !== undefined) css["font-weight"] = "bold";
    if (font.i !== undefined) css["font-style"] = "italic";
    if (font.u !== undefined) css["text-decoration"] = "underline";
    const size = Number(object(font.sz)["@val"]);
    if (Number.isFinite(size) && size > 0 && size < 200) css["font-size"] = `${size}pt`;
    const name = text(object(font.name)["@val"]);
    if (name) css["font-family"] = JSON.stringify(name).replace(/</g, "\\3c ");
    const horizontal = text(alignment["@horizontal"]);
    if (["left", "center", "right", "justify"].includes(horizontal)) css["text-align"] = horizontal;
    const vertical = text(alignment["@vertical"]);
    if (["top", "center", "bottom"].includes(vertical)) css["vertical-align"] = vertical === "center" ? "middle" : vertical;
    if (alignment["@wrapText"] === "1") css["white-space"] = "pre-wrap";
    for (const side of ["left", "right", "top", "bottom"]) {
      const edge: XmlNode = object(border[side]);
      const style = text(edge["@style"]);
      if (style) css[`border-${side}`] = `${style === "thick" ? 3 : style === "medium" ? 2 : 1}px ${style === "dashed" ? "dashed" : style === "dotted" ? "dotted" : style === "double" ? "double" : "solid"} ${color(edge.color) ?? "#666"}`;
    }
    const formatId=Number(xf["@numFmtId"]);
    return { css, numberFormat: formats.get(formatId)??XLSX.SSF.get_table()[formatId] };
  });
}
