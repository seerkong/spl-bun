# Flow、游标与文件

`evaluateFlow(cells, ctx)`执行异步Flow，`evaluateFlowSync`用于同步Kon入口。每次执行拥有自己的连接和游标资源scope，在正常结束、result/end、错误或Abort后释放；调用者通过scope/adapters注入的连接由调用者管理。单独使用`buildFlowScope(ctx)`时，调用者应在finally中`await closeFlowScope(scope)`。

```ts
import { openCsvCursor, openSqliteCursor } from "depa-data-spl-flow";
import { selectCursor, deriveCursor, projectCursor } from "depa-data-core";

const { cursor } = openSqliteCursor({dbPath: "orders.db", sql: "select id, qty, price from orders"});
const output = projectCursor(deriveCursor(selectCursor(cursor, "qty>0"), {total: "qty*price"}), ["id", "total"]);
try {
  const first = await output.fetch(100);
  // 后续fetch继续当前位置；不会重新取第一批。
} finally {
  await output.close();
}
```

内存`DataSet.cursor()`、CSV stream和SQLite statement iterator使用同一个Cursor位置owner。默认fetch最多1024项，可显式设maxBatch（上限65536）；skip不保存跳过的记录。EOF后fetch返回空数组，手动close后fetch报错，close幂等。两个cursor位置独立，同一cursor的并发命令按提交顺序执行。`for await`提前break会关闭上游。select/filter、derive与project惰性执行，derive列按声明顺序可见；已知schema的非法字段在读取前报错。

`openCsvCursor(path, options)`只读取header后返回`{columns,cursor}`，32KiB输入缓冲、单条记录上限1MiB、最多512列，支持引号/换行与001文本保留。`openSqliteCursor`使用独立readonly连接和真实statement iterator；close/EOF/error关闭该连接，不影响调用者的其他连接。两者都有observe端口，可测open/read/close与CSV读取字节。百万行的首批、资源和RSS验证脚本位于cursor mission的verification目录。

sort/group/join/pivot需要显式`await cursor.collect(maxRows)`后再操作表值；超限会报错并关闭cursor。不会自动把整条cursor转为内存表。`signal`与`timeoutMs`控制合作式读取，长skip和连续小批次每1024项让出事件循环；单个不可中断的宿主调用仍由现有worker执行期限负责。取消/超时不会交付迟到批次。

Flow可跨单元格等待cursor：

```text
A1: file("orders.csv").cursor()
A2: A1.select("qty>0").derive({total:"qty*price"}).project(["id","total"])
A3: A2.fetch(100)
A4: result A3
```

配置的SQLite数据源可用`db.cursor("select ...")`。本次Flow的游标在结束时关闭，返回批次供后续展示；需要长生命周期消费时直接使用host cursor API。同步Kon/Flow明确拒绝异步游标，不把Promise显示成成功结果。数组fetch/skip仍保留原slice语义。`FlowExecutionContext.signal`可取消执行，取消后不执行后续文件写入；资源observer只报告本次执行创建的资源。

`file(path)`仅在工作区内提供UTF-8 read、text/bytes write、CSV/TSV/JSON import/export及CSV/TSV cursor。符号链接的真实路径也校验工作区边界。

```text
A1: file("out.csv").export(input)
A2: file("out.csv").import()
A3: file("snapshot.json").export(A2)
A4: file("snapshot.json").import()
```

write/export先完整写同目录临时文件、flush后原子替换，失败清理临时文件并保留原文件。CSV使用同一数值推断策略，001保持文本、普通数字为number；CSV不能额外保留任意数字文本与number的类型区别。JSON export带columns/rows信封以保留空表列，import也接受普通record数组并扫描全部行的列；嵌套对象按JSON规则处理。JSON import、T()和非流式SQL是显式内存读取，未冒称流式JSON。原有T() Excel接口保留。

SPL与报表公式有各自的真值/聚合规则。SPL有限兼容范围和来源对账见[最终矩阵](../../.depa-analysis/report-parity-2026-10-22/spl-acceptance-matrix.md)。
