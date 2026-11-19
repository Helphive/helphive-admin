// Server-driven lists. Every admin list endpoint answers { items, page, pageSize, total } and takes
// page (from 1), pageSize (max 100), sort=field or sort=-field (whitelisted per endpoint), from/to
// (YYYY-MM-DD or ISO time with zone), q (only where the endpoint has search) and single-value
// filters. Unknown or empty-looking parameters are refused with 400 { message, field }, so build
// query strings with `listQueryString`, which leaves out empty values and the "all" choice.
import type { SortingState } from '@tanstack/react-table';
import { resolveRange, type DateRangeValue } from '@/components/data';

export interface ListPage<T> {
    items: T[];
    page: number;
    pageSize: number;
    total: number;
}

export type ListParams = Record<string, string | number | null | undefined>;

/** "?page=2&sort=-at&role=finance" without empty values or "all". */
export function listQueryString(params: ListParams): string {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '' || v === 'all') continue;
        q.set(k, String(v));
    }
    const s = q.toString();
    return s ? `?${s}` : '';
}

/** The API's sort parameter ("-createdAt") as the table's sorting state, and back. */
export function sortingFromParam(sort: string): SortingState {
    if (!sort) return [];
    return [{ id: sort.replace(/^-/, ''), desc: sort.startsWith('-') }];
}

export function sortParamFrom(sorting: SortingState, fallback: string): string {
    const s = sorting[0];
    return s ? `${s.desc ? '-' : ''}${s.id}` : fallback;
}

/**
 * A date range field's value as the API's from/to (dates, read as UTC days). Presets start on the
 * day they reach back to, so the query stays the same between renders and stays cached.
 */
export function rangeParams(value: DateRangeValue): { from?: string; to?: string } {
    if (value.range === 'custom') return { from: value.from, to: value.to };
    const r = resolveRange(value);
    return { from: r.start ? r.start.toISOString().slice(0, 10) : undefined };
}
