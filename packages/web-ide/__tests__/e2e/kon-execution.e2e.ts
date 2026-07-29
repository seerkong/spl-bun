import { test, expect } from "@playwright/test";
import { startBackend, startFrontend, waitForDemoLoad, selectDemo, runScript, getGridData } from "./helpers";

test("native window demo computes independent running metrics in the Web IDE", async ({ page }) => {
  await page.goto("/");
  await waitForDemoLoad(page);
  await selectDemo(page, "Window: Partition, Rank and Running Values");
  await runScript(page);
  const { columns, rows } = await getGridData(page);
  expect(columns).toContain("running_amount");
  expect(columns).toContain("mean_sale_id");
  const first = Object.fromEntries(columns.map((column, index) => [column, rows[0][index]]));
  expect(Number(first.row_no)).toBe(1);
  expect(Number(first.running_amount)).toBe(Number(first.amount));
  expect(Number(first.mean_sale_id)).toBe(Number(first.id));
});

test.beforeAll(async () => {
  await startBackend();
  await startFrontend();
});

test("kon runs sequence demos and returns rows", async ({ page }) => {
  await page.goto("/");
  await waitForDemoLoad(page);

  await selectDemo(page, "Sequence Select");
  await runScript(page);
  const selectGrid = await getGridData(page);
  expect(selectGrid.rows.length).toBeGreaterThan(0);

  await selectDemo(page, "Sequence Sort");
  await runScript(page);
  const sortGrid = await getGridData(page);
  expect(sortGrid.rows.length).toBeGreaterThan(0);
});

test("kon runs file demos and returns rows", async ({ page }) => {
  await page.goto("/");
  await waitForDemoLoad(page);

  await selectDemo(page, "CSV Import");
  await runScript(page);
  const csvGrid = await getGridData(page);
  expect(csvGrid.columns).toContain("region");
  expect(csvGrid.rows.length).toBeGreaterThan(0);

  await selectDemo(page, "JSON Processing");
  await runScript(page);
  const jsonGrid = await getGridData(page);
  expect(jsonGrid.columns).toContain("label");
  expect(jsonGrid.rows.length).toBeGreaterThan(0);
});

test("kon runs SQL pagination and expression demos", async ({ page }) => {
  await page.goto("/");
  await waitForDemoLoad(page);

  await selectDemo(page, "SQL Pagination");
  await runScript(page);
  const cursorGrid = await getGridData(page);
  expect(cursorGrid.rows.length).toBeGreaterThan(0);

  await selectDemo(page, "Expressions: String (like/regex)");
  await runScript(page);
  const stringGrid = await getGridData(page);
  expect(stringGrid.columns).toEqual(["name", "value"]);
  expect(stringGrid.rows.map((row) => row[0])).toContain("like(hello, he*o)");

  await selectDemo(page, "Expressions: Math (exp/ln/sign/gcd/lcm)");
  await runScript(page);
  const mathGrid = await getGridData(page);
  expect(mathGrid.columns).toEqual(["name", "value"]);
  expect(mathGrid.rows.map((row) => row[0])).toContain("gcd([12,18])");

  await selectDemo(page, "Expressions: Date (age/workday/workdays)");
  await runScript(page);
  const dateGrid = await getGridData(page);
  expect(dateGrid.columns).toEqual(["name", "value"]);
  expect(dateGrid.rows.map((row) => row[0])).toContain("age(default)");
});

test("uploaded data uses pivot/unpivot and compound aggregates in the real Web query path",async({page})=>{
  await page.goto("/");
  await waitForDemoLoad(page);
  await page.getByTestId("table-file").setInputFiles({name:"sales.csv",mimeType:"text/csv",buffer:Buffer.from("k,m,v\nA,Jan,10\nA,Jan,5\nA,Feb,20\nB,Feb,7")});
  await expect(page.getByTestId("import-status")).toContainText("4 行");
  const pivot='(spl_pivot #wide :{in=input keys=[k] category=m value=v reducer=sum})';
  await page.locator(".kon-editor").fill(pivot+"\nwide");
  await runScript(page);
  const wide=await getGridData(page);
  expect(wide.columns).toEqual(["k","Jan","Feb"]);
  expect(wide.rows[0]).toEqual(["A","15","20"]);
  expect(wide.rows[1][2]).toBe("7");
  await page.locator(".kon-editor").fill(pivot+'\n(spl_unpivot #long :{in=wide keys=[k] columns=[Jan Feb]})\n(spl_groups :{in=long agg={total="sum(value)" n="count(value)" ratio="if(0,sum(value)/count(value),999)"}})');
  await runScript(page);
  expect((await getGridData(page)).rows).toEqual([["42","3","14"]]);
  await page.locator(".kon-editor").fill('(spl_eval :{expr="input.cursor().fetch(1)"})');
  expect(await runScript(page,"error")).toContain("async");
});

