import { builtins, type FunctionRegistry } from "./functions";

export class FunctionRegistryBuilder {
  private registry: FunctionRegistry;

  constructor(base: FunctionRegistry = builtins) {
    this.registry = { ...base };
  }

  add(name: string, fn: (...args: unknown[]) => unknown): this {
    this.registry[name.toLowerCase()] = fn;
    return this;
  }

  addAll(map: FunctionRegistry): this {
    for (const [name, fn] of Object.entries(map)) {
      this.registry[name.toLowerCase()] = fn;
    }
    return this;
  }

  build(): FunctionRegistry {
    return { ...this.registry };
  }
}
