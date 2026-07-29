import { expect, test } from 'bun:test';
import { DataSet } from '../src';
import { decimal, compileAggregateExpression } from 'depa-data-expression';
test('core exact gathers, derived expressions, pivot and joins preserve numeric authority', () => {
    const input = DataSet.fromRows([{ id: 1, v: decimal('0.1') }, { id: 2, v: decimal('0.2') }]);
    const result = input.aggregateWithGather({ total: { type: 'sum', field: 'v' }, mean: { type: 'avg', field: 'v' }, middle: { type: 'median', field: 'v' } });
    expect(Object.values(result.rows[0]).map(String)).toEqual(['0.3', '0.15', '0.15']);
    expect(String(compileAggregateExpression('sum(v)/2', ['v'])(input.rows))).toBe('0.15');
    const left = DataSet.fromRows([{ id: decimal('1.00') }]), right = DataSet.fromRows([{ id: 1, name: 'one' }]);
    expect(left.join(right, { type: "inner", leftKeys: ['id'], rightKeys: ['id'] }).rows).toHaveLength(1);
    expect(String(input.rows[0].v)).toBe('0.1');
});
