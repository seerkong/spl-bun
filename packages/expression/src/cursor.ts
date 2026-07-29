export type CursorState = "open" | "eof" | "closed" | "cancelled" | "error";
export type CursorIterator<T> = AsyncIterator<T> | Iterator<T>;
export type CursorSource<T> = CursorIterator<T> | ((signal: AbortSignal) => CursorIterator<T> | Promise<CursorIterator<T>>);
export interface CursorOptions {
    maxBatch?: number;
    signal?: AbortSignal;
    timeoutMs?: number;
    columns?: readonly string[];
}
/** One position/terminal owner. Reads start only on demand; queued commands are
 * linearized while cancellation can interrupt a pending cooperative source.
 */
export class Cursor<T> implements AsyncIterable<T> {
    private status: CursorState = "open";
    private offset = 0;
    private tail: Promise<unknown> = Promise.resolve();
    private iteratorPromise?: Promise<CursorIterator<T>>;
    private closing?: Promise<void>;
    private readonly controller = new AbortController();
    private failure?: Error;
    readonly maxBatch: number;
    readonly columns?: readonly string[];
    private readonly abortListener: () => void;
    constructor(private readonly source: CursorSource<T>, private readonly options: CursorOptions = {}) {
        if (typeof source !== "function")
            this.iteratorPromise = Promise.resolve(source);
        this.maxBatch = options.maxBatch ?? 1024;
        this.columns = options.columns ? Object.freeze([...options.columns]) : undefined;
        if (!Number.isSafeInteger(this.maxBatch) || this.maxBatch < 1 || this.maxBatch > 65536)
            throw new Error("Cursor maxBatch must be in 1..65536");
        if (options.timeoutMs !== undefined && (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0))
            throw new Error("Cursor timeoutMs must be positive");
        this.abortListener = () => { void this.cancel(options.signal?.reason).catch(() => { }); };
        options.signal?.addEventListener("abort", this.abortListener, { once: true });
        if (options.signal?.aborted)
            this.abortListener();
    }
    static from<T>(source: Iterable<T> | AsyncIterable<T>, options?: CursorOptions): Cursor<T> {
        return new Cursor(() => Symbol.asyncIterator in source ? (source as AsyncIterable<T>)[Symbol.asyncIterator]() : (source as Iterable<T>)[Symbol.iterator](), options);
    }
    get state(): CursorState { return this.status; }
    get position(): number { return this.offset; }
    fetch(count = this.maxBatch): Promise<T[]> {
        if (!Number.isSafeInteger(count) || count < 0 || count > this.maxBatch)
            return Promise.reject(new Error("Cursor fetch count must be in 0.." + this.maxBatch));
        return this.enqueue(async () => (await this.consume(count, true)).values);
    }
    skip(count: number): Promise<number> {
        if (!Number.isSafeInteger(count) || count < 0)
            return Promise.reject(new Error("Cursor skip count must be a nonnegative integer"));
        return this.enqueue(async () => (await this.consume(count, false)).count);
    }
    private async consume(count: number, retain: boolean): Promise<{
        values: T[];
        count: number;
    }> {
        this.assertReadable();
        const values: T[] = [];
        let consumed = 0;
        if (!count || this.status === "eof")
            return { values, count: consumed };
        let timer: ReturnType<typeof setTimeout> | undefined;
        if (this.options.timeoutMs)
            timer = setTimeout(() => { void this.cancel(new Error("Cursor read timed out")).catch(() => { }); }, this.options.timeoutMs);
        try {
            const iterator = await this.wait(this.iterator());
            while (consumed < count) {
                const next = await this.wait(Promise.resolve(iterator.next()));
                this.assertReadable();
                if (next.done) {
                    await this.terminate("eof");
                    break;
                }
                if (retain)
                    values.push(next.value);
                consumed++;
                this.offset++;
                if (this.offset % 1024 === 0)
                    await this.pause();
            }
            this.assertReadable();
            return { values, count: consumed };
        }
        catch (error) {
            const reason = error instanceof Error ? error : new Error(String(error));
            await this.terminate("error", reason);
            throw reason;
        }
        finally {
            if (timer)
                clearTimeout(timer);
        }
    }
    private async pause(): Promise<void> { await new Promise<void>(resolve => setTimeout(resolve, 0)); this.assertReadable(); }
    close(): Promise<void> { return this.terminate("closed", new Error("Cursor is closed")); }
    cancel(reason?: unknown): Promise<void> { return this.terminate("cancelled", reason instanceof Error ? reason : new Error(reason === undefined ? "Cursor cancelled" : String(reason))); }
    map<U>(mapper: (value: T) => U | Promise<U>, columns?: readonly string[]): Cursor<U> {
        const upstream = this;
        return new Cursor<U>(() => ({ next: async () => { const values = await upstream.fetch(1); return values.length ? { done: false, value: await mapper(values[0]) } : { done: true, value: undefined as U }; }, return: async () => { await upstream.close(); return { done: true, value: undefined as U }; } }), { maxBatch: this.maxBatch, columns });
    }
    filter(predicate: (value: T) => boolean | Promise<boolean>): Cursor<T> {
        const upstream = this;
        return new Cursor<T>(() => ({ next: async () => { while (true) {
                const values = await upstream.fetch(1);
                if (!values.length)
                    return { done: true, value: undefined as T };
                if (await predicate(values[0]))
                    return { done: false, value: values[0] };
            } }, return: async () => { await upstream.close(); return { done: true, value: undefined as T }; } }), { maxBatch: this.maxBatch, columns: this.columns });
    }
    async collect(maxRows: number): Promise<T[]> {
        if (!Number.isSafeInteger(maxRows) || maxRows < 0)
            throw new Error("Cursor materialization requires a nonnegative maxRows bound");
        const rows: T[] = [];
        try {
            while (true) {
                const batch = await this.fetch(Math.min(this.maxBatch, Math.max(1, maxRows - rows.length + 1)));
                if (!batch.length)
                    break;
                rows.push(...batch);
                if (rows.length > maxRows)
                    throw new Error(`Cursor materialization exceeds maxRows ${maxRows}`);
            }
            return rows;
        }
        finally {
            await this.close();
        }
    }
    [Symbol.asyncIterator](): AsyncIterator<T> {
        return { next: async () => { const values = await this.fetch(1); return values.length ? { done: false, value: values[0] } : { done: true, value: undefined as T }; }, return: async () => { await this.close(); return { done: true, value: undefined as T }; }, throw: async (error) => { await this.cancel(error); throw error; } };
    }
    private enqueue<U>(command: () => Promise<U>): Promise<U> { const result = this.tail.then(command); this.tail = result.catch(() => { }); return result; }
    private wait<U>(operation: Promise<U>): Promise<U> {
        const signal = this.controller.signal;
        return new Promise((resolve, reject) => {
            const abort = () => reject(this.failure ?? new Error("Cursor cancelled"));
            if (signal.aborted) {
                abort();
                return;
            }
            signal.addEventListener("abort", abort, { once: true });
            operation.then(value => { signal.removeEventListener("abort", abort); resolve(value); }, error => { signal.removeEventListener("abort", abort); reject(error); });
        });
    }
    private iterator(): Promise<CursorIterator<T>> { return this.iteratorPromise ??= Promise.resolve().then(() => typeof this.source === "function" ? this.source(this.controller.signal) : this.source); }
    private assertReadable(): void { if (this.status !== "open" && this.status !== "eof")
        throw this.failure ?? new Error(`Cursor is ${this.status}`); }
    private terminate(state: Exclude<CursorState, "open">, reason?: Error): Promise<void> {
        if (this.closing)
            return this.closing;
        this.status = state;
        this.failure = reason;
        this.options.signal?.removeEventListener("abort", this.abortListener);
        if (state !== "eof")
            this.controller.abort(reason);
        this.closing = (async () => { const iterator = await this.iteratorPromise; await iterator?.return?.(); })().catch(error => {
            this.status = "error";
            const cleanup = error instanceof Error ? error : new Error(String(error));
            this.failure = reason ? Object.assign(new Error(`${reason.message}; cursor cleanup failed: ${cleanup.message}`), { cause: reason, cleanup }) : cleanup;
            throw this.failure;
        });
        return this.closing;
    }
}
