import { renderBarcode } from "../../../../../packages/report-xlsx-support/src/barcode";

const directory = process.argv[2];
if (!directory) throw new Error("Pass a temporary output directory");
const cases = {
  QR_CODE: "123459V", CODE_128: "123459V", CODE_39: "ABC123", CODE_93: "ABC123",
  EAN_13: "1234567890128", EAN_8: "12345670", UPC_A: "123456789012", UPC_E: "04252614",
  ITF: "1234567890", CODABAR: "A123459A", DATA_MATRIX: "123459V", AZTEC: "123459V", PDF_417: "123459V",
};
for (const [format, content] of Object.entries(cases)) {
  await Bun.write(`${directory}/${format}.png`, renderBarcode({ content, format, width: 420, height: 200 }).bytes);
}
for (const format of ["CODE_39","CODE_93"]) await Bun.write(`${directory}/${format}_lower.png`,renderBarcode({content:"Abc123",format,width:420,height:200}).bytes);
await Bun.write(`${directory}/QR_CODE_utf8.png`,renderBarcode({content:"中文报表",format:"QR_CODE",width:420,height:200,options:{encoding:"UTF-8"}}).bytes);
