import { useMemo } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Button, Link, Typography } from '@mui/material';
import {
    EmptyState,
    ErrorBoundary,
    ErrorState,
    PageHeader,
    PageSkeleton,
    Panel,
} from '@/components/ui';
import { ApplicationsIcon } from '@/components/ui/icons';
import {
    DateRangeField,
    FilterBar,
    KpiRow,
    KpiTile,
    resolveRange,
    type DateRangeValue,
} from '@/components/data';
import {
    BarChart,
    ChartNote,
    DonutChart,
    HeatmapChart,
    TimeSeriesChart,
} from '@/components/charts';
import { useAllApplications } from '@/features/applications/api';
import { ApplicantCell, WaitMeter } from '@/features/applications/parts';
import { getErrorMessage } from '@/lib/api';
import { formatDuration, formatPercent } from '@/lib/format';
import { useDocumentTitle, useNow, useUrlState } from '@/lib/hooks';
import { chart, color, hairline } from '@/theme/tokens';
import { computeOverview } from './insights';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function ApplicationInsightsPage() {
    useDocumentTitle('Application insights');
    const navigate = useNavigate();
    const now = useNow();
    const [filters, setFilters] = useUrlState({ range: 'all', from: '', to: '' });
    const range: DateRangeValue = {
        range: filters.range as DateRangeValue['range'],
        from: filters.from || undefined,
        to: filters.to || undefined,
    };
    const resolved = resolveRange(range);
    const { all, isLoading, error, refetch, isFetching } = useAllApplications();

    const stats = useMemo(
        () => computeOverview(all, resolved, now),
        // resolved follows the filter strings.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [all, filters.range, filters.from, filters.to, now]
    );

    if (isLoading) return <PageSkeleton label="Loading application insights" />;
    if (error && !all.length) {
        return (
            <ErrorState
                title="Could not load application insights"
                message={getErrorMessage(error, 'The API did not answer.')}
                onRetry={refetch}
                retrying={isFetching}
            />
        );
    }

    const comparison = resolved.previous
        ? `vs previous ${resolved.label.replace(/^Last /, '')}`
        : '';
    const decided = stats.approved + stats.rejected;
    const period = resolved.label.toLowerCase();

    return (
        <>
            <PageHeader
                title="Application insights"
                subtitle="Provider onboarding: what is waiting now and what came in."
                actions={
                    <Button variant="contained" component={RouterLink} to="/applications">
                        Open review queue
                    </Button>
                }
            />

            <Box sx={{ display: 'grid', gap: 2.5 }}>
                <KpiRow columns={4} aria-label="Key figures">
                    <KpiTile
                        label="Waiting for review"
                        value={stats.waiting.length}
                        hint={stats.waiting.length ? 'Open the queue' : 'Nothing to review'}
                        to="/applications"
                    />
                    <KpiTile
                        label="Oldest waiting"
                        value={
                            stats.oldestWaitingMs === null
                                ? 'None'
                                : formatDuration(stats.oldestWaitingMs)
                        }
                        hint={stats.waiting[0] ? stats.waiting[0].name : 'The queue is empty'}
                        to={stats.waiting[0] ? `/applications/${stats.waiting[0].id}` : undefined}
                    />
                    <KpiTile
                        label={`Received, ${period}`}
                        value={stats.received}
                        sparkline={stats.monthly.total.length > 2 ? stats.monthly.total : undefined}
                        delta={
                            stats.receivedPrevious !== null
                                ? {
                                      current: stats.received,
                                      previous: stats.receivedPrevious,
                                      label: comparison,
                                      good: 'neutral',
                                  }
                                : undefined
                        }
                        hint={stats.receivedPrevious === null ? 'By submission date' : undefined}
                    />
                    <KpiTile
                        label="Approval rate"
                        value={
                            stats.approvalRate === null
                                ? 'None decided'
                                : formatPercent(stats.approvalRate)
                        }
                        hint={
                            decided
                                ? `${stats.approved} of ${plural(decided, 'decision')}`
                                : undefined
                        }
                        delta={
                            stats.approvalRate !== null && stats.approvalRatePrevious !== null
                                ? {
                                      current: stats.approvalRate,
                                      previous: stats.approvalRatePrevious,
                                      label: comparison,
                                      good: 'neutral',
                                      unit: 'points',
                                  }
                                : undefined
                        }
                    />
                </KpiRow>

                <FilterBar summary={`Charts by submission date, ${period}`}>
                    <DateRangeField
                        label="Submitted"
                        value={range}
                        onChange={(v) =>
                            setFilters({ range: v.range, from: v.from ?? '', to: v.to ?? '' })
                        }
                    />
                </FilterBar>

                <Box
                    sx={{
                        display: 'grid',
                        gap: 2.5,
                        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(0, 1fr)' },
                    }}
                >
                    <Panel
                        title="Applications received"
                        subtitle="Per month, by where each one stands today"
                    >
                        <ErrorBoundary>
                            <TimeSeriesChart
                                title="Applications received per month"
                                kind="bar"
                                stacked
                                x={stats.months}
                                xLabel="Month"
                                series={[
                                    {
                                        name: 'Approved',
                                        values: stats.monthly.approved,
                                        color: chart.status.approved,
                                    },
                                    {
                                        name: 'Rejected',
                                        values: stats.monthly.rejected,
                                        color: chart.status.rejected,
                                    },
                                    {
                                        name: 'Waiting',
                                        values: stats.monthly.pending,
                                        color: chart.status.pending,
                                    },
                                ]}
                                height={260}
                            />
                        </ErrorBoundary>
                    </Panel>
                    <Panel title="Outcome" subtitle={`Applications received, ${period}`}>
                        <ErrorBoundary>
                            <DonutChart
                                title="Outcome of applications"
                                centerLabel="received"
                                slices={[
                                    {
                                        name: 'Approved',
                                        value: stats.approved,
                                        color: chart.status.approved,
                                    },
                                    {
                                        name: 'Rejected',
                                        value: stats.rejected,
                                        color: chart.status.rejected,
                                    },
                                    {
                                        name: 'Waiting',
                                        value: stats.stillWaiting,
                                        color: chart.status.pending,
                                    },
                                ]}
                                height={260}
                            />
                        </ErrorBoundary>
                    </Panel>
                </Box>

                <Box
                    sx={{
                        display: 'grid',
                        gap: 2.5,
                        gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' },
                    }}
                >
                    <Panel
                        title="Waiting longest"
                        flush
                        actions={
                            <Link component={RouterLink} to="/applications">
                                All waiting
                            </Link>
                        }
                    >
                        {stats.waiting.length ? (
                            <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                                {stats.waiting.slice(0, 5).map((a, i) => (
                                    <Box
                                        component="li"
                                        key={a.id}
                                        sx={{ borderTop: i ? hairline : 0 }}
                                    >
                                        <Box
                                            component={RouterLink}
                                            to={`/applications/${a.id}`}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: 1.5,
                                                px: 2,
                                                py: 1.25,
                                                color: 'inherit',
                                                textDecoration: 'none',
                                                '&:hover': { bgcolor: color.subtle },
                                                '&:focus-visible': { outlineOffset: -2 },
                                            }}
                                        >
                                            <ApplicantCell application={a} />
                                            <WaitMeter since={a.submittedAt} now={now} />
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        ) : (
                            <EmptyState
                                bare
                                icon={<ApplicationsIcon />}
                                title="Nothing is waiting"
                                description="New applications show up here, oldest first."
                                action={
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => navigate('/applications?view=history')}
                                    >
                                        See reviewed applications
                                    </Button>
                                }
                                sx={{ py: { xs: 4, sm: 4 } }}
                            />
                        )}
                    </Panel>
                    <Panel title="Services applied for" subtitle="An applicant can choose several">
                        <ErrorBoundary>
                            <BarChart
                                title="Applications per service"
                                horizontal
                                categoryLabel="Service"
                                categories={stats.services.map((s) => s.label)}
                                series={[
                                    {
                                        name: 'Applications',
                                        values: stats.services.map((s) => s.value),
                                        color: chart.categorical[0],
                                    },
                                ]}
                                height={200}
                            />
                        </ErrorBoundary>
                        {stats.noService > 0 && (
                            <ChartNote>{`${plural(stats.noService, 'application')} chose no service.`}</ChartNote>
                        )}
                    </Panel>
                    <Panel
                        title="When applications arrive"
                        subtitle="Day and time of submission, in your time zone"
                    >
                        <ErrorBoundary>
                            <HeatmapChart
                                title="Applications by weekday and time of day"
                                xLabels={stats.heat.xLabels}
                                yLabels={stats.heat.yLabels}
                                cells={stats.heat.cells}
                                xLabel="Hours"
                                yLabel="Day"
                                height={230}
                            />
                        </ErrorBoundary>
                    </Panel>
                </Box>

                <Typography variant="caption" component="p" sx={{ color: color.ink500 }}>
                    The API records when an application was submitted, not when it was decided, so
                    review times and decisions per week are not shown.
                </Typography>
            </Box>
        </>
    );
}
