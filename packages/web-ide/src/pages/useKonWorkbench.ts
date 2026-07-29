import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { apiRoutes, type KonExecuteRequest, type KonExecuteResponse, type QueryResultData,
  type ReportRenderResponse, type TableImportResponse } from "depa-data-web-shared";
import { konDemos } from "./konDemos";

function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }

export function useKonWorkbench(apiBase: string) {
  const status = ref("Idle");
  const selectedDemoId = ref(konDemos[0].id);
  const source = ref(konDemos[0].source);
  const currentData = shallowRef<QueryResultData | null>(null);
  const importedTable = shallowRef<QueryResultData | null>(null);
  const dataFile = shallowRef<File | null>(null);
  const templateFile = shallowRef<File | null>(null);
  const importStatus = ref("");
  const sheetNames = ref<string[]>([]);
  const selectedSheet = ref("");
  const paramsText = ref('{"title":"数据报表"}');
  const reportStatus = ref("");
  const reportHtml = ref("");
  const reportUrl = ref("");
  const running = ref(false), importing = ref(false), rendering = ref(false);
  let runVersion = 0, importVersion = 0, reportVersion = 0;
  let runController: AbortController | undefined;
  let importController: AbortController | undefined;
  let reportController: AbortController | undefined;

  function clearReport(): void {
    reportVersion++;
    reportController?.abort();
    rendering.value = false;
    reportHtml.value = "";
    reportStatus.value = "";
    if (reportUrl.value) URL.revokeObjectURL(reportUrl.value);
    reportUrl.value = "";
  }
  function invalidateRun(): void {
    runVersion++;
    runController?.abort();
    running.value = false;
    currentData.value = null;
    clearReport();
  }
  watch(source, () => { invalidateRun(); status.value = "Ready to run"; }, { flush: "sync" });
  watch([templateFile, paramsText, currentData], clearReport, { flush: "sync" });

  function loadDemo(): void {
    const demo = konDemos.find((item) => item.id === selectedDemoId.value);
    if (!demo) return;
    invalidateRun();
    source.value = demo.source;
    status.value = `Loaded: ${demo.label}`;
  }

  async function runScript(): Promise<void> {
    invalidateRun();
    if (!source.value.trim()) { status.value = "No script to run"; return; }
    const version = runVersion;
    const controller = new AbortController(); runController = controller;
    running.value = true; status.value = "Running...";
    const payload: KonExecuteRequest = { source: source.value,
      ...(importedTable.value ? { tables: { input: importedTable.value } } : {}) };
    try {
      const response = await fetch(`${apiBase}${apiRoutes.executeKon}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
      const result: KonExecuteResponse = await response.json();
      if (version !== runVersion) return;
      if (result.status !== "ok") throw new Error(result.error);
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      currentData.value = result.data ?? { columns: ["result"], rows: [{ result: String(result.result ?? "") }] };
      status.value = result.data ? `Done (${result.data.rows.length} rows)` : "Done (result)";
    } catch (error) {
      if (version !== runVersion || controller.signal.aborted) return;
      currentData.value = null;
      status.value = `Error: ${message(error)}`;
    } finally { if (version === runVersion) running.value = false; }
  }

  function cancelRun(): void { invalidateRun(); status.value = "Cancelled"; }

  async function importDataFile(file = dataFile.value, sheet?: string): Promise<void> {
    if (!file) return;
    importController?.abort();
    const version = ++importVersion;
    const controller = new AbortController(); importController = controller;
    invalidateRun(); importedTable.value = null;
    const sourceAtStart = source.value, runAtStart = runVersion;
    dataFile.value = file; importing.value = true; importStatus.value = "正在读取表格…";
    const form = new FormData(); form.set("file", file); if (sheet) form.set("sheet", sheet);
    try {
      const response = await fetch(`${apiBase}${apiRoutes.importTable}`, { method: "POST", body: form, signal: controller.signal });
      const result: TableImportResponse = await response.json();
      if (version !== importVersion) return;
      if (!response.ok || result.status !== "ok" || !result.data) throw new Error(result.error ?? "无法读取表格");
      importedTable.value = result.data;
      sheetNames.value = result.sheetNames ?? []; selectedSheet.value = result.selectedSheet ?? "";
      importStatus.value = `${file.name} · ${result.data.rows.length} 行 / ${result.data.columns.length} 列 · Kon 变量 input`;
      if (source.value === sourceAtStart && runVersion === runAtStart) {
        source.value = "(spl_select :{ in = input })";
        currentData.value = result.data;
        status.value = `Loaded input (${result.data.rows.length} rows)`;
      }
    } catch (error) {
      if (version !== importVersion || controller.signal.aborted) return;
      sheetNames.value = []; selectedSheet.value = "";
      importStatus.value = `导入失败：${message(error)}`;
    } finally { if (version === importVersion) importing.value = false; }
  }

  function chooseData(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) void importDataFile(file);
  }
  function chooseTemplate(event: Event): void {
    templateFile.value = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  async function renderTemplate(): Promise<void> {
    clearReport();
    const data = currentData.value, file = templateFile.value;
    if (!data || !file) return;
    const version = reportVersion;
    const controller = new AbortController(); reportController = controller;
    try {
      const params: unknown = JSON.parse(paramsText.value);
      if (!params || typeof params !== "object" || Array.isArray(params)) throw new Error("参数须为 JSON 对象");
      const form = new FormData(); form.set("template", file);
      form.set("datasets", JSON.stringify({ result: data.rows, ...(importedTable.value ? { input: importedTable.value.rows } : {}) }));
      form.set("params", JSON.stringify(params));
      rendering.value = true; reportStatus.value = "正在渲染…";
      const response = await fetch(`${apiBase}${apiRoutes.renderReport}`, { method: "POST", body: form, signal: controller.signal });
      const result: ReportRenderResponse = await response.json();
      if (version !== reportVersion) return;
      if (!response.ok || result.status !== "ok" || !result.html || !result.xlsxBase64) throw new Error(result.error ?? "报表渲染失败");
      const bytes = Uint8Array.from(atob(result.xlsxBase64), (char) => char.charCodeAt(0));
      reportUrl.value = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      reportHtml.value = result.html;
      reportStatus.value = `渲染完成 · ${result.sheets?.map((sheet) => `${sheet.name} ${sheet.rows}×${sheet.columns}`).join(" / ") ?? ""}`;
    } catch (error) {
      if (version !== reportVersion || controller.signal.aborted) return;
      reportStatus.value = `渲染失败：${message(error)}`;
    } finally { if (version === reportVersion) rendering.value = false; }
  }
  function cancelReport(): void { clearReport(); reportStatus.value = "已取消渲染"; }

  onBeforeUnmount(() => { runController?.abort(); importController?.abort(); clearReport(); });
  return { status, selectedDemoId, source, currentData, importStatus, sheetNames, selectedSheet,
    paramsText, templateFile, reportStatus, reportHtml, reportUrl, running, importing, rendering,
    resultColumns: computed(() => currentData.value?.columns ?? []), resultRows: computed(() => currentData.value?.rows ?? []),
    templateDownloadUrl: computed(() => `${apiBase}${apiRoutes.reportTemplate}?columns=${encodeURIComponent(JSON.stringify(currentData.value?.columns ?? []))}`),
    loadDemo, runScript, cancelRun, importDataFile, chooseData, chooseTemplate, renderTemplate, cancelReport };
}