test('JSON exact identifiers, decimal calculations and source calendar options reach the web grid',async({page})=>{
 await page.goto('/');await waitForDemoLoad(page);
 await page.getByTestId('table-file').setInputFiles({name:'exact.json',mimeType:'application/json',buffer:Buffer.from('[{"id":9007199254740993,"amount":"0.1"},{"id":9007199254740994,"amount":"0.2"}]')});
 await expect(page.getByTestId('import-status')).toContainText('2 行');
 const source='(spl_eval #priced :{expr="input.derive(long(id)+1:next,decimal(amount)*rate:total,day(elapse@m(datetime(2024,2,29),1)):monthEnd)" with={rate=3}})';
 await page.locator('.kon-editor').fill(source+'\npriced');await runScript(page);
 const data=await getGridData(page);const cells=data.rows.map(row=>Object.fromEntries(data.columns.map((name,index)=>[name,row[index]])));
 expect(cells.map(row=>row.id)).toEqual(['9007199254740993','9007199254740994']);
 expect(cells.map(row=>row.next)).toEqual(['9007199254740994','9007199254740995']);
 expect(cells.map(row=>row.total)).toEqual(['0.3','0.6']);expect(cells.map(row=>row.monthEnd)).toEqual(['31','31']);
 await page.locator('.kon-editor').fill(source+'\n(spl_groups :{in=priced agg={total="sum(total)" mean="avg(total)"}})');await runScript(page);
 const result=await getGridData(page);expect(result.rows[0]).toEqual(['0.9','0.45']);
 await page.locator('.kon-editor').fill(source+'\n(spl_window :{in=priced by=next outputs={lag=[{column=total as=previous}] frames=[{kind=sum column=total as=moving start=-1 end=0} {kind=avg column=total as=mean start=null end=0}]}})');await runScript(page);
 const window=await getGridData(page);const values=window.rows.map(row=>Object.fromEntries(window.columns.map((name,index)=>[name,row[index]])));
 expect(values.map(row=>row.moving)).toEqual(['0.3','0.9']);expect(values.map(row=>row.mean)).toEqual(['0.3','0.45']);expect(values[1].previous).toBe('0.3');
 await page.locator('.kon-editor').fill(`(spl_eval :{expr="input.derive(format('%d: %.2f',long(id),decimal(amount)):label)"})`);await runScript(page);
 const formatted=await getGridData(page);expect(formatted.rows.map(row=>row[formatted.columns.indexOf('label')])).toEqual(['9007199254740993: 0.10','9007199254740994: 0.20']);
 await page.locator('.kon-editor').fill(`(spl_eval :{expr="input.derive(parse(id):parsed,parse@n(concat(amount,'kg')):numeric).sort@z(long(parsed))"})`);await runScript(page);
 const sorted=await getGridData(page);
 expect(sorted.rows.map(row=>row[sorted.columns.indexOf('parsed')])).toEqual(['9007199254740994','9007199254740993']);
 expect(sorted.rows.map(row=>row[sorted.columns.indexOf('numeric')])).toEqual(['0.2','0.1']);
 await page.locator('.kon-editor').fill(`(spl_eval :{expr="input.derive(string(parse('+NaN')):signedNan,string(parse('-NaN')):negativeNan,string(parse('NaN%')):nanPercent,string(parse('Infinity%')):positiveInfinity,string(parse('-Infinity%')):negativeInfinity)"})`);await runScript(page);
 const nonfinite=await getGridData(page);
 for(const row of nonfinite.rows)expect(['signedNan','negativeNan','nanPercent','positiveInfinity','negativeInfinity'].map(name=>row[nonfinite.columns.indexOf(name)])).toEqual(['NaN','NaN','NaN','Infinity','-Infinity']);
});
