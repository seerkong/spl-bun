/** Published Kunun entry used by both runtime and converter tests. */
export const KUNUN_RUNTIME_ENTRY = "kunun";

export const KUNUN_CONVERTER_ENTRY = "kunun";

/**
 * 探测 kunun 入口文件是否存在；缺失时打印统一的跳过提示并返回 false
 * （调用方配合 describe.skipIf / test.skipIf 使用）。
 */
export function detectKunun(entry: string, suiteName: string): boolean {
  try {
    import.meta.resolve(entry);
    return true;
  } catch {
    // Keep the diagnostic close to suites that dynamically import Kunun.
  }
  console.warn(
    `[kon-spl-dsl] 跳过 ${suiteName} 测试：无法解析已声明的 ${entry} 依赖。` +
      "请在 workspace 根目录执行 bun install。",
  );
  return false;
}
