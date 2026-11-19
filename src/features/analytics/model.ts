import { useMemo } from 'react';
import dayjs from 'dayjs';
import { useUrlState } from '@/lib/hooks';
import type { Drill, Interval, RangeArgs, Unit } from './api';

/** The operator's time zone: days on every chart start at their local midnight. */
export const TIME_ZONE = (() => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
})();

export const RANGE_OPTIONS = [
    { value: '7d', label: 'Last 7 days', previous: 'the 7 days before' },
    { value: '30d', label: 'Last 30 days', previous: 'the 30 days before' },
    { value: '90d', label: 'Last 90 days', previous: 'the 90 days before' },
    { value: '12m', label: 'Last 12 months', previous: 'the 12 months before' },
    { value: 'ytd', label: 'This year so far', previous: 'the same length before' },
    { value: 'all', label: 'All time', previous: 'the same length before' },
    { value: 'custom', label: 'Custom dates', previous: 'the same length before' },
] as const;

export const INTERVAL_OPTIONS = [
    { value: 'auto', label: 'best fit' },
    { value: 'day', label: 'day' },
    { value: 'week', label: 'week' },
    { value: 'month', label: 'month' },
] as const;

/** Range, interval and comparison shared by every analytics page, kept in the URL. */
export const ANALYSIS_DEFAULTS = {
    range: '30d',
    from: '',
    to: '',
    interval: 'auto',
    compare: 'previous',
};

export function useAnalysis() {
    const [state, set] = useUrlState(ANALYSIS_DEFAULTS);
    const args = useMemo<RangeArgs>(
        () =>
            state.range === 'custom' && state.from && state.to
                ? { from: state.from, to: state.to, tz: TIME_ZONE }
                : { range: state.range === 'custom' ? '30d' : state.range, tz: TIME_ZONE },
        [state.range, state.from, state.to]
    );
    return {
        state,
        set,
        args,
        interval: state.interval,
        compare: state.compare as 'previous' | 'none',
    };
}

/** Query string carrying the shared analysis state to another analytics page. */
export function analysisSearch(state: Record<string, string>) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) {
        if (
            k in ANALYSIS_DEFAULTS &&
            v &&
            v !== ANALYSIS_DEFAULTS[k as keyof typeof ANALYSIS_DEFAULTS]
        )
            p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : '';
}

const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
});
const moneyRound = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });

/** A duration in ms as "4 min", "2.5 h", "3.1 days"; negative reads "early". */
export function formatSpan(ms: number) {
    const sign = ms < 0 ? '-' : '';
    const a = Math.abs(ms);
    if (a < 60_000) return `${sign}${Math.round(a / 1000)} s`;
    if (a < 3_600_000) return `${sign}${Math.round(a / 60_000)} min`;
    if (a < 86_400_000) return `${sign}${num.format(a / 3_600_000)} h`;
    return `${sign}${num.format(a / 86_400_000)} days`;
}

/** A metric value in its unit; an em dash for no data. */
export function formatValue(value: number | null | undefined, unit: Unit, compact = false): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    switch (unit) {
        case 'money':
            return compact && Math.abs(value) >= 1000
                ? moneyRound.format(value)
                : money.format(value);
        case 'percent':
            return `${num.format(value)}%`;
        case 'duration':
            return formatSpan(value);
        case 'hours':
            return `${num.format(value)} h`;
        default:
            return num.format(value);
    }
}

/** Short label for a bucket's first day. */
export function bucketLabel(key: string, interval: Interval) {
    const d = dayjs(key);
    if (interval === 'month') return d.format('MMM YYYY');
    if (interval === 'week') return `w/c ${d.format('D MMM')}`;
    return d.format('D MMM');
}

export const rangeText = (r: { from: string; to: string }) =>
    r.from === r.to
        ? dayjs(r.from).format('D MMM YYYY')
        : `${dayjs(r.from).format('D MMM YYYY')} to ${dayjs(r.to).format('D MMM YYYY')}`;

/** A console link into the Operations list behind a figure. */
export const drillHref = (drill: Drill | null | undefined) =>
    drill ? `${drill.path}?${new URLSearchParams(drill.params)}` : undefined;

/** Values for the chart wrappers: they draw a gap where a value is missing. */
export const gaps = (values: (number | null)[], scale = 1) =>
    values.map((v) =>
        v === null ? null : scale === 1 ? v : Math.round((v / scale) * 10) / 10
    ) as unknown as number[];

/**
 * Durations are drawn in minutes or hours (whichever reads better for the largest value), so the
 * axis shows plain numbers in that unit; `scale` turns a drawn value back into milliseconds.
 */
export function chartScale(unit: Unit, lists: (number | null)[][]) {
    if (unit !== 'duration') return { scale: 1, axis: '' };
    const max = Math.max(0, ...lists.flat().map((v) => Math.abs(v ?? 0)));
    return max >= 2 * 3_600_000
        ? { scale: 3_600_000, axis: 'hours' }
        : { scale: 60_000, axis: 'minutes' };
}

export const SERVICE_NAMES: Record<number, string> = {
    1: 'Public Area Attendant',
    2: 'Room Attendant',
    3: 'Linen Porter',
};

export const BREAKDOWN_LABELS: Record<string, string> = {
    service: 'Service',
    platform: 'Platform',
    city: 'City',
    status: 'Status',
    cancelledBy: 'Who cancelled',
    stage: 'Stage',
    reason: 'Reason',
    appVersion: 'App version',
    role: 'Role',
    decision: 'Decision',
};

const LABEL_WORDS: Record<string, string> = {
    unknown: 'Not recorded',
    in_progress: 'In progress',
    customer: 'Customer',
    provider: 'Provider',
    admin: 'Admin',
    open: 'Open',
    accepted: 'Accepted',
    completed: 'Completed',
    cancelled: 'Cancelled',
    expired: 'Expired',
    approved: 'Approved',
    rejected: 'Rejected',
    pending: 'Pending',
    android: 'Android',
    ios: 'iOS',
    web: 'Web',
};

/** Readable series name from a breakdown key ("in_progress" -> "In progress"). */
export const seriesLabel = (label: string) =>
    LABEL_WORDS[label] ?? (/^[a-z]/.test(label) ? label[0].toUpperCase() + label.slice(1) : label);
