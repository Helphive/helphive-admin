import dayjs from 'dayjs';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "45 min", "5 h", "3 d", "6 wk": a compact duration for tables. */
export function formatDuration(ms: number): string {
    if (ms < HOUR) return `${Math.max(1, Math.round(ms / MINUTE))} min`;
    if (ms < DAY) return `${Math.floor(ms / HOUR)} h`;
    if (ms < 14 * DAY) return `${Math.floor(ms / DAY)} d`;
    if (ms < 120 * DAY) return `${Math.floor(ms / (7 * DAY))} wk`;
    return `${Math.floor(ms / (30 * DAY))} mo`;
}

/** "3 days ago" style phrase for prose. */
export function formatAgo(date: string | number | Date, now = Date.now()): string {
    const ms = now - new Date(date).getTime();
    if (ms < MINUTE) return 'just now';
    const units: [number, string][] = [
        [365 * DAY, 'year'],
        [30 * DAY, 'month'],
        [7 * DAY, 'week'],
        [DAY, 'day'],
        [HOUR, 'hour'],
        [MINUTE, 'minute'],
    ];
    for (const [size, name] of units) {
        if (ms >= size) {
            const n = Math.floor(ms / size);
            return `${n} ${name}${n === 1 ? '' : 's'} ago`;
        }
    }
    return 'just now';
}

/** 19 Nov 2026 */
export const formatDate = (d: string | number | Date) => dayjs(d).format('D MMM YYYY');
/** 19 Nov 2026, 14:05 */
export const formatDateTime = (d: string | number | Date) => dayjs(d).format('D MMM YYYY, HH:mm');

export const formatNumber = (n: number) => new Intl.NumberFormat('en-GB').format(n);

export const formatPercent = (ratio: number, digits = 0) => `${(ratio * 100).toFixed(digits)}%`;

/** Title-case a lower-cased place name stored by the API ("new york" -> "New York"). */
export const titleCase = (s: string | undefined) =>
    (s ?? '').replace(/\b\p{L}/gu, (c) => c.toUpperCase());

export const MS = { MINUTE, HOUR, DAY } as const;
