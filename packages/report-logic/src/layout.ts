import type { CompiledCell, CompiledSheet, ReportExpressionRuntime } from "depa-data-report-contract";
import { expandItems } from "./axis";
import type { ExpansionItem, ScopeRuntime } from "./scope";
type Axis = "r" | "c";
export interface LayoutCell {
    id: number;
    source: CompiledCell;
    row: number;
    col: number;
    rowSpan: number;
    colSpan: number;
    rowParent?: LayoutCell;
    colParent?: LayoutCell;
    item?: ExpansionItem;
    expanded: boolean;
    removed?: boolean;
}
interface Slot {
    origin: number;
    generator?: LayoutCell;
}
export interface SheetLayout {
    cells: LayoutCell[];
    rowOrigins: number[];
    colOrigins: number[];
}
export function layoutBindings(cell: LayoutCell, axis: Axis): ExpansionItem[] {
    const items: ExpansionItem[] = [];
    let current: LayoutCell | undefined = cell;
    while (current) {
        if (current.source.config.expandType === axis && current.item)
            items.push(current.item);
        current = axis === "r" ? current.rowParent : current.colParent;
    }
    return items.reverse();
}
function isDescendant(cell: LayoutCell, parent: LayoutCell, axis: Axis): boolean {
    let current: LayoutCell | undefined = cell;
    while (current) {
        if (current === parent)
            return true;
        current = axis === "r" ? current.rowParent : current.colParent;
    }
    return false;
}
function expandableParent(cell: LayoutCell, axis: Axis): LayoutCell | undefined {
    let current = axis === "r" ? cell.rowParent : cell.colParent;
    while (current) {
        if (current.source.config.expandType === axis)
            return current;
        current = axis === "r" ? current.rowParent : current.colParent;
    }
    return undefined;
}
function ready(cell: LayoutCell): boolean {
    const seen = new Set<LayoutCell>(), pending = [cell.rowParent, cell.colParent];
    while (pending.length) {
        const parent = pending.pop();
        if (!parent || seen.has(parent))
            continue;
        seen.add(parent);
        if (parent.source.config.expandType && !parent.expanded)
            return false;
        pending.push(parent.rowParent, parent.colParent);
    }
    return true;
}
/** Dependency-driven spatial expansion. Slots carry layout provenance; instances
 * carry semantic identity. Reserved slots and sibling growth share this model.
 */
