import { asDate } from './calendar';
import { parseJsonPreservingNumbers } from './json';
import { parsedNumber } from './scalar';

const javaWhitespace = /^[\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]$/;
const javaTrim = (text: string): string => text.replace(/^[\x00-\x20]+|[\x00-\x20]+$/g, '');

function quotationEnd(text: string, start: number): number {
    const quote = text[start];
    if (quote !== '"' && quote !== "'") return -1;
    for (let i = start + 1; i < text.length; i++) {
        if (text[i] === '\\') i++;
        else if (text[i] === quote) return i;
    }
    return -1;
}

/** StringUtils.unicode differs from JSON: unknown escapes lose the slash,
 * including \\b; incomplete escapes fail rather than returning partial text. */
function unicode(text: string): string {
    let result = '';
    for (let index = 0; index < text.length; index++) {
        if (text[index] !== '\\') { result += text[index]; continue; }
        const code = text[++index];
        if (code === undefined) throw new Error('parse: incomplete escape');
        if (code === 'u') {
            const hex = text.slice(index + 1, index + 5);
            if (!/^[\da-fA-F]{4}$/.test(hex)) throw new Error('parse: invalid Unicode escape');
            result += String.fromCharCode(Number.parseInt(hex, 16));
            index += 4;
        } else {
            result += ({t:'\t',r:'\r',n:'\n',f:'\f'} as Record<string,string>)[code] ?? code;
        }
    }
    return result;
}

function removeEscapes(text: string): string {
    return text.replace(/\\([\s\S])|\\$/g, (_escape, code: string | undefined) =>
        code === undefined ? '' : ({t:'\t',r:'\r',n:'\n'} as Record<string,string>)[code] ?? code);
}

function numberText(text: string): unknown {
    // Variant passes signed NaN/Infinity, optionally before %, to FloatingDecimal.
    // These are explicit tokens; exponent overflow still fails below.
    const nonfinite = /^([+-]?(?:NaN|Infinity))(?:[\x00-\x20]*%)?$/.exec(text);
    if (nonfinite) return Number(nonfinite[1]);
    // Java accepts an uppercase long suffix and floating f/d suffixes.
    if (/^-?\d+L$/.test(text)) return parsedNumber(text.slice(0, -1));
    if (/^-?0+$/.test(text)) return 0;
    if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?[fd]%$/i.test(text)) text = text.slice(0,-2)+'%';
    if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?[fd]$/i.test(text)) text = text.slice(0, -1);
    const value = parsedNumber(text);
    if (typeof value === 'number' && !Number.isFinite(value) && !/^[+-]?(?:Infinity|NaN)$/.test(text))
        throw new RangeError('parse: numeric overflow; use decimal text explicitly');
    return value;
}

/** Default source patterns, independent of Java's mutable global format registry. */
function dateText(text: string): Date | null {
    const value = javaTrim(text);
    const match = /^(?:(\d{1,4})-(\d{1,2})-(\d{1,2})(?: (\d{1,2}):(\d{1,2}):(\d{1,2}))?|(\d{1,2}):(\d{1,2}):(\d{1,2}))$/.exec(value);
    if (!match) return null;
    const parts = match[1] ? [Number(match[1]),Number(match[2]),Number(match[3]),Number(match[4]??0),Number(match[5]??0),Number(match[6]??0)] : [1970,1,1,Number(match[7]),Number(match[8]),Number(match[9])];
    const [year, month, day, hour, minute, second] = parts;
    if (year < 1 || year > 9999) return null;
    const date = asDate(0)!;
    date.setFullYear(year, month - 1, day);
    date.setHours(hour, minute, second, 0);
    return [date.getFullYear(),date.getMonth()+1,date.getDate(),date.getHours(),date.getMinutes(),date.getSeconds()].every((part,i)=>part===parts[i]) ? date : null;
}

function variant(text: string, removeQuotes: boolean, depth: number): unknown {
    if (!text.length) return null;
    const trimmed = javaTrim(text);
    if (!trimmed.length) return text;
    if (trimmed[0] === '"' || trimmed[0] === "'") {
        const end = quotationEnd(trimmed, 0);
        return removeQuotes && end === trimmed.length - 1 ? removeEscapes(trimmed.slice(1, -1)) : text;
    }
    const number = numberText(trimmed);
    if (number !== null) return number;
    if (trimmed === 'null') return null;
    if (trimmed === 'true' || trimmed === 'false') return trimmed === 'true';
    if (trimmed[0] === '[' || trimmed[0] === '{') return sourceJson(trimmed, depth + 1);
    return dateText(text) ?? text;
}

