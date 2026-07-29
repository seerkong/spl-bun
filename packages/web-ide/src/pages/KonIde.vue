<script setup lang="ts">
import ResultTable from "../components/ResultTable.vue";
import { konDemos } from "./konDemos";
import { useKonWorkbench } from "./useKonWorkbench";

const { status, selectedDemoId, source, currentData, importStatus, sheetNames, selectedSheet,
  paramsText, templateFile, reportStatus, reportHtml, reportUrl, running, importing, rendering,
  resultColumns, resultRows, templateDownloadUrl, loadDemo, runScript, cancelRun, importDataFile,
  chooseData, chooseTemplate, renderTemplate, cancelReport } = useKonWorkbench(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4176");
</script>

<template>
  <div class="page">
    <div class="toolbar">
      <button class="run-btn" :disabled="running || importing" @click="runScript">Run Script</button>
      <button v-if="running" class="cancel-btn" @click="cancelRun">Cancel</button>
      <div class="demo-controls">
        <label for="demoSelect">Load Demo</label>
        <select id="demoSelect" v-model="selectedDemoId" @change="loadDemo">
          <option v-for="demo in konDemos" :key="demo.id" :value="demo.id">
            {{ demo.label }} - {{ demo.description }}
          </option>
        </select>
        <button class="load-btn" @click="loadDemo">Load Demo</button>
      </div>
      <span class="status">{{ status }}</span>
    </div>

    <div class="import-card">
      <label for="tableFile">导入表格</label>
      <input id="tableFile" data-testid="table-file" type="file" accept=".csv,.tsv,.json,.xlsx,.xls" @change="chooseData">
      <select v-if="sheetNames.length > 1" v-model="selectedSheet" aria-label="Excel data sheet" @change="importDataFile(undefined, selectedSheet)">
        <option v-for="sheet in sheetNames" :key="sheet" :value="sheet">{{ sheet }}</option>
      </select>
      <span data-testid="import-status">{{ importStatus || 'CSV / JSON / Excel，读取后可在 Kon 中使用 input' }}</span>
    </div>

    <div class="section">
      <textarea
        class="kon-editor"
        v-model="source"
        aria-label="Kon source editor"
        spellcheck="false"
      ></textarea>
    </div>

    <div class="section result-section">
      <div class="section-title">Query Results</div>
      <ResultTable :columns="resultColumns" :rows="resultRows" />
    </div>

    <section class="report-section" aria-label="Excel template report">
      <div class="section-title">Excel 模板报表</div>
      <div class="report-layout">
        <div class="report-controls">
          <p>将当前结果作为 <code>result</code> 数据集填入模板；原始导入数据可用 <code>input</code>。</p>
          <a v-if="currentData?.columns.length" :href="templateDownloadUrl" data-testid="download-template">下载当前列模板</a>
          <label for="templateFile">Excel 模板</label>
          <input id="templateFile" data-testid="template-file" type="file" accept=".xlsx" @change="chooseTemplate">
          <label for="reportParams">模板参数 JSON</label>
          <textarea id="reportParams" v-model="paramsText" data-testid="report-params" spellcheck="false" rows="4" />
          <button data-testid="render-report" :disabled="!currentData || !templateFile || rendering || running || importing" @click="renderTemplate">渲染当前结果</button>
          <button v-if="rendering" class="cancel-btn" @click="cancelReport">取消渲染</button>
          <a v-if="reportUrl" :href="reportUrl" download="report.xlsx" data-testid="download-report">下载报表 XLSX</a>
          <span class="report-status" data-testid="report-status" role="status">{{ reportStatus }}</span>
        </div>
        <div class="report-preview">
          <iframe v-if="reportHtml" :srcdoc="reportHtml" sandbox="" title="Report preview" data-testid="report-preview" />
          <p v-else class="report-placeholder">选择表格并运行 Kon，再加载模板预览报表。也可以下载当前列模板，在 Excel 中编辑样式、标题与批注。</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page {
  min-height: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar button {
  padding: 8px 16px;
  background: #059669;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.toolbar button:hover {
  background: #047857;
}

.demo-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  padding: 6px 10px;
  border-radius: 6px;
}

.demo-controls select {
  min-width: 0;
  max-width: 100%;
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid #d1d5db;
  background: white;
  font-size: 14px;
}

.demo-controls .load-btn {
  background: #1f2937;
  padding: 6px 12px;
}

.demo-controls .load-btn:hover {
  background: #111827;
}

.status {
  font-size: 12px;
  color: #666;
}

.section {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.kon-editor {
  box-sizing: border-box;
  width: 100%;
  height: 250px;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  color: #1f2937;
  background: #fff;
}

.kon-editor:focus {
  outline: 2px solid #05966955;
}

.section-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}

.result-section {
  flex: 1;
  min-height: 300px;
}

@media (max-width: 620px) {
  .demo-controls {
    align-items: stretch;
    flex: 1 1 100%;
    flex-wrap: wrap;
  }

  .demo-controls select {
    flex: 1 1 100%;
  }
}
</style>

<style scoped>
.import-card { display:flex; align-items:center; flex-wrap:wrap; gap:12px; padding:12px 14px; background:#f1f7f4; border:1px solid #d7e7de; border-radius:8px; font-size:13px; }
.import-card input { max-width:100%; }
.import-card span { color:#53645b; overflow-wrap:anywhere; }
button:disabled { opacity:.5; cursor:default; }
.report-section { border:1px solid #d7e2dc; border-radius:10px; padding:16px; background:#fafcfb; }
.report-layout { display:grid; grid-template-columns:minmax(200px,280px) minmax(0,1fr); gap:20px; }
.report-controls { display:flex; flex-direction:column; gap:10px; font-size:13px; min-width:0; }
.report-controls p { color:#59675f; line-height:1.6; margin:0 0 4px; }
.report-controls input, .report-controls textarea { width:100%; min-width:0; }
.report-controls textarea { padding:8px; border:1px solid #cbd8d0; border-radius:6px; font:12px/1.5 ui-monospace,monospace; resize:vertical; }
.report-controls button { padding:10px 12px; border:0; border-radius:6px; background:#187d6f; color:white; cursor:pointer; }
.report-controls a { color:#116554; text-underline-offset:3px; }
.report-status { color:#53645b; overflow-wrap:anywhere; line-height:1.5; }
.report-preview { min-width:0; min-height:320px; background:white; border:1px solid #e0e8e3; border-radius:6px; overflow:hidden; }
.report-preview iframe { width:100%; height:420px; border:0; display:block; }
.report-placeholder { margin:70px auto; max-width:420px; padding:20px; color:#79847d; line-height:1.8; font-size:14px; }
@media(max-width:800px) { .report-layout { grid-template-columns:minmax(0,1fr); } }
</style>
