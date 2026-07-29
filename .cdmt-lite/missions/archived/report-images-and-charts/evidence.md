# Evidence: Excel报表图片条码与图表

- M0 — 源码观察 — genImage明确按每格实例clone、test/dataExpr替换bytes；chartGenerator消费series/category/title/axis引用与条件；直接series数组在该来源仅扩展注释。QRCODE通过服务调用编码，目标改窄runtime端口。

- M1 — 图片垂直切片 — `bun test packages/report-logic packages/report-xlsx-support` exit0：55 pass/281 expects；两个report包typecheck exit0。新真实fixture两sheet×两记录=4图，独立drawing关系、最终B2/B3、offset及40×30尺寸、不同PNG bytes、HTML4图；test false/dataExpr null不生成；maxMediaItems负例与输入bytes不变通过。
- M2 — XML与效果调和 — Excel图片描述用&#10;保存配置换行；当前fast-xml-parser需htmlEntities:true才解码numeric character refs，已在统一XML入口修正并跑回归。typed-array输入已结构克隆，不能Object.freeze非空Uint8Array，跳过view冻结保持调用方不变。barcode端口固定版本依赖缓存缺失，普通安装临时目录PermissionDenied，已申请仅安装bwip-js4.11.4；图片工作不依赖此安装，继续推进。

- M3 — 条码与独立观察 — bwip-js4.11.4固定版本安装成功（先前沙箱临时目录失败，已批准的依赖安装恢复）。同步窄适配只传内容/格式/受限options，PNG编码无文件路径/字体/网络钩子。`bun test .../barcode.test.ts` exit0：2 pass/20 expects；另用缓存ZXing3.5.0独立解码生成PNG：QR_CODE:123459V(320x160)、CODE_128:123459V(320x160)，见verification/BarcodeDecode.java；PNG尺寸/签名/像素与不同内容均验证。
- M4 — 图表/产品垂直切片 — 图表两sheet独立part，East/2 West/5及North/7，范围、cache、样式12/字体/legend/axis title、series条件与chart条件均实际ZIP验证。当前相关回归76 pass/418 expects，13包build exit0；HTTP真实worker二维码端口出两图，空值不出。随后重观察发现seriesTest应对同一series元数据求值一次，不能每个ref使用不同name，已修正；最终回归待重跑。

- M5 — 最后调和与负例 — 不把小单元格QRCODE当错误：与ZXing writer同样按请求最小尺寸补足完整module，合并格尺寸按完整跨度测量，qr:width/height=0取自动尺寸；最终ZXing重解码320×160 QR/Code128及64×29的小QR均读回123459V。坏图片codec错误现带sheet/image位置，真实测试Bad image Photo:invalid通过。

- M6 — 最终目标/结构重观察 — 重建MISSION/AT1对照最终media/charts/barcode/drawing/chart-xml及worker接口，真实媒体数量/位置、公式cache与输入不变均一致。最终相关76 pass/419 expects/17 files，全量383 pass/1153 expects/67 files，13包build全部exit0；Java独立解码三张最终PNG全部exit0。边界检查core无fs/Bun.file/new Function/eval，输入/数量/字节/坏格式与图片位置负例通过。Codument两个SHA256仍7032534669dade50089a0ef4c5bae37c3eab13698df928860f19cf50858b4049、1e608846408dc8e86d15528e4af39701929b13e328499b0d4863581ffbee1b0e。
- M7 — 返回条件复核 — 本mission已验收，但report-parity-acceptance还有M04 cellSet成员和M06显式API、删除后相对层次引用及Web总对账可做；随后仍需SPL三mission，因此不能整体返回。
