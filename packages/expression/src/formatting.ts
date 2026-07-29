import Decimal from 'decimal.js';
import { asDate } from './calendar';
import { decimal, isDecimal, isSplNumber, parsedNumber, type SplNumber } from './scalar';
import { truthy } from './utils';
function pad(value: number, size: number): string { return String(value).padStart(size, '0'); }
function zone(date: Date, colon = false): string { const offset = -date.getTimezoneOffset(); return (offset < 0 ? '-' : '+') + pad(Math.floor(Math.abs(offset) / 60), 2) + (colon ? ':' : '') + pad(Math.abs(offset) % 60, 2); }
function localized(date: Date, options: Intl.DateTimeFormatOptions, locale = 'en-US'): string { return new Intl.DateTimeFormat(locale, options).format(date); }
function datePart(date: Date, code: string): string {
    const h = date.getHours(), year = date.getFullYear(), month = date.getMonth() + 1, day = date.getDate();
    switch (code) {
        case 'Y': return pad(year, 4);
        case 'y': return pad(year % 100, 2);
        case 'C': return pad(Math.floor(year / 100), 2);
        case 'm': return pad(month, 2);
        case 'd': return pad(day, 2);
        case 'e': return String(day);
        case 'H': return pad(h, 2);
        case 'k': return String(h);
        case 'I': return pad(h % 12 || 12, 2);
        case 'l': return String(h % 12 || 12);
        case 'M': return pad(date.getMinutes(), 2);
        case 'S': return pad(date.getSeconds(), 2);
        case 'L': return pad(date.getMilliseconds(), 3);
        case 'N': return pad(date.getMilliseconds() * 1e6, 9);
        case 'p': return h < 12 ? 'am' : 'pm';
        case 'z': return zone(date);
        case 'Z': return new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(date).find(part => part.type === 'timeZoneName')!.value;
        case 's': return String(Math.trunc(date.getTime() / 1000));
        case 'Q': return String(date.getTime());
        case 'A': return localized(date, { weekday: 'long' });
        case 'a': return localized(date, { weekday: 'short' });
        case 'B': return localized(date, { month: 'long' });
        case 'b':
        case 'h': return localized(date, { month: 'short' });
        case 'j': return pad(Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86400000) + 1, 3);
        case 'R': return `${pad(h, 2)}:${pad(date.getMinutes(), 2)}`;
        case 'T': return `${datePart(date, 'R')}:${datePart(date, 'S')}`;
        case 'r': return `${datePart(date, 'I')}:${datePart(date, 'M')}:${datePart(date, 'S')} ${h < 12 ? 'AM' : 'PM'}`;
        case 'F': return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
        case 'D': return `${pad(month, 2)}/${pad(day, 2)}/${pad(year % 100, 2)}`;
        case 'c': return `${datePart(date, 'a')} ${datePart(date, 'b')} ${pad(day, 2)} ${datePart(date, 'T')} ${datePart(date, 'Z')} ${pad(year, 4)}`;
        default: throw new Error('Unsupported date format conversion %t' + code);
    }
}
export function datePattern(date: Date, pattern: string, locale = 'en-US'): string {
    let output = '';
    for (let i = 0; i < pattern.length;) {
        if (pattern[i] === "'") {
            if (pattern[i + 1] === "'") {
                output += "'";
                i += 2;
                continue;
            }
            i++;
            let closed = false;
            while (i < pattern.length) {
                if (pattern[i] === "'") {
                    if (pattern[i + 1] === "'") {
                        output += "'";
                        i += 2;
                    }
                    else {
                        i++;
                        closed = true;
                        break;
                    }
                }
                else
                    output += pattern[i++];
            }
            if (!closed)
                throw new Error('Unterminated date pattern literal');
            continue;
        }
        const token = /^([a-zA-Z])\1*/.exec(pattern.slice(i));
        if (!token) {
            output += pattern[i++];
            continue;
        }
        const c = token[1], n = token[0].length;
        i += n;
        const h = date.getHours();
        switch (c) {
            case 'y':
                output += n === 2 ? pad(date.getFullYear() % 100, 2) : pad(date.getFullYear(), n);
                break;
            case 'M':
            case 'L':
                output += n >= 3 ? localized(date, { month: n >= 4 ? 'long' : 'short' }, locale) : pad(date.getMonth() + 1, n);
                break;
            case 'd':
                output += pad(date.getDate(), n);
                break;
            case 'D':
                output += pad(Number(datePart(date, 'j')), n);
                break;
            case 'H':
                output += pad(h, n);
                break;
            case 'h':
                output += pad(h % 12 || 12, n);
                break;
            case 'm':
                output += pad(date.getMinutes(), n);
                break;
            case 's':
                output += pad(date.getSeconds(), n);
                break;
            case 'S':
                output += pad(date.getMilliseconds(), n);
                break;
            case 'a':
                output += h < 12 ? 'AM' : 'PM';
                break;
            case 'E':
                output += localized(date, { weekday: n >= 4 ? 'long' : 'short' }, locale);
                break;
            case 'Z':
                output += zone(date);
                break;
            case 'X':
                if (n > 3)
                    throw new Error('Unsupported date pattern X width');
                output += date.getTimezoneOffset() === 0 ? 'Z' : n === 1 ? zone(date).slice(0, 3) : zone(date, n === 3);
                break;
            case 'z':
                output += new Intl.DateTimeFormat(locale, { timeZoneName: n >= 4 ? 'long' : 'short' }).formatToParts(date).find(part => part.type === 'timeZoneName')!.value;
                break;
            default: throw new Error('Unsupported date pattern token ' + token[0]);
        }
    }
    return output;
}
function groupDigits(text: string, pattern = '#,##0'): string {
    const parts = pattern.split(',');
    if (parts.length < 2)
        return text;
    const primary = parts[parts.length - 1].length, secondary = parts.length > 2 ? parts[parts.length - 2].length : primary;
    let size = primary, result = '';
    while (text.length > size) {
        result = ',' + text.slice(-size) + result;
        text = text.slice(0, -size);
        size = secondary;
    }
    return text + result;
}
interface NumberPattern {
    prefix: string;
    suffix: string;
    integer: string;
    fraction: string;
    percent: boolean;
}
function numericPattern(pattern: string): NumberPattern {
    const match = /^([^0#.,%]*)([#,0]+)(?:\.(0*#*))?(%?)([^0#.,%]*)$/.exec(pattern);
    if (!match || match[2].endsWith(',') || match[2].includes(',,'))
        throw new Error('Unsupported numeric pattern ' + pattern);
    return { prefix: match[1].split("'").join(""), integer: match[2], fraction: match[3] ?? '', percent: !!match[4], suffix: match[5].split("'").join("") };
}
function numericString(value: SplNumber, pattern: string): string {
    const forms = pattern.split(';');
    if (forms.length > 2)
        throw new Error('Invalid numeric subpatterns');
    const negative = negativeNumber(value), selected = forms[negative && forms[1] ? 1 : 0], spec = numericPattern(selected);
    const amount = decimal(String(value))!.abs().times(spec.percent ? 100 : 1);
    const digits = amount.toFixed(spec.fraction.length, Decimal.ROUND_HALF_UP).split('.');
    digits[0] = groupDigits(digits[0].padStart((spec.integer.match(/0/g) ?? []).length, '0'), spec.integer);
    const minimum = (spec.fraction.match(/0/g) ?? []).length;
    if (digits[1])
        while (digits[1].length > minimum && digits[1].endsWith('0'))
            digits[1] = digits[1].slice(0, -1);
    if (!spec.integer.includes("0") && digits[0] === "0" && digits[1])
        digits[0] = "";
    const result = spec.prefix + digits[0] + (digits[1] ? '.' + digits[1] : selected.includes('.') && spec.fraction.length === 0 ? '.' : '') + (spec.percent ? '%' : '') + spec.suffix;
    return negative && !forms[1] ? '-' + result : result;
}
function negativeNumber(value: SplNumber): boolean {
    // BigDecimal has no signed zero; a nonzero Decimal may underflow to -0
    // when coerced to Number, so inspect its own sign before formatting abs().
    if (isDecimal(value))
        return value.isNegative() && !value.isZero();
    return value < 0 || Object.is(value, -0);
}
export function splString(value: unknown, pattern?: unknown, locale?: unknown, options?: unknown): string | null {
    if (options !== undefined && typeof options !== "string")
        throw new Error("string options must be text");
    if (options && !/^[ueq]+$/.test(options))
        throw new Error("Unsupported string options");
    if (pattern != null && typeof pattern !== 'string')
        throw new Error('string pattern must be text');
    if (locale !== undefined && typeof locale !== 'string')
        throw new Error('string locale must be text');
    if (value == null)
        return null;
    if (typeof value === 'string') {
        let text = value;
        if (options?.includes('u') || options?.includes('e'))
            text = escapeText(text, options.includes('u'));
        if (options?.includes('q'))
            text = '"' + text + '"';
        return text;
    }
    if (value instanceof Date)
        return pattern ? datePattern(value, String(pattern), typeof locale === 'string' ? locale.split("_").join("-") : undefined) : value.toISOString();
    if (Array.isArray(value))
        return value.map(item => splString(item, pattern, locale) ?? 'null').join(',');
    if (isSplNumber(value) && pattern)
        return numericString(value, String(pattern));
    if (pattern != null)
        throw new Error('Unsupported string format input');
    return String(value);
}
export function splNumber(value: unknown, fallbackOrPattern?: unknown): SplNumber | null {
    if (isSplNumber(value))
        return value;
    if (typeof value === 'string') {
        if (typeof fallbackOrPattern === 'string') {
            for (const [index, form] of fallbackOrPattern.split(';').entries()) {
                const pattern = numericPattern(form), suffix = (pattern.percent ? '%' : '') + pattern.suffix;
                let text = value;
                if (!text.startsWith(pattern.prefix) || !text.endsWith(suffix))
                    continue;
                text = text.slice(pattern.prefix.length, suffix ? text.length - suffix.length : undefined).split(",").join("");
                const number = parsedNumber(text);
                if (number !== null) {
                    const d = decimal(String(number))!;
                    return parsedNumber(d.times(index === 1 ? -1 : 1).div(pattern.percent ? 100 : 1).toFixed());
                }
            }
        }
        const parsed = parsedNumber(value.trim());
        if (parsed !== null)
            return parsed;
    }
    return isSplNumber(fallbackOrPattern) ? fallbackOrPattern : null;
}
/** Finite Java Formatter protocol. Unsupported conversions/flags fail instead
 * of treating a formatting request as a date parse or silently ignoring it.
 */
export function splFormat(pattern: unknown, ...args: unknown[]): string | null {
    if (pattern == null)
        return null;
    if (pattern instanceof Date) {
        if (args[0] === undefined || args[0] === 'iso')
            return pattern.toISOString();
        if (args[0] === 'date')
            return pattern.toISOString().slice(0, 10);
        return datePattern(pattern, String(args[0]));
    }
    if (typeof pattern !== 'string')
        throw new Error('format requires a pattern string');
    // Preserve the old date-first string aliases without hijacking printf formats.
    if ((args[0] === 'date' || args[0] === 'iso') && asDate(pattern))
        return splFormat(asDate(pattern), args[0]);
    if (!args.length)
        throw new Error('format requires at least one value');
    let output = '', next = 0, last = -1;
    for (let i = 0; i < pattern.length;) {
        if (pattern[i] !== '%') {
            output += pattern[i++];
            continue;
        }
        const token = /^%(?:(\d+)\$)?([-#+ 0,(<]*)(\d+)?(?:\.(\d+))?([tT])?([A-Za-z%])/.exec(pattern.slice(i));
        if (!token)
            throw new Error('Invalid format token at ' + i);
        i += token[0].length;
        const [, index, flags, widthText, precisionText, datePrefix, conversion] = token, width = Number(widthText ?? 0), precision = precisionText === undefined ? undefined : Number(precisionText), lower = conversion.toLowerCase();
        if (datePrefix && !'YyCmdeHkIlMSLNpzZsQAaBbhjRTrFDc'.includes(conversion))
            throw new Error('Unsupported date format conversion %t' + conversion);
        if (!datePrefix && !'sSbBcCdoxXfeEgG%n'.includes(conversion))
            throw new Error('Unsupported format conversion %' + conversion);
        if (width > 10000 || precision !== undefined && precision > 1000)
            throw new RangeError('Format width/precision exceeds limit');
        if ((flags.includes('-') || flags.includes('0')) && widthText === undefined)
            throw new Error('Format flag requires a width');
        if (flags.includes('<') && index)
            throw new Error('Format reuse conflicts with argument index');
        if (new Set(flags).size !== flags.length || flags.includes('+') && flags.includes(' ') || flags.includes('-') && flags.includes('0'))
            throw new Error('Conflicting format flags');
        let text: string, negative = false, numeric = false;
        if (conversion === '%' || conversion === 'n') {
            if (datePrefix || index || precision !== undefined || flags.split("-").join(""))
                throw new Error('Invalid percent/newline format flags');
            if (conversion === 'n' && widthText !== undefined)
                throw new Error('Newline format has no width');
            text = conversion === '%' ? '%' : '\n';
        }
        else {
            const position = index ? Number(index) - 1 : flags.includes('<') ? last : next++;
            if (position < 0 || position >= args.length)
                throw new Error('Missing format argument');
            last = position;
            const value = args[position];
            if (datePrefix) {
                if (value != null && !(value instanceof Date) && typeof value !== "number" && typeof value !== "bigint")
                    throw new Error('Date format requires a Date or epoch');
                if (precision !== undefined || flags.split("-").join("").split("<").join(""))
                    throw new Error('Invalid date format flags');
                const date = asDate(typeof value === 'bigint' ? Number(value) : value);
                if (!date && value != null)
                    throw new Error('Date format requires a Date or epoch');
                text = date ? datePart(date, conversion) : 'null';
                if (datePrefix === 'T')
                    text = text.toUpperCase();
            }
            else if (lower === 's' || lower === 'b' || lower === 'c') {
                if (flags.split("-").join("").split("<").join(""))
                    throw new Error('Invalid text format flags');
                if (lower === 's')
                    text = value == null ? 'null' : String(value);
                else if (lower === 'b')
                    text = String(truthy(value));
                else if (value == null)
                    text = 'null';
                else if (typeof value === 'string' && [...value].length === 1)
                    text = value;
                else if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0x10ffff)
                    text = String.fromCodePoint(value);
                else
                    throw new Error('Character format requires one character or a code point');
                if (precision !== undefined) {
                    if (lower === 'c')
                        throw new Error('Character format has no precision');
                    text = text.slice(0, precision);
                }
                if (conversion === conversion.toUpperCase())
                    text = text.toUpperCase();
            }
            else if (['d', 'o', 'x', 'f', 'e', 'g'].includes(lower)) {
                const allowed = lower === 'd' ? '-+ 0,(<' : lower === 'x' || lower === 'o' ? '-#0<' : lower === 'e' ? '-#+ 0(<' : lower === 'g' ? '-+ 0,(<' : '-#+ 0,(<';
                if ([...flags].some(flag => !allowed.includes(flag)))
                    throw new Error('Invalid numeric format flags');
                if (['d', 'o', 'x'].includes(lower) && precision !== undefined)
                    throw new Error('Integer format has no precision');
                numeric = true;
                if (value == null) {
                    text = precision === undefined ? 'null' : 'null'.slice(0, precision);
                    numeric = false;
                }
                else {
                    if (!isSplNumber(value))
                        throw new Error('Numeric format requires a number');
                    negative = negativeNumber(value);
                    if (['d', 'o', 'x'].includes(lower) && (isDecimal(value) || !Number.isFinite(Number(value))))
                        throw new Error('Integer format requires an integer');
                    const amount = decimal(String(value));
                    if (!amount) {
                        if (typeof value !== "number" || Number.isFinite(value))
                            throw new Error('Numeric format requires a number');
                        text = Number.isNaN(value) ? 'NaN' : 'Infinity';
                        numeric = !Number.isNaN(value);
                    }
                    else {
                        if (['d', 'o', 'x'].includes(lower)) {
                            if (isDecimal(value) || !Number.isInteger(Number(value)) || precision !== undefined)
                                throw new Error('Integer format requires an integer and no precision');
                            let integer = BigInt(value);
                            if (lower !== 'd' && integer < 0) {
                                integer = BigInt.asUintN(typeof value === 'number' && value >= -2147483648 ? 32 : 64, integer);
                                negative = false;
                            }
                            text = (integer < 0 ? -integer : integer).toString(lower === 'x' ? 16 : lower === 'o' ? 8 : 10);
                            if (flags.includes(',') && lower === 'd')
                                text = groupDigits(text);
                            if (flags.includes('#')) {
                                if (lower === 'd')
                                    throw new Error('Decimal integer has no alternate form');
                                text = (lower === 'x' ? '0x' : '0') + text;
                            }
                        }
                        else {
                            const digits = precision ?? 6, absolute = amount.abs();
                            text = lower === 'f' ? absolute.toFixed(digits, Decimal.ROUND_HALF_UP) : lower === 'e' ? absolute.toExponential(digits, Decimal.ROUND_HALF_UP) : generalNumber(absolute, digits || 1, isDecimal(value));
                            text = text.replace(/e([+-])(\d)$/, 'e$10$2');
                            if (flags.includes('#') && !text.includes('.'))
                                text = text.replace(/(e|$)/, '.$1');
                            if (flags.includes(',')) {
                                const [integer, ...fraction] = text.split('.');
                                text = groupDigits(integer) + (fraction.length ? '.' + fraction.join('.') : '');
                            }
                        }
                    }
                }
                if (conversion === conversion.toUpperCase())
                    text = text.toUpperCase();
            }
            else
                throw new Error('Unsupported format conversion %' + conversion);
        }
        let prefix = '', suffix = '';
        if (numeric) {
            if (negative) {
                prefix = flags.includes('(') ? '(' : '-';
                if (flags.includes('('))
                    suffix = ')';
            }
            else
                prefix = flags.includes('+') ? '+' : flags.includes(' ') ? ' ' : '';
        }
        const fill = Math.max(0, width - prefix.length - text.length - suffix.length);
        if (flags.includes('0') && numeric && text !== 'Infinity' && text !== 'INFINITY') {
            const radix = /^0[xX]/.exec(text);
            if (radix) {
                prefix += radix[0];
                text = text.slice(2);
            }
            output += prefix + '0'.repeat(fill) + text + suffix;
        }
        else {
            const body = prefix + text + suffix;
            output += flags.includes('-') ? body + ' '.repeat(fill) : ' '.repeat(fill) + body;
        }
    }
    return output;
}
function escapeText(text: string, unicode: boolean): string {
    let output = '';
    const escapes: Record<string, string> = { '\t': '\\t', '\r': '\\r', '\n': '\\n', "'": "\\'", '"': '\\"', '\\': '\\\\' };
    for (let index = 0; index < text.length; index++) {
        const char = text[index], code = text.charCodeAt(index);
        if (escapes[char])
            output += escapes[char];
        else if (unicode && char === '\f')
            output += '\\f';
        else if (unicode && (code < 32 || code > 126))
            output += '\\u' + code.toString(16).toUpperCase().padStart(4, '0');
        else
            output += char;
    }
    return output;
}
function generalNumber(value: Decimal, precision: number, decimalInput: boolean): string {
    const rounded = value.toSignificantDigits(precision, Decimal.ROUND_HALF_UP), exponent = value.isZero() ? 0 : decimalInput ? value.e : rounded.e;
    return exponent < -4 || exponent >= precision ? rounded.toExponential(precision - 1, Decimal.ROUND_HALF_UP) : rounded.toFixed(Math.max(0, precision - exponent - 1), Decimal.ROUND_HALF_UP);
}
