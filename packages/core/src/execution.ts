import { DataSet } from "./dataset";
import type { JoinSpec, Row, Value, WindowSpec } from "./dataset";

export type StepResult = DataSet | Row | Value;

export interface StepDefinition {
  name: string;
  execute: (context: ExecutionContext) => Promise<StepResult> | StepResult;
}

export class StepError extends Error {
  readonly stepName: string;
  readonly cause?: unknown;

  constructor(stepName: string, message: string, cause?: unknown) {
    super(message);
    this.stepName = stepName;
    this.cause = cause;
  }
}

export class ExecutionContext {
  private readonly results = new Map<string, StepResult>();

  setResult(name: string, value: StepResult): void {
    this.results.set(name, value);
  }

  getResult(name: string): StepResult {
    if (!this.results.has(name)) {
      throw new StepError(name, `No result found for step '${name}'`);
    }
    return this.results.get(name)!;
  }

  getDataSet(name: string): DataSet {
    const result = this.getResult(name);
    if (result instanceof DataSet) {
      return result;
    }
    throw new StepError(name, `Result for step '${name}' is not a DataSet`);
  }

  entries(): Iterable<[string, StepResult]> {
    return this.results.entries();
  }
}

export class Engine {
  async run(steps: StepDefinition[]): Promise<Map<string, StepResult>> {
    const context = new ExecutionContext();
    for (const step of steps) {
      try {
        const output = await step.execute(context);
        context.setResult(step.name, output);
      } catch (err) {
        throw new StepError(step.name, `Step '${step.name}' failed: ${err instanceof Error ? err.message : String(err)}`, err);
      }
    }
    return new Map([...context.entries()]);
  }
}

export function unsupportedOperation(name: string): never {
  throw new Error(`Unsupported operator: ${name}`);
}

export interface JoinStepConfig extends JoinSpec {
  leftStep: string;
  rightStep: string;
}

export function createJoinStep(name: string, config: JoinStepConfig): StepDefinition {
  return {
    name,
    execute: (ctx) => {
      const left = ctx.getDataSet(config.leftStep);
      const right = ctx.getDataSet(config.rightStep);
      return left.join(right, config);
    },
  };
}

export interface WindowStepConfig {
  sourceStep: string;
  spec: WindowSpec;
}

export function createWindowStep(name: string, config: WindowStepConfig): StepDefinition {
  return {
    name,
    execute: (ctx) => {
      const source = ctx.getDataSet(config.sourceStep);
      return source.window(config.spec);
    },
  };
}

export interface FilterStepConfig {
  sourceStep: string;
  expression: string;
  scope?: Record<string, unknown>;
}

export function createFilterStep(name: string, config: FilterStepConfig): StepDefinition {
  return {
    name,
    execute: (ctx) => {
      const source = ctx.getDataSet(config.sourceStep);
      const baseScope = Object.fromEntries(ctx.entries());
      return source.filterExpr(config.expression, { ...baseScope, ...(config.scope ?? {}) });
    },
  };
}

export interface ComputeStepConfig {
  sourceStep: string;
  columns: Record<string, string>;
  scope?: Record<string, unknown>;
}

export function createComputeStep(name: string, config: ComputeStepConfig): StepDefinition {
  return {
    name,
    execute: (ctx) => {
      const source = ctx.getDataSet(config.sourceStep);
      const baseScope = Object.fromEntries(ctx.entries());
      return source.withComputedColumns(config.columns, { ...baseScope, ...(config.scope ?? {}) });
    },
  };
}
