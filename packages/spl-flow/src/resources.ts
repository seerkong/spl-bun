import { ConnectionRegistry } from "./connection/registry";
export interface FlowResourceEvent {
    phase: "open" | "close";
    kind: "connection" | "cursor";
    name: string;
}
/** A run owns only leases it acquires. Caller-injected handles are never added. */
export class FlowResources {
    readonly registry: ConnectionRegistry;
    private readonly leases: (() => void | Promise<void>)[] = [];
    private readonly owned = new Set<unknown>();
    private closed = false;
    private closing?: Promise<void>;
    constructor(private readonly observe?: (event: FlowResourceEvent) => void) {
        this.registry = new ConnectionRegistry((phase, name) => observe?.({ phase, name, kind: "connection" }));
    }
    own<T extends {
        close: () => void | Promise<void>;
    }>(value: T, name: string, kind: "connection" | "cursor" = "cursor"): T {
        if (this.owned.has(value))
            return value;
        if (this.closed) {
            const cleanup = value.close();
            if (cleanup instanceof Promise)
                void cleanup.catch(() => { });
            throw new Error("Flow resource scope is closed");
        }
        this.owned.add(value);
        this.observe?.({ phase: "open", kind, name });
        let closed = false;
        this.leases.push(() => { if (closed)
            return; closed = true; const result = value.close(); if (result instanceof Promise)
            return result.finally(() => this.observe?.({ phase: "close", kind, name })); this.observe?.({ phase: "close", kind, name }); });
        return value;
    }
    close(): void | Promise<void> {
        if (this.closed)
            return this.closing;
        this.closed = true;
        const pending: Promise<unknown>[] = [], errors: unknown[] = [];
        for (const close of [...this.leases.reverse(), () => this.registry.closeAll()]) {
            try {
                const result = close();
                if (result instanceof Promise)
                    pending.push(result);
            }
            catch (error) {
                errors.push(error);
            }
        }
        this.leases.length = 0;
        this.owned.clear();
        if (pending.length)
            return this.closing = Promise.allSettled(pending).then(results => { for (const result of results)
                if (result.status === "rejected")
                    errors.push(result.reason); if (errors.length)
                throw Object.assign(new Error("Flow resource cleanup failed"), { causes: errors }); });
        if (errors.length)
            throw Object.assign(new Error("Flow resource cleanup failed"), { causes: errors });
    }
}
