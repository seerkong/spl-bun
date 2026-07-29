import type { DataSource, DataSourceConfig } from "../datasource/types";
import { DataSourceFactory } from "../datasource/factory";
export class ConnectionRegistry {
    private readonly connections = new Map<string, DataSource>();
    constructor(private readonly observe?: (phase: "open" | "close", name: string) => void) { }
    register(config: DataSourceConfig): void {
        if (this.connections.has(config.name)) {
            throw new Error(`Connection '${config.name}' already registered`);
        }
        const dataSource = DataSourceFactory.create(config);
        this.connections.set(config.name, dataSource);
        this.observe?.("open", config.name);
    }
    get(name: string): DataSource | undefined {
        return this.connections.get(name);
    }
    has(name: string): boolean {
        return this.connections.has(name);
    }
    closeAll(): void | Promise<void> {
        const sources = [...this.connections];
        this.connections.clear();
        const pending: Promise<unknown>[] = [], errors: unknown[] = [];
        for (const [name, dataSource] of sources) {
            try {
                const result = dataSource.close?.();
                if (result instanceof Promise)
                    pending.push(result.finally(() => this.observe?.("close", name)));
                else
                    this.observe?.("close", name);
            }
            catch (error) {
                errors.push(error);
                this.observe?.("close", name);
            }
        }
        if (pending.length)
            return Promise.allSettled(pending).then(results => { for (const result of results)
                if (result.status === "rejected")
                    errors.push(result.reason); if (errors.length)
                throw Object.assign(new Error("Connection cleanup failed"), { causes: errors }); });
        if (errors.length)
            throw Object.assign(new Error("Connection cleanup failed"), { causes: errors });
    }
}
