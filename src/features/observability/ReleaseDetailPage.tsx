import { Link as RouterLink, useParams } from 'react-router-dom';
import { Box, Link, Stack, Typography } from '@mui/material';
import { KpiRow, KpiTile } from '@/components/data';
import { DetailSkeleton, PageHeader, Panel, StatusPill } from '@/components/ui';
import { usePageCrumb } from '@/features/shell/crumbContext';
import { formatDateTime, formatNumber } from '@/lib/format';
import { useDocumentTitle } from '@/lib/hooks';
import { color, font } from '@/theme/tokens';
import { useGetReleaseQuery } from './api';
import { formatMs, formatRate, shortRevision } from './model';
import { LoadError, Mono, NoDataYet, RequestCharts } from './parts';

export default function ReleaseDetailPage() {
    const { revision = '' } = useParams();
    useDocumentTitle(`Release ${shortRevision(revision)}`);
    usePageCrumb(shortRevision(revision));
    const q = useGetReleaseQuery(revision);
    if (q.isLoading) return <DetailSkeleton />;
    if (q.error || !q.data)
        return <LoadError error={q.error} what="this release" onRetry={q.refetch} />;
    const { release, health, series } = q.data;
    const b = health.before;
    const a = health.after;
    return (
        <>
            <PageHeader
                title={<Mono inherit>{release.revision}</Mono>}
                badge={
                    q.data.current ? (
                        <StatusPill tone="green" size="md">
                            Serving
                        </StatusPill>
                    ) : undefined
                }
                subtitle={`Went live ${formatDateTime(release.firstSeenAt)}${release.commit ? `, commit ${release.commit.slice(0, 7)}` : ''}. Compared over ${health.windowHours} hours each side.`}
            />
            <KpiRow columns={4} aria-label="Before and after">
                <KpiTile
                    label="Error rate after"
                    value={formatRate(a.errorRate)}
                    delta={
                        a.errorRate != null && b.errorRate != null
                            ? {
                                  current: a.errorRate,
                                  previous: b.errorRate,
                                  label: 'vs before',
                                  good: 'down',
                                  unit: 'points',
                              }
                            : undefined
                    }
                    hint={`Before: ${formatRate(b.errorRate)}`}
                />
                <KpiTile
                    label="p95 after"
                    value={formatMs(a.p95)}
                    hint={`Before: ${formatMs(b.p95)}`}
                />
                <KpiTile
                    label="Requests after"
                    value={formatNumber(a.requests)}
                    hint={`Before: ${formatNumber(b.requests)}`}
                />
                <KpiTile
                    label="New error groups"
                    value={formatNumber(health.newErrorGroups?.length ?? 0)}
                    hint="First seen in this release"
                />
            </KpiRow>
            <Panel
                title="Around the release"
                subtitle="The dashed line marks when it went live"
                sx={{ mt: 2.5 }}
            >
                {series.some((p) => p.requests) ? (
                    <RequestCharts points={series} bucketMs={30 * 60_000} releases={[release]} />
                ) : (
                    <NoDataYet what="requests around this release" />
                )}
            </Panel>
            <Panel title="Errors first seen in this release" sx={{ mt: 2.5 }} flush>
                {health.newErrorGroups?.length ? (
                    <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                        {health.newErrorGroups.map((g) => (
                            <Box
                                component="li"
                                key={g.id}
                                sx={{
                                    px: 2.5,
                                    py: 1.25,
                                    borderTop: `1px solid ${color.line}`,
                                    '&:first-of-type': { borderTop: 0 },
                                }}
                            >
                                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                                    <Link
                                        component={RouterLink}
                                        to={`/observability/errors/${g.id}`}
                                        sx={{
                                            flex: 1,
                                            fontWeight: 700,
                                            minWidth: 0,
                                            overflowWrap: 'anywhere',
                                        }}
                                    >
                                        {g.title}
                                    </Link>
                                    <Typography sx={{ fontWeight: 800, fontSize: font.size.md }}>
                                        {formatNumber(g.count)}
                                    </Typography>
                                </Stack>
                            </Box>
                        ))}
                    </Box>
                ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2.5 }}>
                        No error appeared for the first time in this release.
                    </Typography>
                )}
            </Panel>
            <Stack direction="row" spacing={3} sx={{ mt: 2.5 }}>
                {q.data.previous && (
                    <Link
                        component={RouterLink}
                        to={`/observability/releases/${encodeURIComponent(q.data.previous.revision)}`}
                    >
                        Previous: {shortRevision(q.data.previous.revision)}
                    </Link>
                )}
                {q.data.next && (
                    <Link
                        component={RouterLink}
                        to={`/observability/releases/${encodeURIComponent(q.data.next.revision)}`}
                    >
                        Next: {shortRevision(q.data.next.revision)}
                    </Link>
                )}
            </Stack>
        </>
    );
}
