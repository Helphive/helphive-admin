import { api } from '@/lib/api';

// Shapes of GET /admin/analytics/* (helphive-backend, scratch/admin/analytics-api.md).

export type Unit = 'count' | 'money' | 'percent' | 'duration' | 'hours' | 'number';
export type Good = 'up' | 'down' | 'neutral';
export type Interval = 'day' | 'week' | 'month';
export type RangePreset = '7d' | '30d' | '90d' | '12m' | 'ytd' | 'all';

export interface Drill {
    path: string;
    params: Record<string, string>;
}

export interface MetricInfo {
    id: string;
    label: string;
    description: string;
    computation: string;
    group: 'bookings' | 'revenue' | 'health' | 'customers' | 'providers' | 'platform';
    unit: Unit;
    good: Good;
    kind: 'aggregate' | 'derived' | 'custom';
    breakdowns: string[];
    distribution: boolean;
    drill: Drill | null;
    note: string | null;
}

export interface Catalogue {
    metrics: MetricInfo[];
    breakdowns: Record<string, string>;
    services: { id: number; name: string }[];
    distributions: { id: string; label: string; unit: Unit }[];
}

export interface RangeOut {
    from: string;
    to: string;
    timeZone: string;
    interval: Interval;
    days: number;
    preset?: string;
}

export interface Delta {
    current: number | null;
    previous: number | null;
    change: number | null;
    changePct: number | null;
}

export interface SeriesResult {
    metric: MetricInfo;
    range: RangeOut;
    breakdown: string | null;
    stat: string | null;
    buckets: string[];
    values: (number | null)[];
    total: number | null;
    count: number;
    series: { key: string; label: string; values: (number | null)[]; total: number | null }[];
    previous: {
        range: RangeOut;
        buckets: string[];
        values: (number | null)[];
        total: number | null;
    } | null;
    delta: Delta | null;
    drill: Drill | null;
}

export interface SummaryMetric extends MetricInfo {
    value: number | null;
    previous: number | null;
    delta: Delta;
    count: number;
    sparkline: (number | null)[];
    drill: Drill | null;
}

export interface SummaryResult {
    range: RangeOut;
    previousRange: RangeOut;
    buckets: string[];
    metrics: SummaryMetric[];
    activity: {
        firstBookingAt: string | null;
        lastBookingAt: string | null;
        firstSignUpAt: string | null;
    };
}

export interface FunnelResult {
    kind: 'customer' | 'provider';
    range: RangeOut;
    cohort: string;
    steps: {
        id: string;
        label: string;
        count: number;
        fromStart: number | null;
        fromPrevious: number | null;
    }[];
}

export interface CohortResult {
    subject: 'customers' | 'providers';
    months: string[];
    definition: string;
    cohorts: {
        cohort: string;
        size: number;
        cells: { offset: number; count: number; rate: number | null }[];
    }[];
}

export interface SupplyDemandResult {
    range: RangeOut;
    days: string[];
    grid: {
        definition: string;
        demand: {
            day: number;
            hour: number;
            serviceId: number;
            demand: number;
            filled: number;
            hours: number;
        }[];
        supply: { day: number; hour: number; supply: number }[];
    };
    areas: {
        precision: string;
        demand: {
            latitude: number;
            longitude: number;
            demand: number;
            filled: number;
            value: number;
        }[];
        providers: { latitude: number; longitude: number; providers: number }[];
    };
}

export interface LeaderRow {
    rank: number;
    _id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    value: number;
    count: number;
    hours?: number;
}

export interface LeaderboardResult {
    subject: 'customers' | 'providers';
    by: 'value' | 'count';
    definition: string;
    items: LeaderRow[];
}

export interface DistributionResult {
    metric: { id: string; label: string; unit: Unit };
    stats: {
        count: number;
        mean: number | null;
        p50: number | null;
        p90: number | null;
        min: number | null;
        max: number | null;
    };
    histogram: { from: number; to: number; count: number }[];
}

export interface ViewQuery {
    metric: string;
    breakdown?: string | null;
    range?: string | null;
    from?: string | null;
    to?: string | null;
    interval?: string | null;
    compare?: string | null;
    stat?: string | null;
    chart?: string | null;
}

