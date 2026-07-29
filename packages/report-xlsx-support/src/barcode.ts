import bwip from "bwip-js/generic";
import { deflateSync } from "node:zlib";
import type { BarcodeRequest, ReportImageData } from "depa-data-report-contract";
function pngChunk(type: string, data: Uint8Array): Buffer {
    const content = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of content) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++)
            crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    const header = Buffer.alloc(4), tail = Buffer.alloc(4);
    header.writeUInt32BE(data.length);
    tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([header, content, tail]);
}
/** Synchronous, bounded PNG adapter over the encoder's module/bar output. No
 * file paths, fonts, network calls or third-party drawing hooks enter this port.
 */
export function renderBarcode(request: BarcodeRequest): ReportImageData {
    const { content } = request;
    let { width, height } = request;
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > 2048 || height > 2048)
        throw new Error("Barcode dimensions must be integers in 1..2048 pixels");
    if (!content || new TextEncoder().encode(content).length > 4096)
        throw new Error("Barcode content must contain 1..4096 UTF-8 bytes");
    const options = request.options ?? {};
    for (const key of Object.keys(options))
        if (!["margin", "encoding", "errorCorrection", "imgType"].includes(key))
            throw new Error(`Unsupported barcode option ${key}`);
    if (options.imgType !== undefined && String(options.imgType).toLowerCase() !== "png")
        throw new Error("Barcode output imgType must be png");
    if (options.encoding !== undefined && !/^utf-?8$/i.test(String(options.encoding)))
        throw new Error("Barcode encoding must be UTF-8");
    const format = request.format.toUpperCase().replace(/[^A-Z0-9]/g, ""), aliases: Record<string, string> = { QRCODE: "qrcode", CODE128: "code128", CODE39: "code39ext", CODE93: "code93ext", EAN13: "ean13", EAN8: "ean8", UPCA: "upca", UPCE: "upce", ITF: "interleaved2of5", CODABAR: "rationalizedCodabar", DATAMATRIX: "datamatrix", AZTEC: "azteccode", PDF417: "pdf417" };
    const bcid = aliases[format];
    if (!bcid)
        throw new Error(`Unsupported barcode format ${request.format}`);
    const correction: Record<string, string> = { "0": "M", "1": "L", "2": "H", "3": "Q", L: "L", M: "M", Q: "Q", H: "H" };
    const level = correction[String(options.errorCorrection ?? "M").toUpperCase()];
    if (!level)
        throw new Error("Invalid barcode errorCorrection");
    const margin = options.margin === undefined ? (format === "QRCODE" ? 4 : 10) : Number(options.margin);
    if (!Number.isInteger(margin) || margin < 0 || margin > 64)
        throw new Error("Barcode margin must be an integer in 0..64");
    // Code 93 requires both C/K check characters. Code 39's checksum is
    // optional and is not enabled by the source ZXing writer.
    const raw = bwip.raw({ bcid, text: content, ...format === "QRCODE" ? { eclevel: level } : {}, ...format === "CODE93" ? { includecheck: true } : {} });
    if (raw.length !== 1)
        throw new Error(`Composite barcode ${request.format} requires a dedicated adapter`);
    const symbol = raw[0];
    // As with ZXing's writer, requested dimensions are a minimum. Preserve
    // complete modules when a normal-height worksheet cell is smaller than QR.
    if ("pixs" in symbol) {
        width = Math.max(width, symbol.pixx + 2 * margin);
        height = Math.max(height, symbol.pixy + 2 * margin);
    }
    else
        width = Math.max(width, symbol.sbs.reduce((sum, value) => sum + value, 0) + 2 * margin);
    if (width > 2048 || height > 2048)
        throw new Error("Encoded barcode dimensions exceed 2048 pixels");
    const stride = width * 4 + 1, pixels = Buffer.alloc(stride * height, 255);
    for (let y = 0; y < height; y++)
        pixels[y * stride] = 0;
    function rectangle(x: number, y: number, w: number, h: number): void {
        for (let row = Math.max(0, Math.round(y)); row < Math.min(height, Math.round(y + h)); row++)
            for (let col = Math.max(0, Math.round(x)); col < Math.min(width, Math.round(x + w)); col++) {
                const offset = row * stride + 1 + col * 4;
                pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
            }
    }
    if ("pixs" in symbol) {
        const scale = Math.floor(Math.min(width / (symbol.pixx + 2 * margin), height / (symbol.pixy + 2 * margin)));
        if (scale < 1)
            throw new Error("Barcode dimensions are too small for the encoded modules");
        const x = Math.floor((width - symbol.pixx * scale) / 2), y = Math.floor((height - symbol.pixy * scale) / 2);
        for (let row = 0; row < symbol.pixy; row++)
            for (let col = 0; col < symbol.pixx; col++)
                if (symbol.pixs[row * symbol.pixx + col])
                    rectangle(x + col * scale, y + row * scale, scale, scale);
    }
    else {
        const units = symbol.sbs.reduce((sum, value) => sum + value, 0), scale = Math.floor(width / (units + 2 * margin));
        if (scale < 1)
            throw new Error("Barcode width is too small for the encoded bars");
        let x = Math.floor((width - units * scale) / 2);
        const yMargin = Math.min(10, Math.floor(height / 10)), barArea = height - 2 * yMargin, maxHeight = Math.max(...symbol.bhs.map((height, index) => height + symbol.bbs[index]));
        for (let index = 0; index < symbol.sbs.length; index++) {
            if (index % 2 === 0) {
                const bar = index / 2, h = barArea * symbol.bhs[bar] / maxHeight, bottom = barArea * symbol.bbs[bar] / maxHeight;
                rectangle(x, height - yMargin - bottom - h, symbol.sbs[index] * scale, h);
            }
            x += symbol.sbs[index] * scale;
        }
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header[8] = 8;
    header[9] = 6;
    return { mimeType: "image/png", bytes: Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(pixels)), pngChunk("IEND", new Uint8Array())]) };
}
