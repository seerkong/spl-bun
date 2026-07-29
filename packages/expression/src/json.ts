/** Bun's source-aware JSON reviver preserves unsafe integer tokens as text.
 * This matches CSV import and stays safe across HTTP/worker/SQLite boundaries.
 */
export function parseJsonPreservingNumbers(source: string): unknown {
    return JSON.parse(source, ((_key: string, value: unknown, context?: {
        source?: string;
    }) => {
        if (typeof value === 'number' && (Number.isInteger(value) || !Number.isFinite(value)) && !Number.isSafeInteger(value) && context?.source)
            return context.source;
        return value;
    }) as (key: string, value: unknown) => unknown);
}
export function stringifySplJson(value: unknown): string | undefined {
    return JSON.stringify(value, (_key, value) => typeof value === 'bigint' ? String(value) : value);
}