export interface SavedView {
    _id: string;
    name: string;
    shared: boolean;
    mine: boolean;
    ownerEmail: string;
    query: ViewQuery;
    updatedAt: string;
}

/** Query string without empty values ('' and null), in a stable order so the cache is shared. */
export const qs = (params: Record<string, string | number | null | undefined>) => {
    const entries = Object.entries(params)
        .filter(
            ([, v]) => v !== '' && v !== null && v !== undefined && v !== 'auto' && v !== 'none'
        )
        .sort(([a], [b]) => a.localeCompare(b));
    return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : '';
};

export type RangeArgs = { range?: string; from?: string; to?: string; tz?: string };
export type SeriesArgs = RangeArgs & {
    metric: string;
    interval?: string;
    breakdown?: string;
    compare?: string;
    stat?: string;
};

const BASE = '/admin/analytics';

export const analyticsApi = api.injectEndpoints({
    endpoints: (build) => ({
        getCatalogue: build.query<Catalogue, void>({
            query: () => `${BASE}/metrics`,
            keepUnusedDataFor: 3600,
        }),
        getSeries: build.query<SeriesResult, SeriesArgs>({
            query: (a) => `${BASE}/series${qs(a)}`,
        }),
        getSummary: build.query<SummaryResult, RangeArgs & { metrics: string; interval?: string }>({
            query: (a) => `${BASE}/summary${qs(a)}`,
        }),
        getFunnel: build.query<FunnelResult, RangeArgs & { kind: 'customer' | 'provider' }>({
            query: (a) => `${BASE}/funnel${qs(a)}`,
        }),
        getCohorts: build.query<
            CohortResult,
            { subject: 'customers' | 'providers'; months: number; tz?: string }
        >({
            query: (a) => `${BASE}/cohorts${qs(a)}`,
        }),
        getSupplyDemand: build.query<SupplyDemandResult, RangeArgs & { service?: string }>({
            query: (a) => `${BASE}/supply-demand${qs(a)}`,
        }),
        getLeaderboard: build.query<
            LeaderboardResult,
            RangeArgs & {
                subject: 'customers' | 'providers';
                by: 'value' | 'count';
                limit?: number;
            }
        >({
            query: (a) => `${BASE}/leaderboards${qs(a)}`,
        }),
        getDistribution: build.query<DistributionResult, RangeArgs & { metric: string }>({
            query: (a) => `${BASE}/distribution${qs(a)}`,
        }),
        exportSeriesCsv: build.mutation<string, SeriesArgs>({
            query: (a) => ({ url: `${BASE}/series.csv${qs(a)}`, responseHandler: 'text' }),
        }),
        listViews: build.query<SavedView[], void>({
            query: () => `${BASE}/views`,
            transformResponse: (raw: { items: SavedView[] }) => raw.items,
            providesTags: ['AnalyticsViews'],
        }),
        createView: build.mutation<
            { view: SavedView },
            { name: string; query: ViewQuery; shared?: boolean }
        >({
            query: (body) => ({ url: `${BASE}/views`, method: 'POST', body }),
            invalidatesTags: ['AnalyticsViews'],
        }),
        updateView: build.mutation<
            { view: SavedView },
            { id: string; name?: string; shared?: boolean }
        >({
            query: ({ id, ...body }) => ({ url: `${BASE}/views/${id}`, method: 'PATCH', body }),
            invalidatesTags: ['AnalyticsViews'],
        }),
        deleteView: build.mutation<void, string>({
            query: (id) => ({ url: `${BASE}/views/${id}`, method: 'DELETE' }),
            invalidatesTags: ['AnalyticsViews'],
        }),
    }),
});

export const {
    useGetCatalogueQuery,
    useGetSeriesQuery,
    useGetSummaryQuery,
    useGetFunnelQuery,
    useGetCohortsQuery,
    useGetSupplyDemandQuery,
    useGetLeaderboardQuery,
    useGetDistributionQuery,
    useExportSeriesCsvMutation,
    useListViewsQuery,
    useCreateViewMutation,
    useUpdateViewMutation,
    useDeleteViewMutation,
} = analyticsApi;