export function layoutSheet(runtime: ReportExpressionRuntime, context: ScopeRuntime, sheet: CompiledSheet, limits: {
    maxRows: number;
    maxColumns: number;
    maxCells: number;
}): SheetLayout {
    if (sheet.rowCount > limits.maxRows)
        throw new Error(`${sheet.name}: report row limit exceeded by template`);
    if (sheet.colCount > limits.maxColumns)
        throw new Error(`${sheet.name}: report column limit exceeded by template`);
    if (sheet.rowCount * sheet.colCount > limits.maxCells)
        throw new Error(`${sheet.name}: report cell limit exceeded by template`);
    let sequence = 0;
    const rows: Slot[] = Array.from({ length: sheet.rowCount }, (_, origin) => ({ origin }));
    const cols: Slot[] = Array.from({ length: sheet.colCount }, (_, origin) => ({ origin }));
    const cells: LayoutCell[] = [];
    const byAddress = new Map<string, LayoutCell>();
    const covered = (cell: CompiledCell) => sheet.merges.some(m => (cell.row !== m.start.row || cell.col !== m.start.col) && cell.row >= m.start.row && cell.row <= m.end.row && cell.col >= m.start.col && cell.col <= m.end.col);
    for (const source of sheet.cells) {
        if (covered(source))
            continue;
        const merge = sheet.merges.find(m => m.start.row === source.row && m.start.col === source.col);
        const cell: LayoutCell = { id: ++sequence, source, row: source.row, col: source.col, rowSpan: merge ? merge.end.row - source.row + 1 : 1, colSpan: merge ? merge.end.col - source.col + 1 : 1, expanded: false };
        cells.push(cell);
        byAddress.set(source.address, cell);
    }
    for (const cell of cells) {
        cell.rowParent = byAddress.get(cell.source.rowParentAddress ?? "");
        cell.colParent = byAddress.get(cell.source.colParentAddress ?? "");
    }
    const position = (cell: LayoutCell, axis: Axis) => axis === "r" ? cell.row : cell.col;
    const span = (cell: LayoutCell, axis: Axis) => axis === "r" ? cell.rowSpan : cell.colSpan;
    const setPosition = (cell: LayoutCell, axis: Axis, value: number) => { if (axis === "r")
        cell.row = value;
    else
        cell.col = value; };
    const setSpan = (cell: LayoutCell, axis: Axis, value: number) => { if (axis === "r")
        cell.rowSpan = value;
    else
        cell.colSpan = value; };
    const pending = cells.filter(cell => cell.source.config.expandType);
    function check(): void {
        if (rows.length > limits.maxRows)
            throw new Error(`${sheet.name}: report row limit exceeded`);
        if (cols.length > limits.maxColumns)
            throw new Error(`${sheet.name}: report column limit exceeded`);
        if (rows.length * cols.length > limits.maxCells)
            throw new Error("Report cell limit exceeded");
    }
    function insert(axis: Axis, index: number, origin: number, owner: LayoutCell, copies: Set<LayoutCell>): void {
        const slots = axis === "r" ? rows : cols;
        if (slots.length + 1 > (axis === "r" ? limits.maxRows : limits.maxColumns))
            throw new Error(`${sheet.name}: report ${axis === "r" ? "row" : "column"} limit exceeded`);
        for (const cell of cells) {
            if (cell.removed)
                continue;
            const start = position(cell, axis), end = start + span(cell, axis);
            if (start >= index)
                setPosition(cell, axis, start + 1);
            else if (start < index && end > index)
                setSpan(cell, axis, span(cell, axis) + 1);
        }
        slots.splice(index, 0, { origin, generator: owner });
        check();
    }
    function extendNeighbors(owner: LayoutCell, copies: Set<LayoutCell>, axis: Axis, start: number, end: number, growth: number): void {
        if (!growth)
            return;
        for (const other of cells) {
            if (other.removed || copies.has(other))
                continue;
            const extend = axis === "r" ? other.source.config.rowExtendForSibling : other.source.config.colExtendForSibling;
            if (extend === false)
                continue;
            const ancestor = isDescendant(owner, other, axis);
            const independent = !other.source.config.expandType && !expandableParent(other, axis);
            const oldStart = position(other, axis), oldEnd = oldStart + span(other, axis) - 1;
            if ((ancestor || independent) && oldStart <= end && oldEnd >= start) {
                const occupied = [...copies].some(child => child !== owner && (axis === "r" ? child.col === other.col : child.row === other.row));
                if (!occupied)
                    setSpan(other, axis, Math.max(span(other, axis), end + growth - oldStart + 1));
            }
        }
    }
    let stalled = 0;
    while (pending.length) {
        const owner = pending.shift()!;
        if (owner.removed || owner.expanded)
            continue;
        if (!ready(owner)) {
            pending.push(owner);
            if (++stalled > pending.length)
                throw new Error(`${sheet.name}!${owner.source.address}: unresolved expansion dependency`);
            continue;
        }
        stalled = 0;
        const axis = owner.source.config.expandType!, slots = axis === "r" ? rows : cols;
        const ownRows = layoutBindings(owner, "r"), ownCols = layoutBindings(owner, "c");
        const own = axis === "r" ? ownRows : ownCols, foreign = axis === "r" ? ownCols : ownRows;
        let items: ReturnType<typeof expandItems>;
        try {
            items = expandItems(runtime, context, owner.source, own, foreign, axis, axis === "r" ? limits.maxRows : limits.maxColumns);
        }
        catch (err) {
            throw new Error(`${sheet.name}!${owner.source.address}: ${err instanceof Error ? err.message : String(err)}`);
        }
        const copies = new Set(cells.filter(cell => !cell.removed && isDescendant(cell, owner, axis)));
        const original = [...copies];
        let start = position(owner, axis), finish = start + span(owner, axis) - 1;
        for (const cell of original) {
            start = Math.min(start, position(cell, axis));
            finish = Math.max(finish, position(cell, axis) + span(cell, axis) - 1);
        }
        const width = finish - start + 1;
        if (!items.length) {
            for (let index = start; index <= finish; index++)
                (slots[index] as Slot & {
                    removed?: boolean;
                }).removed = true;
            for (const cell of copies)
                cell.removed = true;
            owner.expanded = true;
            continue;
        }
        const bind = (cell: LayoutCell, index: number) => { cell.item = { ...items[index], index, anchor: owner.source.address, uid: `${axis}${cell.id}` }; cell.expanded = true; };
        bind(owner, 0);
        let inserted = 0;
        const reserved = owner.source.config.expandInplaceCount ?? 0;
        for (let itemIndex = 1; itemIndex < items.length; itemIndex++) {
            const destination = start + width * itemIndex;
            for (let offset = 0; offset < width; offset++) {
                const target = destination + offset;
                const canReserve = reserved > 0 && itemIndex < reserved;
                const reuse = slots[target]?.generator && expandableParent(slots[target].generator!, axis) === expandableParent(owner, axis);
                if (!canReserve && !reuse) {
                    insert(axis, target, slots[start + offset]?.origin ?? (axis === "r" ? owner.source.row : owner.source.col), owner, copies);
                    inserted++;
                }
                else
                    while (slots.length <= target) {
                        slots.push({ origin: (axis === "r" ? owner.source.row : owner.source.col) + slots.length - start, generator: owner });
                        check();
                    }
            }
            const cloned = new Map<LayoutCell, LayoutCell>();
            for (const source of original) {
                const clone: LayoutCell = { ...source, id: ++sequence, item: undefined, expanded: false };
                setPosition(clone, axis, destination + position(source, axis) - start);
                for (const occupied of cells)
                    if (!occupied.removed && occupied.row === clone.row && occupied.col === clone.col)
                        occupied.removed = true;
                cells.push(clone);
                cloned.set(source, clone);
            }
            for (const [source, clone] of cloned) {
                clone.rowParent = source.rowParent ? cloned.get(source.rowParent) ?? source.rowParent : undefined;
                clone.colParent = source.colParent ? cloned.get(source.colParent) ?? source.colParent : undefined;
                if (source === owner)
                    bind(clone, itemIndex);
                else if (clone.source.config.expandType)
                    pending.push(clone);
            }
        }
        extendNeighbors(owner, copies, axis, start, finish, inserted);
    }
    // Empty-region removal is deferred until all dependency-scheduled expansions.
    const keepRows = rows.map((slot, index) => ({ slot, index })).filter(({ slot }) => !(slot as Slot & {
        removed?: boolean;
    }).removed);
    const keepCols = cols.map((slot, index) => ({ slot, index })).filter(({ slot }) => !(slot as Slot & {
        removed?: boolean;
    }).removed);
    const rowMap = new Map(keepRows.map(({ index }, next) => [index, next])), colMap = new Map(keepCols.map(({ index }, next) => [index, next]));
    const output: LayoutCell[] = [];
    for (const cell of cells) {
        if (cell.removed)
            continue;
        const rr = Array.from({ length: cell.rowSpan }, (_, i) => cell.row + i).filter(row => rowMap.has(row)), cc = Array.from({ length: cell.colSpan }, (_, i) => cell.col + i).filter(col => colMap.has(col));
        if (!rr.length || !cc.length)
            continue;
        cell.row = rowMap.get(rr[0])!;
        cell.col = colMap.get(cc[0])!;
        cell.rowSpan = rr.length;
        cell.colSpan = cc.length;
        output.push(cell);
    }
    check();
    output.sort((a, b) => a.row - b.row || a.col - b.col);
    return { cells: output, rowOrigins: keepRows.map(({ slot }) => slot.origin), colOrigins: keepCols.map(({ slot }) => slot.origin) };
}