/** JSONUtil's data-only grammar, including unquoted keys and trailing array
 * nulls. Fresh own properties prevent __proto__ from changing object authority.
 * Standard JSON numeric tokens reuse the transport-safe number parser. */
function sourceJson(text: string, depth: number): unknown {
    if (depth > 128) throw new RangeError('parse: JSON nesting exceeds 128');
    let start = 0, end = text.length - 1;
    while (start <= end && javaWhitespace.test(text[end])) end--;
    while (start <= end && javaWhitespace.test(text[start])) start++;
    if (start > end) return null;
    const value = text.slice(start, end + 1), first = value[0];
    if (first !== '[' && first !== '{') {
        if (first === '"' || first === "'") {
            const match = quotationEnd(value, 0);
            return unicode(match === value.length - 1 ? value.slice(1, -1) : value);
        }
        if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)) return parseJsonPreservingNumbers(value);
        return variant(value, true, depth);
    }
    if (value[value.length - 1] !== (first === '[' ? ']' : '}')) return javaTrim(value);
    const body = value.slice(1, -1);
    function separator(from: number, wanted: string): number {
        for (let i = from; i < body.length; i++) {
            if (body[i] === wanted) return i;
            if (body[i] === '"') {
                const close = quotationEnd(body, i);
                if (close < 0) return -1;
                i = close;
            } else if (body[i] === '\\') i++;
            else if (body[i] === '[' || body[i] === '{') {
                const stack = [body[i] === '[' ? ']' : '}'];
                for (i++; i < body.length && stack.length; i++) {
                    if (body[i] === '"') { const close=quotationEnd(body,i); if(close<0)return -1; i=close; }
                    else if (body[i] === '\\') i++;
                    else if (body[i] === '[' || body[i] === '{') stack.push(body[i] === '[' ? ']' : '}');
                    else if (body[i] === stack[stack.length-1]) stack.pop();
                }
                if (stack.length) return -1;
                i--;
            }
        }
        return -1;
    }
    if (first === '[') {
        const values: unknown[] = [];
        let offset = 0;
        while (offset < body.length && javaWhitespace.test(body[offset])) offset++;
        while (offset < body.length) {
            const comma = separator(offset, ',');
            values.push(sourceJson(body.slice(offset, comma < 0 ? body.length : comma), depth + 1));
            if (comma < 0) break;
            offset = comma + 1;
            while (offset < body.length && javaWhitespace.test(body[offset])) offset++;
            if (offset === body.length) values.push(null);
        }
        return values;
    }
    const entries: [string, unknown][] = [];
    let offset = 0;
    while (offset < body.length) {
        const colon = separator(offset, ':');
        if (colon < 0) return javaTrim(value);
        let name = javaTrim(body.slice(offset, colon));
        if (name.length > 2 && name[0] === '"' && name[name.length-1] === '"') name = name.slice(1,-1);
        const comma = separator(colon + 1, ',');
        entries.push([name, sourceJson(body.slice(colon+1,comma<0?body.length:comma), depth+1)]);
        if (comma < 0) break;
        offset = comma + 1;
    }
    return entries.length ? Object.fromEntries(entries) : javaTrim(value);
}

export function splParse(value: unknown, options?: unknown): unknown {
    if (options != null && (typeof options !== 'string' || !/^[qen]*$/.test(options)))
        throw new Error('parse: unsupported options; expected q/e/n');
    if (typeof value !== 'string') return value;
    if (value.length > 1048576) throw new RangeError('parse: text exceeds 1 MiB');
    const option = options as string | undefined;
    if (option?.includes('q')) {
        let start = 0;
        while (start < value.length && javaWhitespace.test(value[start])) start++;
        const end = quotationEnd(value, start);
        if (end > 0) return option.includes('e') ? unicode(value.slice(start+1,end)) : value.slice(start,end+1);
    }
    let text = value;
    if (option?.includes('e')) {
        text = unicode(text);
        if (text.length > 1) {
            if ((text[0] === '"' || text[0] === "'") && text[0] === text[text.length-1]) return text.slice(1,-1);
            return variant(text, true, 0);
        }
    } else if (option?.includes('n')) {
        let start = 0;
        while (start < text.length && javaWhitespace.test(text[start])) start++;
        if (!/[\d.-]/.test(text[start] ?? '')) return null;
        let end = start + 1;
        while (end < text.length && /[\d.]/.test(text[end])) end++;
        return numberText(text.slice(start, end));
    }
    return variant(text, false, 0);
}
