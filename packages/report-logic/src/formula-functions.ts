import { FormulaCellSet, formulaBinary, formulaTruthy, scalar, values, type FormulaEnvironment, type FormulaCellView } from "./formula-expression";

type Handler = (args: unknown[], env: FormulaEnvironment) => unknown;
const numbers = (value: unknown): number[] => values(value).filter((v): v is number => typeof v === "number");
const sum = (items: readonly number[]) => items.reduce((a, b) => a + b, 0);
const nullable = (args: unknown[], fn: (value: unknown) => unknown) => args[0] == null ? null : fn(args[0]);
function one(value: unknown): FormulaCellView {
  if (!(value instanceof FormulaCellSet) || value.cells.length !== 1) throw new Error("Formula requires a single cell instance");
  return value.cells[0];
}
function siblings(args: unknown[], env: FormulaEnvironment): { cell: FormulaCellView; cells: readonly FormulaCellView[] } {
  const cell = one(args[0]), parent = args[1] === undefined ? undefined : one(args[1]);
  return { cell, cells: env.relatives(cell, parent).cells };
}
function matches(value: unknown, criterion: unknown): boolean {
  const cond = scalar(criterion);
  if (typeof cond !== "string") return scalar(value) === cond;
  if (/[*?]/.test(cond)) {
    const escaped = cond.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
    return new RegExp(`^${escaped}$`, "u").test(String(scalar(value) ?? ""));
  }
  const compare = /^(>=|<=|<>|>|<|=)(.*)$/.exec(cond);
  if (!compare) return scalar(value) === cond;
  const raw = scalar(value), target = compare[2].trim();
  const expected = typeof raw === "number" && target !== "" && Number.isFinite(Number(target)) ? Number(target) : target;
  return Boolean(formulaBinary(compare[1], typeof expected === "number" ? raw : String(raw ?? ""), expected));
}
const variance = (value: unknown) => {
  const nums = numbers(value);
  if (nums.length < 2) return null;
  const mean = sum(nums) / nums.length;
  return sum(nums.map(n => (n - mean) ** 2)) / (nums.length - 1);
};

/** Domain functions operate on resolved instance sets; no workbook cache is authority. */
export const formulaFunctions: Readonly<Record<string, Handler>> = {
  SUM: args => args.length ? sum(args.flatMap(numbers)) : null,
  PRODUCT: args => nullable(args, value => numbers(value).reduce((a, b) => a * b, 1)),
  SUMPRODUCT: args => {
    if (args[0] == null || args[1] == null) return null;
    const right = values(args[1]);
    return values(args[0]).reduce<number>((total, a, i) => {
      const b = right[i]; return total + (typeof a === "number" && typeof b === "number" ? a * b : 0);
    }, 0);
  },
  COUNT: args => nullable(args, value => numbers(value).length),
  COUNTA: args => nullable(args, value => values(value).filter(v => v !== null && v !== undefined && v !== "").length),
  AVERAGE: args => nullable(args, value => { const nums = numbers(value); return sum(nums) / nums.length; }),
  MIN: args => nullable(args, value => { const nums = numbers(value); return nums.length ? nums.reduce((a,b) => Math.min(a,b)) : null; }),
  MAX: args => nullable(args, value => { const nums = numbers(value); return nums.length ? nums.reduce((a,b) => Math.max(a,b)) : null; }),
  MEDIAN: args => nullable(args, value => {
    const nums = numbers(value).sort((a, b) => a - b), mid = Math.floor(nums.length / 2);
    if (!nums.length) return null;
    if (nums.length % 2) return nums[mid];
    return (nums[mid - 1] + nums[mid]) / 2;
  }),
  STDEV: args => { const v = variance(args[0]); return v === null ? null : Math.sqrt(v); },
  VAR: args => variance(args[0]),
  COUNTIF: args => args[0] == null || args[1] == null ? null : values(args[0]).filter(v => matches(v, args[1])).length,
  SUMIF: args => {
    if (args[0] == null || args[1] == null) return null;
    const source = values(args[0]), amounts = args[2] == null ? source : values(args[2]);
    return source.reduce<number>((total, value, i) => total + (i < amounts.length && matches(value, args[1]) && typeof amounts[i] === "number" ? amounts[i] as number : 0), 0);
  },
  CONCAT: args => args.length ? args.flatMap(values).filter(v => v != null).map(String).join("") : null,
  PROPORTION: (args, env) => {
    if(!(args[0] instanceof FormulaCellSet))throw new Error("PROPORTION requires a cell set");
    if(args[0].value==null)return null;
    const { cell, cells } = siblings(args, env);
    const value=cell.value;
    let numerator:number|null;
    if(typeof value==="number")numerator=value;
    else if(value instanceof Date)numerator=value.getTime();
    else if(typeof value==="string"){
      if(value==="")numerator=null;
      else{
        const number=/^[+-]?0x/i.test(value)?value.replace(/[lL]$/,""):value.replace(/[dDfFlL]$/,"");
        if(!/^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|0[xX][\da-fA-F]+)$/.test(number))throw new Error(`PROPORTION cannot convert ${value} to a number`);
        const hex=/^([+-]?)0x([\da-f]+)$/i.exec(number);
        numerator=hex?(hex[1]==="-"?-1:1)*parseInt(hex[2],16):Number(number);
      }
    }else throw new Error("PROPORTION requires a numeric value");
    const denominator=sum(cells.map(c => c.value).filter((v): v is number => typeof v === "number"));
    return numerator===null||Math.abs(denominator)<=1e-20?NaN:numerator/denominator;
  },
  RANK: (args, env) => {
    const { cell, cells } = siblings(args, env);
    if(cell.value==null)return null;
    if(!cells.some(other=>other.id===cell.id))return -1;
    if(typeof cell.value!=="number")return 1+cells.filter(c=>typeof c.value==="number").length;
    const value=cell.value;
    return 1+cells.filter(c=>typeof c.value==="number"&&(Number.isNaN(c.value)?!Number.isNaN(value):c.value>value)).length;
  },
  ACCSUM: (args, env) => {
    const { cell, cells } = siblings(args, env);
    const index = cells.findIndex(c => c.id === cell.id);
    if (index < 0) throw new Error("ACCSUM cell is outside its parent range");
    return sum(cells.slice(0, index + 1).map(c => c.value).filter((v): v is number => typeof v === "number"));
  },
  ABS: args => Math.abs(Number(scalar(args[0]))),
  ROUND: args => { const factor = 10 ** Number(scalar(args[1]) ?? 0); return Math.round(Number(scalar(args[0])) * factor) / factor; },
  INT: args => Math.floor(Number(scalar(args[0]))),
  MOD: args => Number(scalar(args[0])) % Number(scalar(args[1])),
  POWER: args => Number(scalar(args[0])) ** Number(scalar(args[1])),
  SQRT: args => Math.sqrt(Number(scalar(args[0]))),
  LEN: args => String(scalar(args[0]) ?? "").length,
  NOT: args => !formulaTruthy(args[0]),
  LEFT: args => String(scalar(args[0]) ?? "").slice(0, Number(scalar(args[1]) ?? 1)),
  RIGHT: args => String(scalar(args[0]) ?? "").slice(-Number(scalar(args[1]) ?? 1)),
  UPPER: args => String(scalar(args[0]) ?? "").toUpperCase(),
  LOWER: args => String(scalar(args[0]) ?? "").toLowerCase(),
  TRIM: args => String(scalar(args[0]) ?? "").trim().replace(/ +/g, " "),
};
