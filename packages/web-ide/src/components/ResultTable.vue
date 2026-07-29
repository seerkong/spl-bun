<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  FlexRender,
  getCoreRowModel,
  useVueTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/vue-table";

const props = defineProps<{
  columns: string[];
  rows: Record<string, any>[];
}>();

const emit = defineEmits<{
  (e: "copy", data: string): void;
}>();

// Build column definitions from props
const columnDefs = computed<ColumnDef<Record<string, any>>[]>(() =>
  props.columns.map((key, index) => ({
    id: `column_${index}`,
    accessorFn: (row) => row[key],
    header: key,
    cell: (info) => String(info.getValue() ?? ""),
  }))
);

// Row selection state
const rowSelection = ref<RowSelectionState>({});

const table = useVueTable({
  get data() {
    return props.rows;
  },
  get columns() {
    return columnDefs.value;
  },
  getCoreRowModel: getCoreRowModel(),
  enableRowSelection: true,
  enableMultiRowSelection: true,
  onRowSelectionChange: (updater) => {
    rowSelection.value = typeof updater === "function" ? updater(rowSelection.value) : updater;
  },
  state: {
    get rowSelection() {
      return rowSelection.value;
    },
  },
});

// Cell range selection state
const selecting = ref(false);
const anchor = ref<{ row: number; col: number } | null>(null);
const focus = ref<{ row: number; col: number } | null>(null);

const visibleRows = computed(() => table.getRowModel().rows);
const visibleCols = computed(() => table.getAllLeafColumns());

const hasCellSelection = computed(() => anchor.value !== null && focus.value !== null);

const normalizedRange = computed(() => {
  if (!anchor.value || !focus.value) return null;
  const rowStart = Math.min(anchor.value.row, focus.value.row);
  const rowEnd = Math.max(anchor.value.row, focus.value.row);
  const colStart = Math.min(anchor.value.col, focus.value.col);
  const colEnd = Math.max(anchor.value.col, focus.value.col);
  return { rowStart, rowEnd, colStart, colEnd };
});

const isCellSelected = (rowIndex: number, colIndex: number) => {
  const range = normalizedRange.value;
  if (!range) return false;
  return rowIndex >= range.rowStart && rowIndex <= range.rowEnd && colIndex >= range.colStart && colIndex <= range.colEnd;
};

const onCellMouseDown = (rowIndex: number, colIndex: number) => {
  selecting.value = true;
  anchor.value = { row: rowIndex, col: colIndex };
  focus.value = { row: rowIndex, col: colIndex };
};

const onCellMouseOver = (rowIndex: number, colIndex: number) => {
  if (!selecting.value) return;
  focus.value = { row: rowIndex, col: colIndex };
};

const onMouseUp = () => {
  selecting.value = false;
};

const clearCellSelection = () => {
  anchor.value = null;
  focus.value = null;
};

const clearRowSelection = () => {
  rowSelection.value = {};
};

watch(() => props.rows, () => {
  clearRowSelection();
  clearCellSelection();
  selecting.value = false;
});

// Build TSV from cell range selection
const buildTsvFromRange = () => {
  const range = normalizedRange.value;
  if (!range) return "";
  const rows = visibleRows.value.slice(range.rowStart, range.rowEnd + 1);
  const cols = visibleCols.value.slice(range.colStart, range.colEnd + 1);
  // Include headers
  const header = cols.map((col) => `${col.columnDef.header ?? col.id}`).join("\t");
  const lines = rows.map((row) => cols.map((col) => `${row.getValue(col.id) ?? ""}`).join("\t"));
  return [header, ...lines].join("\n");
};

// Build TSV from selected rows
const buildTsvFromSelectedRows = () => {
  const cols = visibleCols.value;
  const header = cols.map((col) => `${col.columnDef.header ?? col.id}`).join("\t");
  const lines = table.getSelectedRowModel().rows.map((row) => cols.map((col) => `${row.getValue(col.id) ?? ""}`).join("\t"));
  return [header, ...lines].join("\n");
};

// Copy selection to clipboard
const copySelection = async () => {
  let tsv = "";
  if (hasCellSelection.value) {
    tsv = buildTsvFromRange();
  } else if (Object.keys(rowSelection.value).length > 0) {
    tsv = buildTsvFromSelectedRows();
  }
  if (!tsv) return;

  try {
    await navigator.clipboard.writeText(tsv);
    emit("copy", tsv);
  } catch (err) {
    // Fallback for non-secure contexts
    const textarea = document.createElement("textarea");
    textarea.value = tsv;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    emit("copy", tsv);
  }
};

