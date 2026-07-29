export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function truthy(value: unknown): boolean {
  // SPL Variant.isTrue: only nullish and the boolean false are false.
  return !isNullish(value) && value !== false;
}

export function assertArity(name: string, args: unknown[], min: number, max?: number): void {
  if (args.length < min || (max !== undefined && args.length > max)) {
    throw new Error(`Function ${name} expects ${min}${max ? `-${max}` : ""} arguments, got ${args.length}`);
  }
}
