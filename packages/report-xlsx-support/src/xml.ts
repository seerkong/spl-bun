import { XMLBuilder, XMLParser, XMLValidator } from "fast-xml-parser";

export type XmlNode = Record<string, unknown>;
const xmlOptions = { ignoreAttributes: false, attributeNamePrefix: "@", parseTagValue: false,
  parseAttributeValue: false, trimValues: false, processEntities: true };

export function parseXml(text: string): XmlNode {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("XML DTD/entities are not supported in report templates");
  const valid = XMLValidator.validate(text);
  if (valid !== true) throw new Error(`Invalid template XML: ${valid.err.msg}`);
  // In this parser version numeric character references are enabled through
  // htmlEntities. Excel uses them for line breaks inside drawing descriptions.
  return new XMLParser({ ...xmlOptions, htmlEntities: true }).parse(text) as XmlNode;
}
export function buildXml(node: XmlNode): string {
  return new XMLBuilder({ ...xmlOptions, suppressEmptyNode: true }).build(node);
}
export function object(value: unknown): XmlNode {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as XmlNode : {};
}
export function list(value: unknown): unknown[] { return value === undefined ? [] : Array.isArray(value) ? value : [value]; }
export function text(value: unknown): string {
  return value === null || value === undefined ? "" : typeof value === "object" ? text(object(value)["#text"]) : String(value);
}
