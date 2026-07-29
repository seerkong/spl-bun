import type { ReportImageData } from "depa-data-report-contract";
const mimeTypes = new Set(["image/png", "image/jpeg", "image/gif", "image/bmp"]);
/** Accept values, never file paths or service handles. Copy byte buffers at the
 * boundary so an encoder or evaluator cannot alter caller-owned image data.
 */
export function imageData(value: unknown, fallback?: ReportImageData): ReportImageData | undefined {
    if (value == null)
        return undefined;
    const input = value instanceof Uint8Array || Array.isArray(value) ? { bytes: value, mimeType: fallback?.mimeType } : value;
    if (!input || typeof input !== "object")
        throw new Error("Image data must contain explicit bytes and mimeType");
    const { bytes, mimeType } = input as {
        bytes?: unknown;
        mimeType?: unknown;
    };
    if (typeof mimeType !== "string" || !mimeTypes.has(mimeType))
        throw new Error(`Unsupported image mimeType ${String(mimeType)}`);
    if (!(bytes instanceof Uint8Array) && !(Array.isArray(bytes) && bytes.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)))
        throw new Error("Image bytes must be Uint8Array or byte array");
    if (!bytes.length || bytes.length > 5 * 1024 * 1024)
        throw new Error("Image bytes must contain 1..5 MiB");
    return { bytes: new Uint8Array(bytes), mimeType: mimeType as ReportImageData["mimeType"] };
}
