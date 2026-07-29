import { Engine, createComputeStep, createFilterStep, createJoinStep, createWindowStep } from "depa-data-core";
import { compileExpression, evaluateExpression } from "depa-data-expression";
import { SQLiteAdapter, createSqliteStep, type QueryOptions } from "depa-data-sqlite-adapter";
import type { StepDefinition } from "depa-data-core";

// Runtime pattern defaults
export interface ComposerOptions {
  defaultDbPath?: string;
}

export interface ComposerOuterCtx {
  requestId?: string;
}

export interface ComposerInnerCtx {
  lastResults?: Map<string, unknown>;
}

export interface ComposerErrorCtx {
  lastError?: unknown;
}

export interface ComposerSupport {
  now?: () => Date;
}

export interface ComposerAdapters {
  sqliteQuery?: (options: QueryOptions) => unknown | Promise<unknown>;
  sqliteStep?: (name: string, options: QueryOptions) => StepDefinition;
}

const createDefaultOptions = (): ComposerOptions => ({});
const createDefaultOuterCtx = (): ComposerOuterCtx => ({});
const createDefaultInnerCtx = (): ComposerInnerCtx => ({});
const createDefaultErrorCtx = (): ComposerErrorCtx => ({});
const createDefaultSupport = (): ComposerSupport => ({ now: () => new Date() });
const createDefaultAdapters = (): ComposerAdapters => ({
  sqliteQuery: async (options) => {
    return SQLiteAdapter.query(options);
  },
  sqliteStep: (name, options) => createDefaultSqliteStep(name, options),
});

function createDefaultSqliteStep(name: string, options: QueryOptions): StepDefinition {
  return createSqliteStep(name, options);
}

/**
 * Explicit runtime object following the runtime设计模式.
 * No implicit DI: dependencies and contexts are declared here and wired by the caller.
 */
export class ComposerRuntime {
  // Logical dependencies
  public engine: Engine;
  public adapters: ComposerAdapters;
  public support: ComposerSupport;

  // Expression helpers
  public compileExpression = compileExpression;
  public evaluateExpression = evaluateExpression;

  // Config
  public options: ComposerOptions;

  // Contexts
  public outerCtx: ComposerOuterCtx;
  public innerCtx: ComposerInnerCtx;
  public errorCtx: ComposerErrorCtx;

  constructor(init?: {
    options?: ComposerOptions;
    adapters?: Partial<ComposerAdapters>;
    support?: Partial<ComposerSupport>;
    outerCtx?: ComposerOuterCtx;
    innerCtx?: ComposerInnerCtx;
    errorCtx?: ComposerErrorCtx;
    engine?: Engine;
  }) {
    this.options = { ...createDefaultOptions(), ...(init?.options ?? {}) };
    this.adapters = { ...createDefaultAdapters(), ...(init?.adapters ?? {}) };
    this.support = { ...createDefaultSupport(), ...(init?.support ?? {}) };
    this.outerCtx = init?.outerCtx ?? createDefaultOuterCtx();
    this.innerCtx = init?.innerCtx ?? createDefaultInnerCtx();
    this.errorCtx = init?.errorCtx ?? createDefaultErrorCtx();
    this.engine = init?.engine ?? new Engine();
  }
}

export interface PipelineConfig {
  steps: StepDefinition[];
}

export function createComposerRuntime(init?: ConstructorParameters<typeof ComposerRuntime>[0]): ComposerRuntime {
  return new ComposerRuntime(init);
}

export function runPipeline(runtime: ComposerRuntime, config: PipelineConfig): Promise<Map<string, unknown>> {
  return runtime.engine.run(config.steps);
}

export function createSqliteLoadStep(
  runtime: ComposerRuntime,
  name: string,
  options: Omit<QueryOptions, "dbPath"> & { dbPath?: string },
): StepDefinition {
  const dbPath = options.dbPath ?? runtime.options.defaultDbPath;
  if (!dbPath) {
    throw new Error("No dbPath provided for SQLite load");
  }
  const queryOptions: QueryOptions = { ...options, dbPath };
  if (runtime.adapters.sqliteStep) {
    return runtime.adapters.sqliteStep(name, queryOptions);
  }
  return createDefaultSqliteStep(name, queryOptions);
}

export function createJoinPipelineStep(
  runtime: ComposerRuntime,
  name: string,
  config: Parameters<typeof createJoinStep>[1],
): StepDefinition {
  return createJoinStep(name, config);
}

export function createWindowPipelineStep(
  runtime: ComposerRuntime,
  name: string,
  config: Parameters<typeof createWindowStep>[1],
): StepDefinition {
  return createWindowStep(name, config);
}

export function createComputePipelineStep(
  runtime: ComposerRuntime,
  name: string,
  config: Parameters<typeof createComputeStep>[1],
): StepDefinition {
  return createComputeStep(name, config);
}

export function createFilterPipelineStep(
  runtime: ComposerRuntime,
  name: string,
  config: Parameters<typeof createFilterStep>[1],
): StepDefinition {
  return createFilterStep(name, config);
}
