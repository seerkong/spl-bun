import { sourceDayInterval } from "./calendar";
import Decimal from 'decimal.js';
// A private constructor prevents callers from changing arithmetic configuration.
// Inputs/results are bounded; operations never silently round an oversized value.
const ExactDecimal = Decimal.clone({ precision: 4096, rounding: Decimal.ROUND_HALF_UP });
Object.freeze(ExactDecimal);
export type SplNumber = number | bigint | Decimal;
export const isSplNumber = (value: unknown): value is SplNumber => typeof value === 'number' || typeof value === 'bigint' || Decimal.isDecimal(value);
export const isDecimal = (value: unknown): value is Decimal => Decimal.isDecimal(value);
function checked(value: Decimal): Decimal {
    if (!value.isFinite() || value.sd() > 2048 || Math.abs(value.e) > 2048)
        throw new RangeError('decimal exceeds the supported 2048 digit/exponent limit');
    return value;
}
export function decimal(value: unknown): Decimal | null {
    if (value == null)
        return null;
    if (!isSplNumber(value) && typeof value !== 'string')
        throw new Error('decimal expects numeric text or a number');
    if (typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value))
        throw new RangeError('decimal requires exact text for unsafe integers');
    if (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value))
        return null;
    if (String(value).length > 4096)
        throw new RangeError('decimal input is too large');
    try {
        return checked(d(value as SplNumber));
    }
    catch (error) {
        if (error instanceof RangeError)
            throw error;
        return null;
    }
}
export function long(value: unknown): bigint | null {
    if (value == null)
        return null;
    if (value instanceof Date)
        return BigInt(value.getTime());
    if (!isSplNumber(value) && typeof value !== 'string')
        throw new Error('long expects numeric text, a number or Date');
    try {
        if (typeof value === 'number' && !Number.isSafeInteger(Math.trunc(value)))
            throw new RangeError('long requires exact text for numbers outside the safe integer range');
        const n = isDecimal(value) ? BigInt(value.trunc().toFixed()) : typeof value === 'number' ? BigInt(Math.trunc(value)) : BigInt(value);
        return n < -(1n << 63n) || n > (1n << 63n) - 1n ? null : n;
    }
    catch (error) {
        if (error instanceof RangeError)
            throw error;
        return null;
    }
}
export function numericLiteral(text: string): number | bigint {
    const n = Number(text);
    if (/^\d+$/.test(text) && !Number.isSafeInteger(n)) {
        const exact = long(text);
        if (exact == null)
            throw new RangeError('Integer literal exceeds long range; use decimal("...")');
        return exact;
    }
    if (!Number.isFinite(n))
        throw new RangeError('Numeric literal is not finite; use decimal("...")');
    return n;
}
function d(value: SplNumber | string): Decimal {
    if (typeof value !== 'number' || !Number.isFinite(value) || Number.isInteger(value))
        return new ExactDecimal(String(value));
    // BigDecimal(double) retains the binary value, unlike BigDecimal(text).
    const bits = new DataView(new ArrayBuffer(8));
    bits.setFloat64(0, value);
    const raw = bits.getBigUint64(0), exponent = Number((raw >> 52n) & 2047n);
    const significand = (raw & ((1n << 52n) - 1n)) + (exponent ? 1n << 52n : 0n);
    const shift = (exponent || 1) - 1023 - 52;
    const exact = new ExactDecimal(significand.toString()).times(new ExactDecimal(2).pow(shift));
    return raw >> 63n ? exact.negated() : exact;
}
export function parsedNumber(value: string): SplNumber | null {
    value = value.trim();
    if (value === "NaN" || value === "Infinity" || value === "+Infinity" || value === "-Infinity") return Number(value);
    if (/^0x[0-9a-f]+$/i.test(value)) {
        const integer = BigInt(value);
        if (integer > (1n << 63n) - 1n) return null;
        return integer <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(integer) : integer;
    }
    if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%$/i.test(value)) return Number(value.slice(0,-1))/100;
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value))
        return null;
    const n = Number(value);
    return /^[+-]?\d+$/.test(value) && !Number.isSafeInteger(n) ? long(value) ?? decimal(value) : n;
}
export function numericBinary(op: 'add' | 'subtract' | 'multiply' | 'divide' | 'mod' | 'intDivide', a: SplNumber, b: SplNumber): SplNumber {
    if (isDecimal(a) || isDecimal(b)) {
        const left = d(a), right = d(b);
        if ((op === 'divide' || op === 'intDivide' || op === 'mod') && right.isZero())
            throw new Error('Division by zero');
        switch (op) {
            case 'add': return checked(left.plus(right));
            case 'subtract': return checked(left.minus(right));
            case 'multiply': return checked(left.times(right));
            case 'divide': return checked(left.div(right).toDecimalPlaces(16, Decimal.ROUND_HALF_UP));
            case 'intDivide': return checked(left.divToInt(right));
            case 'mod': {
                const divisor = right.trunc();
                if (!divisor.isPositive())
                    throw new Error('Decimal mod requires a positive integer divisor');
                return checked(left.trunc().mod(divisor).plus(divisor).mod(divisor));
            }
        }
    }
    if ((typeof a === 'bigint' || typeof b === 'bigint') && Number.isInteger(Number(a)) && Number.isInteger(Number(b)) && op !== 'divide') {
        if (typeof a === 'number' && !Number.isSafeInteger(a) || typeof b === 'number' && !Number.isSafeInteger(b))
            throw new RangeError('Mixed long arithmetic requires a safe integer or exact text');
        const left = BigInt(a), right = BigInt(b);
        switch (op) {
            case 'add': return BigInt.asIntN(64, left + right);
            case 'subtract': return BigInt.asIntN(64, left - right);
            case 'multiply': return BigInt.asIntN(64, left * right);
            case 'mod': return left % right;
            case 'intDivide': return BigInt.asIntN(64, left / right);
        }
    }
    const left = Number(a), right = Number(b);
    if (Number.isSafeInteger(left) && Number.isSafeInteger(right)) {
        if (op === 'intDivide') return Number(BigInt(left) / BigInt(right));
        if (op === 'add' || op === 'subtract' || op === 'multiply') {
            const result = op === 'add' ? left + right : op === 'subtract' ? left - right : left * right;
            if (!Number.isSafeInteger(result)) {
                const x=BigInt(left),y=BigInt(right);
                return BigInt.asIntN(64,op === 'add' ? x+y : op === 'subtract' ? x-y : x*y);
            }
            return result;
        }
    }
    switch (op) {
        case 'add': return left + right;
        case 'subtract': return left - right;
        case 'multiply': return left * right;
        case 'divide': return left / right;
        case 'mod': return left % right;
        case 'intDivide': return Math.trunc(left / right);
    }
}
export function numericCompare(a: SplNumber, b: SplNumber): number {
    if (typeof a === 'number' && typeof b === 'number' && !Number.isNaN(a) && !Number.isNaN(b))
        return a === b ? 0 : a > b ? 1 : -1;
    if (typeof a === 'number' && Number.isNaN(a))
        return typeof b === 'number' && Number.isNaN(b) ? 0 : 1;
    if (typeof b === 'number' && Number.isNaN(b))
        return -1;
    return d(a).cmp(d(b));
}
export function numericKey(value: SplNumber): string {
    return typeof value === 'number' && Number.isInteger(value) && Math.abs(value) < 1e21 ? String(value) : d(value).toString();
}
export function scalarEquals(a: unknown, b: unknown): boolean {
    if (a == null || b == null)
        return a == null && b == null;
    if (isSplNumber(a) && isSplNumber(b))
        return numericCompare(a, b) === 0;
    if (a instanceof Date && b instanceof Date)
        return a.getTime() === b.getTime();
    if (Array.isArray(a) && Array.isArray(b))
        return a.length === b.length && a.every((v, i) => scalarEquals(v, b[i]));
    return a === b;
}
export function scalarCompare(a: unknown, b: unknown): number {
    if (a == null || b == null)
        return a == null ? b == null ? 0 : -1 : 1;
    if (isSplNumber(a) && isSplNumber(b))
        return numericCompare(a, b);
    if (a instanceof Date && b instanceof Date)
        return Math.sign(a.getTime() - b.getTime());
    if (typeof a === typeof b && (typeof a === 'string' || typeof a === 'boolean'))
        return a === b ? 0 : a > b! ? 1 : -1;
    if (Array.isArray(a) && Array.isArray(b)) {
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
            const c = scalarCompare(a[i], b[i]);
            if (c)
                return c;
        }
        return Math.sign(a.length - b.length);
    }
    throw new Error('Cannot compare incompatible scalar types');
}
function shiftDay(date: Date, amount: SplNumber): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + Math.trunc(Number(amount)));
    return result;
}
export function scalarArithmetic(op: 'add' | 'subtract' | 'multiply' | 'divide' | 'mod', a: unknown, b: unknown): unknown {
    if (op === 'add') {
        if (a == null)
            return b ?? null;
        if (b == null)
            return a;
        if (typeof a === 'string' && typeof b === 'string')
            return a + b;
        if (typeof a === 'string' && isSplNumber(b))
            return numericBinary('add', parsedNumber(a) ?? 0, b);
        if (isSplNumber(a) && typeof b === 'string')
            return numericBinary('add', a, parsedNumber(b) ?? 0);
        if (a instanceof Date && isSplNumber(b))
            return shiftDay(a, b);
        if (isSplNumber(a) && b instanceof Date)
            return shiftDay(b, a);
    }
    if (op === 'subtract') {
        if (b == null)
            return a ?? null;
        if (a == null) {
            if (!isSplNumber(b))
                throw new Error('Negation requires a number');
            return numericBinary('subtract', 0, b);
        }
        if (a instanceof Date && isSplNumber(b))
            return shiftDay(a, numericBinary('subtract', 0, b));
        if (a instanceof Date && b instanceof Date) {
            return sourceDayInterval(b,a);
        }
    }
    if (op === 'divide' && (typeof a === 'string' || typeof b === 'string'))
        return String(a ?? '') + String(b ?? '');
    if (a == null || b == null)
        return null;
    if (op === 'multiply' && (Array.isArray(a) || Array.isArray(b))) {
        const sequence = Array.isArray(a) ? a : b as unknown[];
        const times = Array.isArray(a) ? b : a;
        if (!isSplNumber(times))
            throw new Error('Sequence multiplication requires a number');
        const count = Math.trunc(Number(times));
        if (count < 0 || sequence.length * count > 1000000)
            throw new RangeError('Sequence repetition exceeds supported size');
        return Array.from({ length: count }, () => sequence).flat();
    }
    if (!isSplNumber(a) || !isSplNumber(b))
        throw new Error(`Invalid ${op} operand types`);
    return numericBinary(op, a, b);
}
