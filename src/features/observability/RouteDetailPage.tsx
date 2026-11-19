import { Link as RouterLink } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { DonutChart } from '@/components/charts';
import { KpiRow, KpiTile } from '@/components/data';
import { ErrorBoundary, PageHeader, PageSkeleton, Panel } from '@/components/ui';
import { ErrorsIcon, LogsIcon } from '@/components/ui/icons';
import { usePageCrumb } from '@/features/shell/crumbContext';
import { formatNumber } from '@/lib/format';
import { useDocumentTitle, useUrlState } from '@/lib/hooks';
import { color } from '@/theme/tokens';
import { useGetRequestSummaryQuery } from './api';
import { formatMs, formatPerMinute, formatRate, type RangeName } from './model';
import { LoadError, Mono, NoDataYet, RangeSelect, RequestCharts } from './parts';

export default function RouteDetailPage() {
    const [f, setF] = useUrlState({ route: '', method: 'GET', range: '24h' });
    const range = f.range as RangeName;
    useDocumentTitle(`${f.method} ${f.route}`);
    usePageCrumb(`${f.method} ${f.route}`);
    const q = useGetRequestSummaryQuery(
        { range, route: f.route, method: f.method },
        { skip: !f.route }
    );
    const t = q.data?.totals;
    const p = q.data?.previous;

    return (
        <>
            <PageHeader
                title={<Mono inherit>{`${f.method} ${f.route}`}</Mono>}
                subtitle="Traffic, failures and latency for this route."
                actions={
                    <>
                        <RangeSelect value={range} onChange={(v) => setF({ range: v })} />
                        <Button
                            variant="outlined"
                            startIcon={<LogsIcon />}
                            component={RouterLink}
                            to={`/observability/logs?route=${encodeURIComponent(f.route)}&range=${range === '30d' || range === '7d' ? '24h' : range}`}
                        >
                            Logs
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<ErrorsIcon />}
                            component={RouterLink}
                            to={`/observability/errors?q=${encodeURIComponent(f.route)}`}
                        >
                            Errors
                        </Button>
                    </>
                }
            />
            {q.isLoading ? (
                <PageSkeleton />
            ) : q.error || !q.data || !t ? (
                <LoadError error={q.error} what="this route" onRetry={q.refetch} />
            ) : (
                <>
                    <KpiRow columns={4} aria-label="Totals for this route">
                        <KpiTile
                            label="Requests"
                            value={formatNumber(t.requests)}
                            hint={formatPerMinute(t.perMinute)}
                            delta={
                                p
                                    ? {
                                          current: t.requests,
                                          previous: p.requests,
                                          label: 'vs the period before',
                                          good: 'neutral',
                                      }
                                    : undefined
                            }
                        />
                        <KpiTile
                            label="Server errors"
                            value={formatRate(t.errorRate)}
                            hint={`${formatNumber(t.errors)} answered 5xx`}
                        />
                        <KpiTile
                            label="p95 latency"
                            value={formatMs(t.p95)}
                            hint={`p50 ${formatMs(t.p50)}, p99 ${formatMs(t.p99)}, max ${formatMs(t.maxMs)}`}
                        />
                        <KpiTile
                            label="Client errors"
                            value={formatNumber(t.clientErrors)}
                            hint={`${formatNumber(t.rateLimited)} of them rate limited`}
                        />
                    </KpiRow>
                    {t.requests ? (
                        <Box
                            sx={{
                                display: 'grid',
                                gap: 2.5,
                                mt: 2.5,
                                gridTemplateColumns: {
                                    xs: '1fr',
                                    lg: 'minmax(0, 3fr) minmax(0, 1fr)',
                                },
                            }}
                        >
                            <Panel title="Over time">
                                <RequestCharts points={q.data.series} bucketMs={q.data.bucketMs} />
                            </Panel>
                            <Panel title="Answers by status">
                                <ErrorBoundary>
                                    <DonutChart
                                        title="Answers by status"
                                        centerValue={formatNumber(t.requests)}
                                        centerLabel="requests"
                                        slices={[
                                            {
                                                name: '2xx',
                                                value: t.status['2xx'],
                                                color: color.green500,
                                            },
                                            {
                                                name: '3xx',
                                                value: t.status['3xx'],
                                                color: color.blue500,
                                            },
                                            {
                                                name: '4xx',
                                                value: t.status['4xx'] - t.status['429'],
                                                color: color.amber500,
                                            },
                                            {
                                                name: '429',
                                                value: t.status['429'],
                                                color: color.ink500,
                                            },
                                            {
                                                name: '5xx',
                                                value: t.status['5xx'],
                                                color: color.red500,
                                            },
                                        ].filter((s) => s.value > 0)}
                                    />
                                </ErrorBoundary>
                            </Panel>
                        </Box>
                    ) : (
                        <Panel sx={{ mt: 2.5 }}>
                            <NoDataYet what="requests for this route">
                                Pick a longer range, or check the route pattern in the address bar.
                            </NoDataYet>
                        </Panel>
                    )}
                </>
            )}
        </>
    );
}
