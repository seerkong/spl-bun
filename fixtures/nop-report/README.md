# nop-report 的七个复杂工作簿

每个编号目录都有可直接使用的 Excel 模板 `template.xlsx`、网页报表入口接受的 `data.json` 和从上游测试快照提取的 `expected.json`。在项目根目录执行以下命令。生成器调用网页后端的报表 worker，并在系统临时目录创建一个新目录，包含浏览入口、每个案例的输入和输出。

```sh
bun scripts/render-nop-examples.ts
bun test packages/report-xlsx-support/__tests__/nop-examples.test.ts
```

| 编号 | 模板与观察点 |
|---|---|
| 05 | 17 个月跨年分组、环比与同比、占比、排名、分年及跨年累计，保留月份显示文字。 |
| 11 | 两个浮动绘图对象和两个单元格分别生成 Code 128 和 QR Code，随 XLSX 一起导出。 |
| 13、14 | 同一设备的两份应急文档从嵌套记录取值，分别横向和纵向展开，对照两种方向的父格及合并。 |
| 15 | 66 条药房库存记录，按医院、院区和药房向下分组，按药品类别和子类向右展开，核对跨行跨列范围。 |
| 16 | 两个数据源在同页独立展开，保留模板跨区引用，上下两个汇总位置 I7、I12 均显示 3870。 |
| 17 | 一张模板产生苹果和香蕉两个工作表，各自从该表记录推导属性列和对应值。 |

## 来源和适配

来源为 [nop-entropy 的 nop-report-demo](https://github.com/entropy-cloud/nop-entropy/tree/490955799d/nop-report/nop-report-demo)，本地源码版本 `490955799d`。工作簿来自 `src/main/resources/_vfs/nop/report/demo/base` 同编号文件。对应测试为 `TestReportDemoBizModel`；预期表格来自其 `_cases/io/nop/report/demo/TestReportDemoBizModel/testReport/output/base` 快照。

11 保留原始输入工作簿。其余六例将上游“展开前”脚本里的数组外置为 JSON，并移除配置表中该脚本的调用单元格。17 额外将各组首条记录的属性键存入 `columns`，并将单元格注解中的 Java Map 访问改用 SPL 的 `field`。工作簿、数据与派生快照沿用随附的 Apache 2.0 许可与上游 NOTICE。

回归逐表比较尺寸、全部非空位置的显示文字（忽略首尾空白）和合并范围，并重新打开生成的 XLSX 检查合并与关键单元格。11 另核对图片编码请求和导出图像。上游 HTML 快照不包含可作为像素基准的码图；本组测试不评估字体、打印分页及像素级排版。
