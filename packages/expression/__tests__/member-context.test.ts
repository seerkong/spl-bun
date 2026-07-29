import { expect, test } from 'bun:test';
import { evaluateExpression as e, compileBoundExpression, Cursor, builtins, MemberFunctionRegistry } from '../src';
test('member row AST binds outer scope, sparse columns and sequential aliases without changing inputs', () => {
    const input = { schema: [{ name: 'a' }, { name: 'sparse' }], rows: [{ a: 100 }, { a: 2, sparse: 5 }] };
    const scope = { input, rate: 2, sparse: 999, a: 999 };
    const result = e('input.derive(a*rate:gross,gross+1:next,"literal":label).select(gross>10)', scope) as any;
    expect(result.rows).toEqual([{ a: 100, gross: 200, next: 201, label: 'literal' }]);
    expect((e('input.derive({gross:"a*rate",empty:"sparse"})', scope) as any).rows.map((r: any) => [r.gross, r.empty])).toEqual([[200, undefined], [4, 5]]);
    expect(e('input.calc(a*rate)', scope)).toEqual([200, 4]);
    expect(e('input.sum(a*rate)', scope)).toBe(204);
    expect(e('input.count(a>10)', scope)).toBe(1);
    expect(e('input.calc("a*rate")', scope)).toEqual([200, 4]);
    expect(e('input.calc(a*custom)', { ...scope, custom: 3 })).toEqual([300, 6]);
    expect(e('input.derive(a+1:a,a+1:b)', scope)).toMatchObject({ rows: [{ a: 101, b: 102 }, { a: 3, b: 4 }] });
    expect(input.rows).toEqual([{ a: 100 }, { a: 2, sparse: 5 }]);
    expect(scope.a).toBe(999);
    expect(() => e('input.derive(missing:x)', scope)).toThrow('missing');
    expect(() => e('input.derive(a:x,a:y;2)', scope)).toThrow('groups');
    expect(() => e('input.derive@x(a:x)', scope)).toThrow('unsupported');
    expect(() => e('input.derive(a:x,a:x)', scope)).toThrow('Duplicate');
    expect(() => e('input.select(a:bad)', scope)).toThrow('aliases');
    // The outer binder defers nested receiver row names to its own adapter.
    expect(compileBoundExpression('input.sum(a*rate)', ['input'], { rate: 2 }).evaluate(scope)).toBe(204);
});
test('caller function/member registries survive row compilation and quoted expression adapters', () => {
    const input = [{ a: 1 }, { a: 2 }];
    const functions = { ...builtins, twice: (v: unknown) => Number(v) * 2 };
    expect(e('input.calc("twice(a)")', { input }, functions)).toEqual([2, 4]);
    const members = new MemberFunctionRegistry().add('calc', () => true, () => 99);
    expect(e('input.calc(missing)', { input }, functions, members)).toBe(99);
});
test('ordered @m operations consume multiplicities and recursive conj rejects cycles', () => {
    const values = [[1, 1, 3], [1, 2, 3, 3]];
    expect(e('values.union@m()', { values })).toEqual([1, 1, 2, 3, 3]);
    expect(e('values.isect@m()', { values })).toEqual([1, 3]);
    expect(e('values.diff@m()', { values })).toEqual([1]);
    expect(e('values.conj@m()', { values })).toEqual([1, 1, 1, 2, 3, 3, 3]);
    expect(e('items.union@m(parts)', { items: [{ parts: [1, 3] }, { parts: [2, 4] }] })).toEqual([1, 2, 3, 4]);
    expect(e('[[1,[2,[3]]],null].conj@r()', {})).toEqual([1, 2, 3]);
    expect(() => e('[[2,1],[3]].union@m()', {})).toThrow('ascending');
    expect(() => e('values.union@x()', { values })).toThrow('unsupported');
    expect(() => e('values.union(;1)', { values })).toThrow('groups');
    const cycle: unknown[] = [];
    cycle.push(cycle);
    expect(() => e('cycle.conj@r()', { cycle })).toThrow('acyclic');
});
test('async cursor member expressions share explicit scope and do not materialize upstream', async () => {
    let reads = 0;
    const cursor = Cursor.from((function* () { for (const a of [1, 2, 3, 4]) {
        reads++;
        yield { a };
    } })(), { columns: ['a'] });
    const next = e('cursor.derive(a*rate:gross,gross+1:next).select(gross>limit)', { cursor, rate: 2, limit: 4 }) as Cursor<Record<string, unknown>>;
    expect(reads).toBe(0);
    expect(await next.fetch(1)).toEqual([{ a: 3, gross: 6, next: 7 }]);
    expect(reads).toBe(3);
    await next.close();
    expect(cursor.state).toBe('closed');
});
test('new builtin overloads never silently discard option/group arguments', () => {
    for (const source of ["long@x('1')", "decimal('1';'2')", "elapse@m(date('2024-01-01'),1,'y')", "interval@r(date('2024-01-01'),date('2024-01-02'),'m')"])
        expect(() => e(source, {})).toThrow('overload');
});
