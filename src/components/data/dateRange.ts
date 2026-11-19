import dayjs from 'dayjs';

export const RANGE_PRESETS = [
    { id: '7d', label: 'Last 7 days', days: 7 },
    { id: '30d', label: 'Last 30 days', days: 30 },
    { id: '90d', label: 'Last 90 days', days: 90 },
    { id: '12m', label: 'Last 12 months', days: 365 },
    { id: 'all', label: 'All time', days: null },
] as const;

export type RangePresetId = (typeof RANGE_PRESETS)[number]['id'];

/** How a range is kept in the URL: a preset id, or "custom" with ISO dates (YYYY-MM-DD). */
export interface DateRangeValue {
    range: RangePresetId | 'custom';
    from?: string;
    to?: string;
}

export interface ResolvedRange {
    /** Inclusive start; null means unbounded. */
    start: Date | null;
    /** Exclusive end; null means now. */
    end: Date | null;
    label: string;
    /** The same-length period just before, for deltas. Null when the range is unbounded. */
    previous: { start: Date; end: Date } | null;
}

export function resolveRange(value: DateRangeValue, now = new Date()): ResolvedRange {
    if (value.range === 'custom') {
        const start = value.from ? dayjs(value.from).startOf('day') : null;
        const end = value.to ? dayjs(value.to).add(1, 'day').startOf('day') : null;
        const label =
            start && end
                ? `${start.format('D MMM YYYY')} to ${end.subtract(1, 'day').format('D MMM YYYY')}`
                : start
                  ? `From ${start.format('D MMM YYYY')}`
                  : end
                    ? `Until ${end.subtract(1, 'day').format('D MMM YYYY')}`
                    : 'All time';
        const span = start && end ? end.diff(start) : null;
        return {
            start: start?.toDate() ?? null,
            end: end?.toDate() ?? null,
            label,
            previous:
                start && span
                    ? { start: start.subtract(span, 'ms').toDate(), end: start.toDate() }
                    : null,
        };
    }
    const preset = RANGE_PRESETS.find((p) => p.id === value.range) ?? RANGE_PRESETS[4];
    if (preset.days === null)
        return { start: null, end: null, label: preset.label, previous: null };
    const end = dayjs(now);
    const start = end.subtract(preset.days, 'day');
    return {
        start: start.toDate(),
        end: null,
        label: preset.label,
        previous: { start: start.subtract(preset.days, 'day').toDate(), end: start.toDate() },
    };
}

export function inRange(date: string | Date, r: { start: Date | null; end: Date | null }) {
    const t = new Date(date).getTime();
    return (!r.start || t >= r.start.getTime()) && (!r.end || t < r.end.getTime());
}
