import { expect, test } from 'bun:test';
import { DataSet, type WindowSpec } from '../src';
import { decimal, evaluateExpression } from 'depa-data-expression';
const input = new DataSet([{ name: 'k', type: 'string' }, { name: 'id', type: 'number' }, { name: 'v', type: 'unknown' }], [{ k: 'A', id: 2, v: null }, { k: 'B', id: 1, v: 10 }, { k: 'A', id: 1, v: decimal('0.1') }, { k: 'A', id: 3, v: decimal('0.2') }]);
const spec: WindowSpec = { partitionBy: ['k'], orderBy: [{ column: 'id' }], outputs: { runningSum: { column: 'v', as: 'total' }, runningAvg: { column: 'v', as: 'mean' }, lag: [{ column: 'v', as: 'prev' }], lead: [{ column: 'v', as: 'next', defaultValue: -1 }], frames: [{ column: 'v', as: 'moving', kind: 'sum', start: -1, end: 0 }, { as: 'size', kind: 'count', start: null, end: null }, { column: 'v', as: 'empty', kind: 'sum', start: 2, end: -2 }] } };
test('window exact/null aggregates, relative values and inclusive ROWS frames stay partition-local', () => {
    const actual = input.window(spec).rows;
    expect(actual.map(row => String(row.total))).toEqual(['0.1', '0.1', '0.3', '10']);
    expect(actual.map(row => String(row.mean))).toEqual(['0.1', '0.1', '0.15', '10']);
    expect(actual.map(row => String(row.prev))).toEqual(['null', '0.1', 'null', 'null']);
    expect(actual.map(row => String(row.next))).toEqual(['null', '0.2', '-1', '-1']);
    expect(actual.map(row => String(row.moving))).toEqual(['0.1', '0.1', '0.2', '10']);
    expect(actual.map(row => row.size)).toEqual([3, 3, 3, 1]);
    expect(actual.map(row => row.empty)).toEqual([null, null, null, null]);
    expect(input.rows[0]).toEqual({ k: 'A', id: 2, v: null });
    expect((evaluateExpression('input.window(spec)', { input, spec }) as any).rows).toEqual(actual);
});
test('window binds sparse fields, rejects unsupported frames and preserves complete empty schema', () => {
    const sparse = new DataSet([{ name: 'id', type: 'number' }, { name: 'v', type: 'number' }], [{ id: 1 }, { id: 2, v: 4 }]);
    const scope = { v: 99, scale: 2 };
    const result = sparse.window({ orderBy: [{ column: 'id' }], outputs: { runningAvg: { column: 'v', expression: 'v*scale', as: 'x' } } }, scope);
    expect(result.rows.map(row => row.x)).toEqual([null, 8]);
    expect(scope).toEqual({ v: 99, scale: 2 });
    expect(() => sparse.window({ orderBy: [{ column: 'missing' }], outputs: { rank: 'r' } })).toThrow('missing');
    expect(() => sparse.window({ orderBy: [{ column: 'id' }], outputs: { lag: [{ as: 'x', column: 'missing' }] } })).toThrow('missing');
    expect(() => sparse.window({ orderBy: [{ column: 'id' }], outputs: { lead: [{ as: 'x', column: 'v', offset: -1 }] } })).toThrow('nonnegative');
    expect(() => sparse.window({ orderBy: [{ column: 'id' }], outputs: { frames: [{ as: 'x', kind: 'sum', column: 'v', start: NaN, end: 0 }] } })).toThrow('safe integer');
    expect(new DataSet(input.schema, []).window(spec).schema.map(column => column.name)).toEqual(['k', 'id', 'v', 'total', 'mean', 'prev', 'next', 'moving', 'size', 'empty']);
});
test('window long totals and multiple output aliases do not demote or read previous output values', () => {
    const value = DataSet.fromRows([{ id: 1, v: 9007199254740993n }, { id: 2, v: 1n }]);
    const result = value.window({ orderBy: [{ column: 'id' }], outputs: { runningSum: { column: 'v', as: 'v' }, frames: [{ column: 'v', as: 'full', kind: 'sum', start: null, end: null }] } });
    expect(result.rows.map(row => row.v)).toEqual([9007199254740993n, 9007199254740994n]);
    expect(result.rows.map(row => row.full)).toEqual([9007199254740994n, 9007199254740994n]);
});
test('empty frames and offsets outside the partition do not evaluate unused expressions', () => {
    const data = DataSet.fromRows([{ id: 1 }, { id: 2 }]);
    const result = data.window({ orderBy: [{ column: 'id' }], outputs: { lead: [{ as: 'future', expression: "decimal('1')/0", offset: 3, defaultValue: 'empty' }], frames: [{ as: 'empty', expression: "decimal('1')/0", kind: 'sum', start: 2, end: -2 }] } });
    expect(result.rows.map(row => [row.future, row.empty])).toEqual([['empty', null], ['empty', null]]);
    expect(() => data.window({ orderBy: [{ column: 'id' }], outputs: { frames: [{ as: 'x', column: 'id', kind: 'sum', start: 0, end: 0, range: true } as any] } })).toThrow('Unsupported');
});