// Selection info for display
const selectionInfo = computed(() => {
  if (hasCellSelection.value) {
    const range = normalizedRange.value!;
    const rowCount = range.rowEnd - range.rowStart + 1;
    const colCount = range.colEnd - range.colStart + 1;
    return `${rowCount} rows × ${colCount} cols selected`;
  }
  const selectedCount = Object.keys(rowSelection.value).length;
  if (selectedCount > 0) {
    return `${selectedCount} rows selected`;
  }
  return "";
});

const hasSelection = computed(() => hasCellSelection.value || Object.keys(rowSelection.value).length > 0);
</script>

<template>
  <div class="result-table-wrap" @mouseup="onMouseUp" @mouseleave="onMouseUp">
    <div class="table-toolbar" v-if="columns.length > 0">
      <button class="copy-btn" :disabled="!hasSelection" @click="copySelection" title="Copy to clipboard (Ctrl+C)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        Copy
      </button>
      <button class="clear-btn" v-if="hasCellSelection" @click="clearCellSelection">Clear Cell Selection</button>
      <button class="clear-btn" v-if="Object.keys(rowSelection).length > 0" @click="clearRowSelection">
        Clear Row Selection
      </button>
      <span class="selection-info" v-if="selectionInfo">{{ selectionInfo }}</span>
    </div>

    <div class="table-container" v-if="columns.length > 0">
      <table class="data-grid">
        <thead>
          <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <th class="select-col">
              <input
                type="checkbox"
                :checked="table.getIsAllRowsSelected()"
                :indeterminate="table.getIsSomeRowsSelected()"
                @change="table.getToggleAllRowsSelectedHandler()($event)"
                @mousedown.stop
                title="Select all rows"
              />
            </th>
            <th v-for="header in headerGroup.headers" :key="header.id" :colSpan="header.colSpan">
              <FlexRender
                v-if="!header.isPlaceholder"
                :render="header.column.columnDef.header"
                :props="header.getContext()"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, rowIndex) in table.getRowModel().rows"
            :key="row.id"
            :class="{ 'row-selected': row.getIsSelected() }"
          >
            <td class="select-col">
              <input
                type="checkbox"
                :checked="row.getIsSelected()"
                :disabled="!row.getCanSelect()"
                @change="row.getToggleSelectedHandler()($event)"
                @mousedown.stop
              />
            </td>
            <td
              v-for="(cell, colIndex) in row.getVisibleCells()"
              :key="cell.id"
              class="data-cell"
              :class="{
                'cell-selected': isCellSelected(rowIndex, colIndex),
                'cell-anchor': anchor && anchor.row === rowIndex && anchor.col === colIndex,
              }"
              @mousedown.prevent="onCellMouseDown(rowIndex, colIndex)"
              @mouseover="onCellMouseOver(rowIndex, colIndex)"
            >
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="empty-state" v-else>
      <span>No data to display</span>
    </div>
  </div>
</template>

<style scoped>
.result-table-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.table-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #059669;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.copy-btn:hover:not(:disabled) {
  background: #047857;
}

.copy-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.clear-btn {
  padding: 6px 10px;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: #4b5563;
}

.clear-btn:hover {
  background: #f3f4f6;
}

.selection-info {
  margin-left: auto;
  font-size: 12px;
  color: #6b7280;
}

.table-container {
  flex: 1;
  min-width: 0;
  overflow: auto;
}

.data-grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-grid th,
.data-grid td {
  border: 1px solid #e5e7eb;
  padding: 8px 12px;
  text-align: left;
  user-select: none;
}

.data-grid th {
  background: #f9fafb;
  font-weight: 600;
  color: #374151;
  position: sticky;
  top: 0;
  z-index: 1;
}

.select-col {
  width: 40px;
  text-align: center !important;
  background: #f3f4f6 !important;
}

.data-cell {
  cursor: cell;
  transition: background 0.1s;
}

.cell-selected {
  background: #dbeafe !important;
}

.cell-anchor {
  outline: 2px solid #2563eb;
  outline-offset: -2px;
}

.row-selected td:not(.select-col) {
  background: #eff6ff;
}

.row-selected td.cell-selected {
  background: #dbeafe !important;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 14px;
}
</style>
