import type { Row, Value } from "./dataset";
import { aggregateValues, aggregateInput, numericBinary, numericValue, truthy, type SplNumber } from "depa-data-expression";

export interface GatherContext {
  rows: Row[];
  index: number;
}

export interface GatherFunction {
  prepare(rows: Row[]): void;
  gather(ctx: GatherContext): Value;
  gatherWith(oldValue: Value, ctx: GatherContext): Value;
  finish(value: Value): Value;
  regatherExpression(field: string): string | null;
  needsFinish1(): boolean;
  finish1(value: Value): Value;
}

export abstract class BaseGather implements GatherFunction {
  protected rows: Row[] = [];

  prepare(rows: Row[]): void {
    this.rows = rows;
  }

  abstract gather(ctx: GatherContext): Value;

  abstract gatherWith(oldValue: Value, ctx: GatherContext): Value;

  finish(value: Value): Value {
    return value;
  }

  regatherExpression(_field: string): string | null {
    return null;
  }

  needsFinish1(): boolean {
    return false;
  }

  finish1(value: Value): Value {
    return value;
  }
}

export function runGather(fn: GatherFunction, rows: Row[]): Value {
  if (!rows.length) return fn.finish(null);
  fn.prepare(rows);
  const first = fn.gather({ rows, index: 0 });
  let acc = first;
  for (let i = 1; i < rows.length; i += 1) {
    acc = fn.gatherWith(acc, { rows, index: i });
  }
  return fn.finish(acc);
}

export class SumGather extends BaseGather {
  constructor(private readonly field?: string, private readonly expr?: (row: Row) => number) {
    super();
  }

  regatherExpression(field: string): string {
    return `sum(${field})`;
  }

  gather(ctx: GatherContext): Value {
    return this.valueAt(ctx);
  }

  gatherWith(oldValue: Value, ctx: GatherContext): Value {
    const next = this.valueAt(ctx);
    return aggregateValues("sum", [oldValue, next]);
  }

  private valueAt(ctx: GatherContext): SplNumber | null {
    const row = ctx.rows[ctx.index];
    return aggregateInput(this.expr ? this.expr(row) : this.field ? row[this.field] : null);
  }
}

export class CountGather extends BaseGather {
  constructor(private readonly field?: string) { super(); }
  regatherExpression(field: string): string {
    return `sum(${field})`;
  }

  gather(ctx: GatherContext): Value {
    return this.field ? Number(truthy(ctx.rows[ctx.index][this.field])) : 1;
  }

  gatherWith(oldValue: Value, ctx: GatherContext): Value {
    return Number(oldValue ?? 0) + Number(this.gather(ctx));
  }

  finish(value: Value): Value { return value ?? 0; }
}

export class AvgGather extends BaseGather {
  constructor(private readonly field?: string, private readonly expr?: (row: Row) => number) {
    super();
  }

  regatherExpression(_field: string): null {
    // A finished average has lost its weight; never average finished averages.
    return null;
  }

  prepare(rows: Row[]): void {
    super.prepare(rows);
  }

  gather(ctx: GatherContext): Value {
    return this.stateAt(ctx);
  }

  gatherWith(oldValue: Value, ctx: GatherContext): Value {
    const existing = asAvgState(oldValue);
    const value = this.stateAt(ctx);
    const nextSum = numericBinary("add",existing.sum,value.sum);
    const nextCount = existing.count + value.count;
    return { sum: nextSum, count: nextCount };
  }

  finish(value: Value): Value {
    const state = asAvgState(value);
    if (!state.count) return null;
    return numericBinary("divide",state.sum,state.count);
  }

  private stateAt(ctx: GatherContext): { sum: SplNumber; count: number } {
    const row = ctx.rows[ctx.index];
    const raw = this.expr ? this.expr(row) : this.field ? row[this.field] : null;
    if (raw && typeof raw === "object" && "sum" in raw && "count" in raw) return asAvgState(raw);
    const value = aggregateInput(raw);
    return {sum:value ?? 0,count:value === null ? 0 : 1};
  }
}

export class MedianGather extends BaseGather {
  constructor(private readonly field?: string, private readonly expr?: (row: Row) => number) {
    super();
  }

  regatherExpression(field: string): string {
    return `median(${field})`;
  }

  gather(ctx: GatherContext): Value {
    return this.valueAt(ctx);
  }

  gatherWith(oldValue: Value, ctx: GatherContext): Value {
    const values = Array.isArray(oldValue) ? [...oldValue] : oldValue == null ? [] : [oldValue];
    values.push(this.valueAt(ctx));
    return values;
  }

  finish(value: Value): Value {
    return aggregateValues("median", Array.isArray(value) ? value : [value]);
  }

  private valueAt(ctx: GatherContext): SplNumber | null {
    const row = ctx.rows[ctx.index];
    return aggregateInput(this.expr ? this.expr(row) : this.field ? row[this.field] : null);
  }
}

export class TopGather extends BaseGather {
  private readonly count: number;

  constructor(private readonly field?: string, count?: number, private readonly expr?: (row: Row) => number) {
    super();
    this.count = count ?? 1;
  }

  regatherExpression(_field: string): string | null {
    return null;
  }

  gather(ctx: GatherContext): Value {
    return [{ value: this.valueAt(ctx), row: ctx.rows[ctx.index] }];
  }

  gatherWith(oldValue: Value, ctx: GatherContext): Value {
    const list = Array.isArray(oldValue) ? [...oldValue] : oldValue == null ? [] : [oldValue];
    list.push({ value: this.valueAt(ctx), row: ctx.rows[ctx.index] });
    return list;
  }

  finish(value: Value): Value {
    const items = Array.isArray(value) ? value : value == null ? [] : [value];
    const sorted = items
      .filter((item): item is { value: number; row: Row } =>
        item != null && typeof item === "object" && "value" in item && "row" in item,
      )
      .sort((a, b) => a.value - b.value);
    const picked = sorted.slice(-this.count).map((item) => item.row);
    return this.count === 1 ? (picked[0] ?? null) : picked;
  }


  private valueAt(ctx: GatherContext): number {
    const row = ctx.rows[ctx.index];
    if (this.expr) return this.expr(row);
    if (this.field) return Number(row[this.field] ?? 0);
    return 0;
  }
}

function asAvgState(value: Value): { sum: SplNumber; count: number } {
  if (value && typeof value === "object" && "sum" in value && "count" in value) {
    const sum = aggregateInput((value as Record<string, unknown>).sum) ?? 0;
    const count = Number((value as Record<string, unknown>).count ?? 0);
    return { sum, count };
  }
  return { sum: aggregateInput(value) ?? 0, count: 0 };
}

