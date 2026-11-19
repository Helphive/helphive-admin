import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Box,
    Link,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    ToggleButton,
    ToggleButtonGroup,
} from '@mui/material';
import dayjs from 'dayjs';
import { ErrorBoundary, ErrorState, Panel, srOnly } from '@/components/ui';
import { BarChart } from '@/components/charts';
import { getErrorMessage } from '@/lib/api';
import { chart, color, font, radius } from '@/theme/tokens';
import {
    useGetCohortsQuery,
    useGetDistributionQuery,
    useGetFunnelQuery,
    useGetLeaderboardQuery,
} from './api';
import { formatValue, TIME_ZONE, useAnalysis } from './model';
import { EmptyRange } from './MetricPanel';

const loading = (h: number) => <Skeleton variant="rounded" height={h} />;

/** Ink ramp step for a share 0-100: light to dark, with text that stays readable on it. */
function rampCell(rate: number | null) {
    if (rate === null) return { bg: 'transparent', fg: color.ink300 };
    const ramp = chart.sequential;
    const i =
        rate <= 0 ? 0 : Math.min(ramp.length - 1, 1 + Math.floor((rate / 100) * (ramp.length - 1)));
    return { bg: ramp[i], fg: i >= 3 ? '#FFFFFF' : color.ink900 };
}

/* ---------- Funnel ---------- */

export function FunnelPanel({ kind }: { kind: 'customer' | 'provider' }) {
    const { args, set, state } = useAnalysis();
    const q = useGetFunnelQuery({ ...args, kind });
    const title = kind === 'customer' ? 'Customer funnel' : 'Provider funnel';
    let body;
    if (q.isLoading) body = loading(220);
    else if (q.error || !q.data)
        body = (
            <ErrorState
                bare
                title={`Could not load the ${title.toLowerCase()}`}
                message={getErrorMessage(q.error, '')}
                onRetry={q.refetch}
            />
        );
    else if (!q.data.steps[0]?.count)
        body = (
            <EmptyRange
                what={kind === 'customer' ? 'customer sign-ups' : 'provider sign-ups'}
                onAllTime={
                    state.range === 'all'
                        ? undefined
                        : () => set({ range: 'all', from: '', to: '' })
                }
            />
        );
    else {
        const first = q.data.steps[0].count;
        body = (
            <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>
                {q.data.steps.map((s, i) => (
                    <Box component="li" key={s.id} sx={{ display: 'grid', gap: 0.5 }}>
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 1,
                                fontSize: font.size.sm,
                            }}
                        >
                            <Box component="span" sx={{ fontWeight: 600, color: color.ink700 }}>
                                {s.label}
                            </Box>
                            <Box
                                component="span"
                                sx={{ color: color.ink600, whiteSpace: 'nowrap' }}
                            >
                                <Box component="strong" sx={{ color: color.ink900 }}>
                                    {s.count}
                                </Box>
                                {i > 0 &&
                                    s.fromPrevious !== null &&
                                    `, ${s.fromPrevious}% of the step before`}
                            </Box>
                        </Box>
                        <Box
                            sx={{
                                height: 14,
                                bgcolor: color.skeleton,
                                borderRadius: `${radius.sm}px`,
                                overflow: 'hidden',
                            }}
                        >
                            <Box
                                sx={{
                                    height: '100%',
                                    width: `${Math.max(first ? (s.count / first) * 100 : 0, s.count ? 1.5 : 0)}%`,
                                    bgcolor: i === 0 ? color.ink900 : chart.categorical[0],
                                    borderRadius: `${radius.sm}px`,
                                }}
                            />
                        </Box>
                    </Box>
                ))}
            </Box>
        );
    }
    return (
        <Panel
            title={title}
            subtitle={
                kind === 'customer'
                    ? 'Customers who signed up in the period, and how far each got to date'
                    : 'Providers who signed up in the period, and how far each got to date'
            }
        >
            {body}
        </Panel>
    );
}

/* ---------- Cohorts ---------- */

