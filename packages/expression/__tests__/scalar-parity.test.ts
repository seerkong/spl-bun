import { expect, test } from 'bun:test';
import { evaluateExpression as e, decimal, long, aggregateValues, parseJsonPreservingNumbers } from '../src';
test('Variant null units, typed addition, connection division and Date arithmetic', () => {
    for (const [s, value] of [['null+3', 3], ['3+null', 3], ['null-null', null], ['null-3', -3], ['3-null', 3], ["'12'+3", 15], ["3+'bad'", 3], ["'a'+'b'", 'ab'], ["'a'/3", 'a3'], ['null*3', null], ['null/3', null], ['null<1', true], ['[1,2]==[1,2]', true], ['[1,2]<[1,3]', true]] as const)
        expect(e(s, {})).toEqual(value);
    expect(e('[1,2]*2', {})).toEqual([1, 2, 1, 2]);
    expect(() => e('true+2', {})).toThrow('operand');
    expect(() => e("'2'-1", {})).toThrow('operand');
    expect(() => e("1<'2'", {})).toThrow('compare');
    const day = new Date(2024, 1, 28, 12);
    const result = e('day+1', { day }) as Date;
    expect([result.getMonth(), result.getDate(), result.getHours()]).toEqual([1, 29, 12]);
    expect(day.getDate()).toBe(28);
    expect(e('next-day', { day, next: result })).toBe(1);
    expect(e('day==other', { day, other: new Date(day) })).toBe(true);
});
test('long literals, conversion, overflow, decimal promotion and Java scale16 rounding are exact', () => {
    expect(e('9007199254740992+1', {})).toBe(9007199254740993n);
    expect(e("long('9223372036854775807')+1", {})).toBe(-9223372036854775808n);
    expect(e("long('9007199254740993')*2", {})).toBe(18014398509481986n);
    expect(e("long('9007199254740993')\\2", {})).toBe(4503599627370496n);
    expect(String(e("decimal('0.1')+decimal('0.2')", {}))).toBe('0.3');
    expect(String(e("decimal('1')/3", {}))).toBe('0.3333333333333333');
    expect(String(e("decimal('2')/3", {}))).toBe('0.6666666666666667');
    expect(String(e("decimal('9007199254740993')+1", {}))).toBe('9007199254740994');
    expect(e("decimal('1.00')==long('1')", {})).toBe(true);
    expect(e('1e3+.5', {})).toBe(1000.5);
    expect(long('9223372036854775808')).toBeNull();
    expect(decimal('bad')).toBeNull();
    expect(() => long(9007199254740992)).toThrow('exact text');
    expect(() => decimal('1e999999')).toThrow('limit');
    expect(() => e("decimal('1')/0", {})).toThrow('zero');
});
test('exact aggregate state and typed keys do not demote decimal or long to Number', () => {
    const xs = [decimal('0.1'), null, decimal('0.2')];
    expect(String(aggregateValues('sum', xs))).toBe('0.3');
    expect(String(aggregateValues('avg', xs))).toBe('0.15');
    expect(e("sum([long('9007199254740993'),1])", {})).toBe(9007199254740994n);
    expect(e("icount([decimal('1.00'),1,long('1'),'1'])", {})).toBe(2);
    expect(e("icount([decimal('1e21'),long('1000000000000000000')*1000,1e21])", {})).toBe(2); // long wraps at 64 bits
    expect(e("json_stringify([long('9007199254740993'),decimal('0.30')])", {})).toBe('["9007199254740993","0.3"]');
    expect(parseJsonPreservingNumbers('{"id":9007199254740993,"text":"9007199254740993","v":0.5}')).toEqual({ id: '9007199254740993', text: '9007199254740993', v: 0.5 });
});

test('signed long minimum and unsafe JSON scientific tokens retain their exact source values',()=>{
 expect(e('-9223372036854775808',{})).toBe(-9223372036854775808n);
 expect(parseJsonPreservingNumbers('{"x":9007199254740993.0,"y":9007199254740993e0,"v":0.5}')).toEqual({x:'9007199254740993.0',y:'9007199254740993e0',v:0.5});
 expect(String(e('decimal(0.1)',{}))).toBe('0.1000000000000000055511151231257827021181583404541015625');
});

test('arithmetic promotes safe integer operands before an unsafe result loses precision',()=>{
 expect(e('9007199254740991+2',{})).toBe(9007199254740993n);
 expect(e('9007199254740991*3',{})).toBe(27021597764222973n);
 expect(e('-9007199254740991-2',{})).toBe(-9007199254740993n);
 expect(e('sum([9007199254740991,2])',{})).toBe(9007199254740993n);
});
