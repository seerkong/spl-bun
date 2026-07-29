import { Cursor, type CursorOptions, renameTable, alterTable, indexTable, groupedRows, groupColumns, ungroupColumns, groupDimensions, type AlterColumn, type GroupColumnsSpec, type UngroupColumnsSpec, type TableIndex } from "depa-data-expression";
export type { AlterColumn, GroupColumnsSpec, UngroupColumnsSpec, TableIndex };
import { pivotTable, unpivotTable, joinTables, type PivotSpec, type UnpivotSpec, type TableJoinSpec, type TableJoinType } from "depa-data-expression";
import { compileExpression, compileBoundExpression, tableRowScope, assertKnownColumns, truthy, createTupleIndex, getTuple, setTuple, tupleEntries, compareScalarValues } from "depa-data-expression";
import { AvgGather, CountGather, MedianGather, SumGather, TopGather, runGather, type GatherFunction } from "./gather";
export type Value = unknown;
export type Row = Record<string, Value>;
export interface ColumnSchema {
    name: string;
    type: string;
}
export interface AggregateSpec {
    groupBy?: string[];
    aggregates: Record<string, (rows: Row[]) => Value>;
}
export type GatherSpec = {
    [name: string]: {
        type: "sum" | "count" | "avg" | "median" | "top";
        field?: string;
        count?: number;
    };
};
export type JoinType = TableJoinType;
export interface JoinSpec extends TableJoinSpec {
}
export type { PivotSpec, UnpivotSpec };
export type {SortDirection, OrderBySpec, WindowOutputs, WindowSpec, WindowOffset, WindowFrame} from "depa-data-expression";
import {windowTable,type WindowSpec,type OrderBySpec} from "depa-data-expression";
export class DataSet {
    cursor(options?: CursorOptions): Cursor<Row> { const rows=this.rows;return Cursor.from((function*(){for(const row of rows)yield {...row};})(),{...options,columns:this.schema.map(column=>column.name)}); }
    readonly schema: ColumnSchema[];
    readonly rows: Row[];
    constructor(schema: ColumnSchema[], rows: Row[]) {
        this.schema = schema;
        this.rows = rows;
    }
    static fromRows(rows: Row[]): DataSet {
        const schema = inferSchema(rows);
        return new DataSet(schema, rows);
    }
    project(columns: string[]): DataSet {
        const columnSet = new Set(columns);
        const schema = this.schema.filter((c) => columnSet.has(c.name));
        const rows = this.rows.map((row) => {
            const projected: Row = {};
            for (const col of columns) {
                projected[col] = row[col];
            }
            return projected;
        });
        return new DataSet(schema, rows);
    }
    filter(predicate: (row: Row) => boolean): DataSet {
        const rows = this.rows.filter(predicate);
        return new DataSet(this.schema, rows);
    }
    filterExpr(expression: string, scope: Record<string, unknown> = {}): DataSet {
        const names = this.schema.map(column => column.name);
        const compiled = compileBoundExpression(expression, names, scope);
        return this.filter((row) => truthy(compiled.evaluate(tableRowScope(names, row, scope))));
    }
    withComputedColumns(columns: Record<string, string>, scope: Record<string, unknown> = {}): DataSet {
        const names = this.schema.map(column => column.name);
        const compiled = Object.fromEntries(Object.entries(columns).map(([name, expr]) => {
            const evaluator = compileBoundExpression(expr, names, scope);
            if (!names.includes(name))
                names.push(name);
            return [name, evaluator];
        }));
        const rows = this.rows.map((row) => {
            const next: Row = { ...row };
            for (const [name, evaluator] of Object.entries(compiled)) {
                next[name] = evaluator.evaluate(tableRowScope(names, next, scope));
            }
            return next;
        });
        const newSchema = [...this.schema];
        for (const col of Object.keys(columns)) {
            if (!newSchema.find((c) => c.name === col)) {
                newSchema.push({ name: col, type: "unknown" });
            }
        }
        return new DataSet(newSchema, rows);
    }
    aggregate(spec: AggregateSpec): DataSet {
        const groupKeys = spec.groupBy ?? [];
        assertKnownColumns(groupKeys, this.schema.map(column => column.name));
        const groups = createTupleIndex<Row[]>();
        for (const row of this.rows) {
            const key = groupKeys.map((k) => row[k]);
            const list = getTuple(groups, key) ?? [];
            list.push(row);
            setTuple(groups, key, list);
        }
        if (!groupKeys.length && !this.rows.length)
            setTuple(groups, [], []);
        const resultRows: Row[] = [];
        for (const [key, rows] of tupleEntries(groups)) {
            const groupRow: Row = Object.fromEntries(groupKeys.map((name, index) => [name, key[index]]));
            for (const [alias, fn] of Object.entries(spec.aggregates)) {
                groupRow[alias] = fn(rows);
            }
            resultRows.push(groupRow);
        }
        const schema: ColumnSchema[] = [
            ...groupKeys.map((name) => ({ name, type: this.schema.find((column) => column.name === name)?.type ?? "unknown" })),
            ...Object.keys(spec.aggregates).map((name) => ({ name, type: "number" })),
        ];
        return new DataSet(schema, resultRows);
    }
    aggregateWithGather(spec: GatherSpec): DataSet {
        assertKnownColumns(Object.values(spec).flatMap(item => item.field ? [item.field] : []), this.schema.map(column => column.name));
        const aggregators = Object.entries(spec).map(([name, cfg]) => ({ name, gather: createGather(cfg) }));
        const firstPass = Object.fromEntries(aggregators.map(({ name, gather }) => [name, runGather(gather, this.rows)]));
        const regatherEntries = aggregators
            .map(({ name, gather }) => {
            const expr = gather.regatherExpression(name);
            return expr ? [name, expr] : null;
        })
            .filter((entry): entry is [
            string,
            string
        ] => entry !== null);
        if (regatherEntries.length === 0) {
            const schema: ColumnSchema[] = Object.keys(spec).map((name) => ({ name, type: "number" }));
            return new DataSet(schema, [firstPass]);
        }
        const regatherScope = { ...firstPass } as Record<string, unknown>;
        const regathered = Object.fromEntries(regatherEntries.map(([name, expr]) => [name, compileExpression(expr).evaluate(regatherScope)]));
        const finalRow = { ...firstPass, ...regathered };
        const schema: ColumnSchema[] = Object.keys(finalRow).map((name) => ({ name, type: "number" }));
        return new DataSet(schema, [finalRow]);
    }
    join(other: DataSet, spec: JoinSpec): DataSet {
        const result = joinTables(this, other, spec);
        return new DataSet(result.schema, result.rows);
    }
    pivot(spec: PivotSpec): DataSet { const result = pivotTable(this, spec); return new DataSet(result.schema, result.rows); }
    unpivot(spec: UnpivotSpec): DataSet { const result = unpivotTable(this, spec); return new DataSet(result.schema, result.rows); }
    rename(mapping: Record<string, string>): DataSet { const result = renameTable(this, mapping); return new DataSet(result.schema, result.rows); }
    alter(columns: AlterColumn[]): DataSet { const result = alterTable(this, columns); return new DataSet(result.schema, result.rows); }
    index(keys: string[], uniqueKeys = false): TableIndex { return indexTable(this, keys, uniqueKeys); }
    groupRows(spec: {
        keys: string[];
        adjacent?: boolean;
        rowsAs?: string;
    }): DataSet { const result = groupedRows(this, spec.keys, spec.adjacent, spec.rowsAs); return new DataSet(result.schema, result.rows); }
    groupc(spec: GroupColumnsSpec): DataSet { const result = groupColumns(this, spec); return new DataSet(result.schema, result.rows); }
    ungroupc(spec: UngroupColumnsSpec): DataSet { const result = ungroupColumns(this, spec); return new DataSet(result.schema, result.rows); }
    groupi(spec: {
        columns: string[];
        ordered?: boolean;
    }): DataSet { const result = groupDimensions(this, spec.columns, spec.ordered); return new DataSet(result.schema, result.rows); }
    window(spec: WindowSpec, scope: Record<string, unknown> = {}): DataSet {const result=windowTable(this,spec,scope);return new DataSet(result.schema,result.rows);}
    toArray(): Row[] {
        return [...this.rows];
    }
}
function createGather(cfg: {
    type: "sum" | "count" | "avg" | "median" | "top";
    field?: string;
    count?: number;
}): GatherFunction {
    switch (cfg.type) {
        case "sum":
            return new SumGather(cfg.field);
        case "count":
            return new CountGather(cfg.field);
        case "avg":
            return new AvgGather(cfg.field);
        case "median":
            return new MedianGather(cfg.field);
        case "top":
            return new TopGather(cfg.field, cfg.count);
        default:
            throw new Error(`Unknown gather type: ${cfg.type}`);
    }
}
function inferSchema(rows: Row[]): ColumnSchema[] {
    if (rows.length === 0) {
        return [];
    }
    const columns = new Map<string, ColumnSchema>();
    for (const row of rows)
        for (const name of Object.keys(row))
            if (!columns.has(name))
                columns.set(name, { name, type: typeof row[name] });
    return [...columns.values()];
}