export function CohortPanel({ subject }: { subject: 'customers' | 'providers' }) {
    const [months, setMonths] = useState(12);
    const q = useGetCohortsQuery({ subject, months, tz: TIME_ZONE });
    const title = subject === 'customers' ? 'Customer retention' : 'Provider retention';
    let body;
    if (q.isLoading) body = loading(260);
    else if (q.error || !q.data)
        body = (
            <ErrorState
                bare
                title={`Could not load ${title.toLowerCase()}`}
                message={getErrorMessage(q.error, '')}
                onRetry={q.refetch}
            />
        );
    else if (!q.data.cohorts.some((c) => c.size))
        body = (
            <EmptyRange
                what={
                    subject === 'customers' ? 'paying customers' : 'providers with completed jobs'
                }
            />
        );
    else {
        const width = Math.max(...q.data.cohorts.map((c) => c.cells.length));
        body = (
            <Box sx={{ overflowX: 'auto' }}>
                <Table
                    size="small"
                    aria-label={`${title}: share of each cohort active in later months`}
                    sx={{ '& td, & th': { px: 0.75, py: 0.5, border: 0 } }}
                >
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>First month</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                                Size
                            </TableCell>
                            {Array.from({ length: width }, (_, k) => (
                                <TableCell
                                    key={k}
                                    align="center"
                                    sx={{ fontWeight: 700, color: color.ink500 }}
                                >
                                    {k === 0 ? 'Month 0' : `+${k}`}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {q.data.cohorts.map((c) => (
                            <TableRow key={c.cohort}>
                                <TableCell
                                    component="th"
                                    scope="row"
                                    sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}
                                >
                                    {dayjs(`${c.cohort}-01`).format('MMM YYYY')}
                                </TableCell>
                                <TableCell align="right">{c.size}</TableCell>
                                {Array.from({ length: width }, (_, k) => {
                                    const cell = c.cells[k];
                                    if (!cell) return <TableCell key={k} />;
                                    const { bg, fg } = rampCell(c.size ? cell.rate : null);
                                    return (
                                        <TableCell
                                            key={k}
                                            align="center"
                                            sx={{ p: '2px !important' }}
                                        >
                                            <Box
                                                title={`${cell.count} of ${c.size}`}
                                                sx={{
                                                    minWidth: 44,
                                                    py: 0.5,
                                                    borderRadius: '4px',
                                                    bgcolor: bg,
                                                    color: fg,
                                                    fontSize: font.size.xs,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {c.size ? `${cell.rate}%` : '—'}
                                                <Box component="span" sx={srOnly}>
                                                    {` (${cell.count} of ${c.size})`}
                                                </Box>
                                            </Box>
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Box>
        );
    }
    return (
        <Panel
            title={title}
            subtitle={q.data?.definition}
            actions={
                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={months}
                    onChange={(_, v) => v && setMonths(v)}
                    aria-label="Months shown"
                >
                    <ToggleButton value={6}>6 months</ToggleButton>
                    <ToggleButton value={12}>12</ToggleButton>
                    <ToggleButton value={24}>24</ToggleButton>
                </ToggleButtonGroup>
            }
        >
            {body}
        </Panel>
    );
}

/* ---------- Leaderboard ---------- */

export function LeaderboardPanel({ subject }: { subject: 'customers' | 'providers' }) {
    const { args, set, state } = useAnalysis();
    const [by, setBy] = useState<'value' | 'count'>('value');
    const q = useGetLeaderboardQuery({ ...args, subject, by, limit: 10 });
    const title = subject === 'customers' ? 'Top customers' : 'Top providers';
    let body;
    if (q.isLoading) body = loading(240);
    else if (q.error || !q.data)
        body = (
            <ErrorState
                bare
                title={`Could not load ${title.toLowerCase()}`}
                message={getErrorMessage(q.error, '')}
                onRetry={q.refetch}
            />
        );
    else if (!q.data.items.length)
        body = (
            <EmptyRange
                what={subject === 'customers' ? 'paid bookings' : 'provider earnings'}
                onAllTime={
                    state.range === 'all'
                        ? undefined
                        : () => set({ range: 'all', from: '', to: '' })
                }
            />
        );
    else
        body = (
            <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" aria-label={title}>
                    <TableHead>
                        <TableRow>
                            <TableCell>Rank</TableCell>
                            <TableCell>
                                {subject === 'customers' ? 'Customer' : 'Provider'}
                            </TableCell>
                            <TableCell align="right">
                                {subject === 'customers' ? 'Paid' : 'Earned'}
                            </TableCell>
                            <TableCell align="right">
                                {subject === 'customers' ? 'Bookings' : 'Jobs'}
                            </TableCell>
                            {subject === 'providers' && <TableCell align="right">Hours</TableCell>}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {q.data.items.map((r) => (
                            <TableRow key={r._id}>
                                <TableCell>{r.rank}</TableCell>
                                <TableCell>
                                    <Link
                                        component={RouterLink}
                                        to={`/users/${r._id}`}
                                        sx={{ fontWeight: 600 }}
                                    >
                                        {r.name ?? 'Deleted account'}
                                    </Link>
                                </TableCell>
                                <TableCell align="right">{formatValue(r.value, 'money')}</TableCell>
                                <TableCell align="right">{r.count}</TableCell>
                                {subject === 'providers' && (
                                    <TableCell align="right">{r.hours ?? 0}</TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Box>
        );
    return (
        <Panel
            title={title}
            subtitle={q.data?.definition}
            actions={
                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={by}
                    onChange={(_, v) => v && setBy(v)}
                    aria-label="Rank by"
                >
                    <ToggleButton value="value">By value</ToggleButton>
                    <ToggleButton value="count">By count</ToggleButton>
                </ToggleButtonGroup>
            }
            flush={!!q.data?.items.length}
        >
            {body}
        </Panel>
    );
}

/* ---------- Distribution ---------- */

export function DistributionPanel({
    metric,
    title,
    subtitle,
}: {
    metric: string;
    title: string;
    subtitle: string;
}) {
    const { args, set, state } = useAnalysis();
    const q = useGetDistributionQuery({ ...args, metric });
    let body;
    if (q.isLoading) body = loading(240);
    else if (q.error || !q.data)
        body = (
            <ErrorState
                bare
                title={`Could not load ${title.toLowerCase()}`}
                message={getErrorMessage(q.error, '')}
                onRetry={q.refetch}
            />
        );
    else if (!q.data.stats.count)
        body = (
            <EmptyRange
                what={title.toLowerCase()}
                onAllTime={
                    state.range === 'all'
                        ? undefined
                        : () => set({ range: 'all', from: '', to: '' })
                }
            />
        );
    else {
        const { unit } = q.data.metric;
        const { stats, histogram } = q.data;
        const f = (v: number | null) => formatValue(v, unit, true);
        body = (
            <>
                <Box
                    sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 2.5,
                        mb: 1.5,
                        fontSize: font.size.sm,
                        color: color.ink600,
                    }}
                >
                    <span>
                        Median <strong>{f(stats.p50)}</strong>
                    </span>
                    <span>
                        90th percentile <strong>{f(stats.p90)}</strong>
                    </span>
                    <span>
                        Range <strong>{f(stats.min)}</strong> to <strong>{f(stats.max)}</strong>
                    </span>
                    <span>
                        Counted <strong>{stats.count}</strong>
                    </span>
                </Box>
                <ErrorBoundary>
                    <BarChart
                        title={title}
                        categories={histogram.map((b) => `${f(b.from)}–${f(b.to)}`)}
                        series={[
                            {
                                name: 'Count',
                                values: histogram.map((b) => b.count),
                                color: chart.categorical[0],
                            },
                        ]}
                        categoryLabel="Band"
                        summary={`${title}: median ${f(stats.p50)}, 90th percentile ${f(stats.p90)}, ${stats.count} counted.`}
                        height={220}
                    />
                </ErrorBoundary>
            </>
        );
    }
    return (
        <Panel title={title} subtitle={subtitle}>
            {body}
        </Panel>
    );
}
