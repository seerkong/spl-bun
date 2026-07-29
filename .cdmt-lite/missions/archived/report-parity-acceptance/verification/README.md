# Independent barcode verification

From the repository root (Bun, JDK and the pre-existing local ZXing 3.5.0 cache):

```sh
bun .cdmt-lite/missions/archived/report-parity-acceptance/verification/barcode-formats.ts /private/tmp/spl-report-barcode-verify
javac -cp /Users/kongweixian/.m2/repository/com/google/zxing/core/3.5.0/core-3.5.0.jar -d /private/tmp/spl-report-barcode-verify .cdmt-lite/missions/archived/report-parity-acceptance/verification/BarcodeFormats.java
java -cp /private/tmp/spl-report-barcode-verify:/Users/kongweixian/.m2/repository/com/google/zxing/core/3.5.0/core-3.5.0.jar BarcodeFormats /private/tmp/spl-report-barcode-verify
```

Before archiving, replace `archived` with `active`. Java is an independent verifier; the product runs entirely in Bun/TypeScript. All 13 formats must decode to the supplied text. CODABAR omits its start/end guards when decoded. This check initially failed for CODE_93 and proved the mandatory C/K checksums were missing; enabling them fixed the actual decode.
