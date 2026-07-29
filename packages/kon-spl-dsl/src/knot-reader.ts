/**
 * knot-reader — 从 Kon knot 读取 spl_* word 调用配置的纯函数。
 *
 * 关键事实（见 track findings）：
 * - parser 在同一 knot 内 Attr 出现后再写 `:{}` 时，会把 Conf 分裂到
 *   knot.Next 新节点（KnParserV1 guard），因此必须沿 Next 链合并读取。
 * - Conf/Metadata 中的裸标识符值是 KnWord（`_Type === "Word"`），取 .Value
 *   归一为字符串；其余字面量（string/number/boolean/vector/map）原样保留。
 * - Metadata 是 Map<KnWord, any>（键为 KnWord 对象，需按 .Value 匹配）。
 * - 选项归一：Metadata 的 `opt` 键（权威）优先于 Attr 省值键按出现序拼接（糖）。
 *
 * 本模块不依赖 kunun 运行时，仅按结构读取（duck typing），便于单测与适配。
 */

export interface WordCall {
  /** `#tag` 省值命名（如 `#orders`）；无则 undefined */
  name?: string;
  /** `:{}` Conf 合并归一后的 plain object（KnWord 值 → .Value 字符串） */
  conf: Record<string, unknown>;
  /** SPL 选项串：Metadata `#opt = ...` 权威，否则 Attr `@x` 按出现序拼接；无则 "" */
  options: string;
  /** `:[...]` Body 合并后的数组 */
  body: unknown[];
}

/** 结构判断：kunun KnWord（裸标识符）。导出供 words/* 复用（单点维护）。 */
export function isKnWord(v: unknown): v is { Value: string } {
  return (
    v != null &&
    typeof v === "object" &&
    (v as any)._Type === "Word" &&
    typeof (v as any).Value === "string"
  );
}

/** 归一：KnWord → .Value 字符串；其余原样（导出供 word 实现复用，如 spl_flow 的 cells map 值） */
export function normalizeKnValue(v: unknown): unknown {
  if (v && typeof v === "object" && "_Type" in v && v._Type === "Unknown") return null;
  return isKnWord(v) ? v.Value : v;
}

const normalizeValue = normalizeKnValue;

/** 选项值归一为字符串（KnWord 取 .Value；其余 String()） */
function normalizeOptionValue(v: unknown): string {
  const n = normalizeValue(v);
  return typeof n === "string" ? n : String(n);
}

/**
 * 读取一次 spl_* word 调用：沿 knot.Next 链合并 Conf / Metadata / Attr / Body / Name。
 *
 * 合并规则：后出现的节点覆盖同名 Conf 键与 Name；Attr 键按出现序保序；
 * Body 数组按链序拼接。选项优先级：Metadata `opt` > Attr 省值糖。
 */
export function readWordCall(knot: unknown): WordCall {
  let name: string | undefined;
  const conf: Record<string, unknown> = {};
  const body: unknown[] = [];
  let metadataOpt: string | undefined;
  const attrKeys: string[] = [];

  for (let node: any = knot; node != null; node = node.Next) {
    if (isKnWord(node.Name)) {
      name = node.Name.Value;
    }
    if (node.Conf != null && typeof node.Conf === "object") {
      for (const [k, v] of Object.entries(node.Conf)) {
        conf[k] = normalizeValue(v);
      }
    }
    if (node.Metadata instanceof Map) {
      for (const [k, v] of node.Metadata.entries()) {
        const key = isKnWord(k) ? k.Value : String(k);
        if (key === "opt") {
          metadataOpt = normalizeOptionValue(v);
        }
      }
    }
    if (node.Attr != null && typeof node.Attr === "object") {
      for (const [k, v] of Object.entries(node.Attr)) {
        // 省值 Attr 形如 { a: true }；按对象插入序（即源码出现序）收集
        if (v === true && !attrKeys.includes(k)) {
          attrKeys.push(k);
        }
      }
    }
    if (Array.isArray(node.Body)) {
      body.push(...node.Body);
    }
  }

  const options = metadataOpt !== undefined ? metadataOpt : attrKeys.join("");
  return { name, conf, options, body };
}
