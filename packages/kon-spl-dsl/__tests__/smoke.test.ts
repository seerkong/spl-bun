/**
 * 冒烟测试：验证经 tsconfig paths 打通对本机 kunun 仓库的依赖，
 * 并验证 prefix keyword 注册扩展点端到端可用。
 *
 * 前置条件：本机存在 kunun 仓库（路径见本包 tsconfig.json 的 paths），
 * Kunun 由本包声明为正式依赖。依赖尚未安装时本测试跳过。
 */
import { describe, test, expect } from "bun:test";
import { detectKunun, KUNUN_RUNTIME_ENTRY } from "./helpers/kunun";

const kununAvailable = detectKunun(KUNUN_RUNTIME_ENTRY, "冒烟");

describe("kon-spl-dsl smoke", () => {
  test.skipIf(!kununAvailable)(
    "registerPrefixKeyword 探针 word 可在 Kon 源码中求值",
    async () => {
      const { RuntimeInterpreter, RuntimeOpCode } = await import(
        "kunun"
      );

      const rt = RuntimeInterpreter.CreateRuntime();
      rt.registerPrefixKeyword("spl_ping", (runtime: any, nodeToRun: any) => {
        const knot = nodeToRun.knot;
        // `#hello` 省值落在 knot.Name（KnWord，值取 .Value）
        const name = knot?.Name?.Value ?? null;
        // 注意：必须用 RuntimeOpCode 枚举，字符串会报 Instruction handler not found
        runtime.addOpDirectly(RuntimeOpCode.PushValue, `pong:${name}`);
      });

      const result = RuntimeInterpreter.EvalBlockSourceWithRuntimeSync(
        rt,
        "(spl_ping #hello)",
      );
      expect(result).toBe("pong:hello");
    },
  );
});
