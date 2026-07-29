import Decimal from "decimal.js";
/** esProc calendar rules; all inputs are values and every Date result is new. */
export function asDate(value: unknown): Date | null {
    if (value instanceof Date)
        return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value !== 'string' && typeof value !== 'number')
        return null;
    const result = new Date(value);
    return Number.isNaN(result.getTime()) ? null : result;
}
function monthEnd(value: Date): number { const date = new Date(value); date.setMonth(date.getMonth() + 1, 0); return date.getDate(); }
function checkedOptions(raw: unknown, allowed: readonly string[], name: string): string {
    if (raw === undefined || raw === null)
        return '';
    if (typeof raw !== 'string' || !allowed.includes(raw.toLowerCase()))
        throw new Error(`${name}: unsupported options ${String(raw)}`);
    return raw.toLowerCase();
}
export function calendarElapse(value: unknown, amount: unknown, options?: unknown): Date | null {
    const opt = checkedOptions(options, ['', 'd', 'e', 'de', 'ed', 'm', 'me', 'em', 'q', 'qe', 'eq', 'y', 'ye', 'ey', 's', 'se', 'es', 'ms', 'mse', 'ems'], 'elapse');
    const date = asDate(value);
    if (!date)
        return null;
    if (!(typeof amount === 'number' || typeof amount === 'bigint' || Decimal.isDecimal(amount)) || !Number.isFinite(Number(amount)))
        throw new Error('elapse requires a finite numeric offset');
    const n = Math.trunc(Number(amount));
    if (Math.abs(n) > 2147483647)
        throw new RangeError('elapse offset exceeds a signed 32-bit integer');
    const result = new Date(date);
    if (opt.includes('y') || opt.includes('q') || opt.includes('m') && !opt.includes('ms')) {
        const months = opt.includes('y') ? 12 : opt.includes('q') ? 3 : 1;
        const day = result.getDate(), end = day === monthEnd(result) && !opt.includes('e');
        result.setDate(1);
        result.setMonth(result.getMonth() + n * months);
        result.setDate(end ? monthEnd(result) : Math.min(day, monthEnd(result)));
    }
    else if (opt.includes('ms'))
        result.setTime(result.getTime() + n);
    else if (opt.includes('s'))
        result.setTime(result.getTime() + n * 1000);
    else
        result.setDate(result.getDate() + n);
    if (Number.isNaN(result.getTime()))
        throw new RangeError('elapse date is outside supported Date range');
    return result;
}
/** Source Variant uses fixed 24h buckets anchored at local 2000-01-01,
 * with Java integer truncation (including dates before that anchor).
 */
export function sourceDayInterval(a: Date, b: Date): number {
    const base = new Date(2000, 0, 1).getTime();
    return Math.trunc((b.getTime() - base) / 86400000) - Math.trunc((a.getTime() - base) / 86400000);
}
function monthDayParts(a: Date, b: Date): {
    months: number;
    days: number;
} {
    const d1 = a.getDate(), d2 = b.getDate();
    let months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth(), days: number;
    if (d2 >= d1) {
        if (d1 === monthEnd(a)) {
            if (d2 === monthEnd(b))
                days = 0;
            else {
                days = d2;
                months--;
            }
        }
        else
            days = d2 - d1;
    }
    else if (d2 === monthEnd(b))
        days = 0;
    else {
        const prior = new Date(b);
        prior.setMonth(prior.getMonth() - 1);
        prior.setDate(d1);
        days = monthEnd(prior) - d1;
        if (days < 0)
            days = d2;
        else
            days += d2;
        months--;
    }
    return { months, days };
}
function yearDayInterval(a: Date, b: Date): number {
    const y1 = a.getFullYear(), y2 = b.getFullYear(), m1 = a.getMonth(), m2 = b.getMonth(), d1 = a.getDate(), d2 = b.getDate(), end = d1 === monthEnd(a);
    if (y1 === y2)
        return sourceDayInterval(a, b);
    if (y2 === y1 + 1) {
        if (m2 < m1)
            return sourceDayInterval(a, b);
        if (m2 === m1) {
            if (end)
                return d2 === monthEnd(b) ? 1000 : sourceDayInterval(a, b);
            if (d2 < d1)
                return sourceDayInterval(a, b);
            if (d2 === d1)
                return 1000;
            return 1000 + d2 - d1;
        }
    }
    let years = y2 - y1;
    const anchor = new Date(b);
    if (m2 < m1 || m2 === m1 && (end || d1 > d2))
        years--;
    if (m2 === m1 && (end && d2 === monthEnd(b) || !end && d1 === d2))
        return (y2 - y1) * 1000;
    const probe = new Date(b);
    probe.setFullYear(y1 + years, m1, d1);
    const anchorDay = end ? monthEnd(probe) : d1;
    anchor.setDate(1);
    anchor.setFullYear(y1 + years, m1, anchorDay);
    return years * 1000 + sourceDayInterval(anchor, b);
}
export function calendarInterval(start: unknown, end: unknown, options?: unknown): number | null {
    const allowed = ['', 'd', 'y', 'q', 'm', 's', 'ms', 'w', '7', '1', 'ymd', 'ym', 'yd', 'md', 'r', 'dr', 'rd', 'yr', 'ry', 'qr', 'rq', 'mr', 'rm', 'sr', 'rs', 'msr', 'rms', 'wr', 'rw'];
    const opt = checkedOptions(options, allowed, 'interval'), a = asDate(start), b = asDate(end);
    if (!a || !b)
        return null;
    const ms = b.getTime() - a.getTime(), days = sourceDayInterval(a, b);
    if (opt.includes('r')) {
        if (opt.includes('ms'))
            return ms;
        if (opt.includes('y'))
            return days / 365;
        if (opt.includes('q'))
            return days / 90;
        if (opt.includes('m'))
            return days / 30;
        if (opt.includes('s'))
            return ms / 1000;
        if (opt.includes('w'))
            return days / 7;
        return ms / 86400000;
    }
    if (opt === 'ymd' || opt === 'ym' || opt === 'md') {
        const { months, days: tail } = monthDayParts(a, b);
        const years = Math.floor(months / 12), month = months - years * 12;
        if (opt === 'md')
            return months * 100 + tail;
        if (opt === 'ym')
            return years * 100 + month;
        return years * 10000 + month * 100 + tail;
    }
    if (opt === 'yd')
        return yearDayInterval(a, b);
    switch (opt) {
        case 'ms': return ms;
        case 's': return Math.trunc(ms / 1000);
        case 'y': return b.getFullYear() - a.getFullYear();
        case 'q': return (b.getFullYear() - a.getFullYear()) * 4 + Math.floor(b.getMonth() / 3) - Math.floor(a.getMonth() / 3);
        case 'm': return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
        case 'w': return Math.trunc(days / 7);
        case '1':
        case '7': {
            const first = days < 0 ? b : a;
            const day = first.getDay(), target = opt === '1' ? 1 : 0;
            const offset = (target - day + 7) % 7 || 7;
            return Math.max(0, Math.floor((Math.abs(days) - offset) / 7) + 1);
        }
        default: return days;
    }
}
