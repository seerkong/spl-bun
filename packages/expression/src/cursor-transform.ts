import { Cursor } from "./cursor";
import { compileExpression } from "./evaluator";
import { compileBoundExpression, assertKnownColumns, tableRowScope } from "./binding";
import { truthy } from "./utils";
type Row = Record<string, unknown>;
function expression(source: string, cursor: Cursor<Row>, scope: Row, columns = cursor.columns) { return columns ? compileBoundExpression(source, columns, scope) : compileExpression(source); }
export function selectCursor(cursor: Cursor<Row>, source: string, scope: Row = {}): Cursor<Row> {
    const compiled = expression(source, cursor, scope);
    return cursor.filter(row => truthy(compiled.evaluate(tableRowScope(cursor.columns ?? Object.keys(row), row, scope))));
}
export function projectCursor(cursor: Cursor<Row>, columns: string[]): Cursor<Row> {
    if (new Set(columns).size !== columns.length)
        throw new Error("Duplicate cursor projection columns");
    if (cursor.columns)
        assertKnownColumns(columns, cursor.columns);
    return cursor.map(row => Object.fromEntries(columns.map(name => [name, row[name]])), columns);
}
export function deriveCursor(cursor: Cursor<Row>, columns: Record<string, string>, scope: Row = {}): Cursor<Row> {
    const names = cursor.columns ? [...cursor.columns] : undefined;
    const compiled = Object.entries(columns).map(([name, source]) => {
        const evaluator = expression(source, cursor, scope, names);
        if (names && !names.includes(name))
            names.push(name);
        return { name, evaluator };
    });
    return cursor.map(row => { const next = { ...row }; for (const { name, evaluator } of compiled)
        next[name] = evaluator.evaluate(tableRowScope(names ?? Object.keys(next), next, scope)); return next; }, names);
}
