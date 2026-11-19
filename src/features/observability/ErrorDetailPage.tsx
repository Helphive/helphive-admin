import { useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Box, Link, Stack, Typography } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import { TimeSeriesChart } from '@/components/charts';
import { DataTable } from '@/components/data';
import { DetailLayout } from '@/components/detail';
import { DetailSkeleton, ErrorBoundary, KeyValue, Panel, StatusPill } from '@/components/ui';
import { ApproveIcon, DisableIcon, ReplayIcon } from '@/components/ui/icons';
import { useToast } from '@/components/feedback/toastContext';
import GatedButton from '@/features/auth/GatedButton';
import { usePageCrumb } from '@/features/shell/crumbContext';
import { getErrorMessage } from '@/lib/api';
import { formatAgo, formatDateTime, formatNumber } from '@/lib/format';
import { useDocumentTitle, useNow } from '@/lib/hooks';
import { chart, color } from '@/theme/tokens';
import { useGetErrorGroupQuery, useSetErrorStatusMutation } from './api';
import {
    ERROR_STATUS_LABEL,
    ERROR_STATUS_TONE,
    PLATFORM_LABEL,
    shortRevision,
    type ErrorStatus,
    type Occurrence,
} from './model';
import { LoadError, Mono, OutLink, RequestIdLink, StackTrace } from './parts';

const ACTIONS: { to: ErrorStatus; label: string; done: string; icon: typeof ApproveIcon }[] = [
    { to: 'resolved', label: 'Resolve', done: 'Resolved', icon: ApproveIcon },
    { to: 'ignored', label: 'Ignore', done: 'Ignored', icon: DisableIcon },
    { to: 'unresolved', label: 'Reopen', done: 'Reopened', icon: ReplayIcon },
];

export default function ErrorDetailPage() {
    const { errorId = '' } = useParams();
    const now = useNow();
    const toast = useToast();
    const q = useGetErrorGroupQuery(errorId);
    const [setStatus, setting] = useSetErrorStatusMutation();
    const [selected, setSelected] = useState<string | null>(null);
    const g = q.data?.group;
    useDocumentTitle(g ? g.type : 'Error');
    usePageCrumb(g?.type);

    const occurrenceColumns = useMemo<ColumnDef<Occurrence>[]>(
        () => [
            {
                id: 'at',
                header: 'When',
                accessorFn: (o) => o.at,
                cell: ({ row }) => (
                    <Box sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(row.original.at)}</Box>
                ),
            },
            {
                id: 'route',
                header: 'Route or screen',
                accessorFn: (o) => `${o.method ?? ''} ${o.route ?? ''}`.trim(),
                cell: ({ getValue }) => <Mono>{getValue<string>() || '—'}</Mono>,
            },
            {
                id: 'who',
                header: 'Who',
                accessorFn: (o) => o.userId ?? o.adminId ?? '',
                cell: ({ row }) => <Who o={row.original} />,
            },
            {
                id: 'version',
                header: 'Version',
                accessorFn: (o) => o.appVersion ?? shortRevision(o.revision),
            },
            {
                id: 'requestId',
                header: 'Request',
                accessorFn: (o) => o.requestId ?? '',
                cell: ({ row }) => <RequestIdLink requestId={row.original.requestId} short />,
            },
        ],
        []
    );

    if (q.isLoading) return <DetailSkeleton />;
    if (q.error || !q.data || !g)
        return <LoadError error={q.error} what="this error" onRetry={q.refetch} />;
    const d = q.data;
    const current = d.occurrences.find((o) => o.id === selected) ?? d.occurrences[0];

    const change = async (to: ErrorStatus, done: string) => {
        try {
            await setStatus({ id: g.id, status: to }).unwrap();
            toast.success(`${done}: ${g.type}`);
        } catch (error) {
            toast.error(getErrorMessage(error, 'Could not change the status.'));
        }
    };

    const days = d.trend.daily.map((_, i) => {
        const day = new Date(new Date(d.trend.start).getTime() + i * 86_400_000);
        return day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    });

    return (
        <DetailLayout
            title={g.title}
            subtitle={`${g.source === 'client' ? (PLATFORM_LABEL[g.platform] ?? g.platform) : 'API'}${g.culprit ? `, raised in ${g.culprit}` : ''}`}
            status={
                <StatusPill tone={ERROR_STATUS_TONE[g.status]} size="md">
                    {ERROR_STATUS_LABEL[g.status]}
                </StatusPill>
            }
            actions={ACTIONS.filter(
                (a) => a.to !== g.status && !(g.status !== 'unresolved' && a.to !== 'unresolved')
            ).map((a) => (
                <GatedButton
                    key={a.to}
                    permission="observability.manage"
                    variant={a.to === 'resolved' ? 'contained' : 'outlined'}
                    startIcon={<a.icon />}
                    disabled={setting.isLoading}
                    onClick={() => change(a.to, a.done)}
                >
                    {a.label}
                </GatedButton>
            ))}
            tabs={[
                {
                    id: 'overview',
                    label: 'Overview',
                    content: (
                        <Stack spacing={2.5}>
                            <Panel
                                title="Events per day"
                                subtitle="Last 14 days, every event counted"
                            >
                                <ErrorBoundary>
                                    <TimeSeriesChart
                                        title="Events per day"
                                        kind="bar"
                                        x={days}
                                        series={[
                                            {
                                                name: 'Events',
                                                values: d.trend.daily,
                                                color: chart.status.rejected,
                                            },
                                        ]}
                                        height={180}
                                        xLabel="Day"
                                    />
                                </ErrorBoundary>
                            </Panel>
                            <Panel
                                title="Stack trace"
                                subtitle={
                                    current
                                        ? `Occurrence ${formatDateTime(current.at)}`
                                        : 'No sampled occurrence is kept'
                                }
                                actions={
                                    current && (
                                        <OutLink href={current.logsUrl}>
                                            Logs in Google Cloud
                                        </OutLink>
                                    )
                                }
                            >
                                {current && (
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            mb: 1.5,
                                            whiteSpace: 'pre-wrap',
                                            overflowWrap: 'anywhere',
                                        }}
                                    >
                                        {current.message || g.message}
                                    </Typography>
                                )}
                                <StackTrace stack={current?.stack} />
                            </Panel>
                        </Stack>
                    ),
                },
                {
                    id: 'occurrences',
                    label: 'Samples',
                    count: d.occurrences.length,
                    content: (
                        <DataTable<Occurrence>
                            label="Occurrences"
                            tableId="obs-occurrences"
                            data={d.occurrences}
                            columns={occurrenceColumns}
                            getRowId={(o) => o.id}
                            onRowActivate={(o) => setSelected(o.id)}
                            pagination={{ mode: 'client', pageSize: 25 }}
                            toolbar={
                                <Typography variant="body2" color="text.secondary">
                                    Sampled: the first of each minute. Open one to see its stack on
                                    the overview.
                                </Typography>
                            }
                        />
                    ),
                },
                {
                    id: 'people',
                    label: 'People',
                    count: d.users.length + d.admins.length,
                    content: (
                        <Panel
                            title="Who met this error"
                            subtitle={`${g.userCount} signed-in ${g.userCount === 1 ? 'person' : 'people'} (first 200 kept)`}
                        >
                            {d.users.length + d.admins.length ? (
                                <Box
                                    component="ul"
                                    sx={{ m: 0, pl: 2.5, columns: { sm: 2, lg: 3 } }}
                                >
                                    {d.users.map((id) => (
                                        <li key={id}>
                                            <Link component={RouterLink} to={`/users/${id}`}>
                                                <Mono>{id}</Mono>
                                            </Link>
                                        </li>
                                    ))}
                                    {d.admins.map((id) => (
                                        <li key={id}>
                                            Admin <Mono>{id}</Mono>
                                        </li>
                                    ))}
                                </Box>
                            ) : (
                                <Typography variant="body2" color="text.secondary">
                                    Nobody signed in has met it: it happened to visitors, background
                                    work or the server itself.
                                </Typography>
                            )}
                        </Panel>
                    ),
                },
                {
                    id: 'releases',
                    label: 'Releases',
                    content: (
                        <Panel title="Seen in" flush>
                            <KeyValue
                                variant="rows"
                                items={d.revisions.map((r) => ({
                                    label: r.revision ? (
                                        <Link
                                            component={RouterLink}
                                            to={`/observability/releases/${encodeURIComponent(r.revision)}`}
                                        >
                                            <Mono>{shortRevision(r.revision)}</Mono>
                                        </Link>
                                    ) : (
                                        'Unknown'
                                    ),
                                    value: `${formatDateTime(r.firstAt)} to ${formatDateTime(r.lastAt)}, ${r.sampled} sampled`,
                                }))}
                            />
                        </Panel>
                    ),
                },
            ]}
            aside={
                <Panel title="Facts">
                    <KeyValue
                        variant="rows"
                        items={[
                            { label: 'Events', value: formatNumber(g.count) },
                            { label: 'People', value: formatNumber(g.userCount) },
                            {
                                label: 'First seen',
                                value: `${formatAgo(g.firstSeenAt, now)}${g.firstRevision ? ` in ${shortRevision(g.firstRevision)}` : ''}`,
                            },
                            {
                                label: 'Last seen',
                                value: `${formatAgo(g.lastSeenAt, now)}${g.lastRevision ? ` in ${shortRevision(g.lastRevision)}` : ''}`,
                            },
                            ...(g.source === 'client'
                                ? [{ label: 'App versions', value: g.appVersions.join(', ') }]
                                : []),
                            { label: 'Route', value: g.route ? <Mono>{g.route}</Mono> : '' },
                            {
                                label: 'Status changed',
                                value: g.statusChangedAt
                                    ? `${formatAgo(g.statusChangedAt, now)}${g.statusChangedBy ? ` by ${g.statusChangedBy.email}` : ' (recurred)'}`
                                    : '',
                            },
                            ...(g.resolvedInRevision
                                ? [
                                      {
                                          label: 'Resolved in',
                                          value: <Mono>{shortRevision(g.resolvedInRevision)}</Mono>,
                                      },
                                  ]
                                : []),
                            ...(g.reopenCount
                                ? [
                                      {
                                          label: 'Reopened',
                                          value: `${g.reopenCount}×, last ${g.reopenedAt ? formatAgo(g.reopenedAt, now) : ''}`,
                                      },
                                  ]
                                : []),
                            { label: 'Fingerprint', value: <Mono muted>{g.fingerprint}</Mono> },
                        ]}
                    />
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 1.5, borderTop: `1px solid ${color.line}`, pt: 1.5 }}
                    >
                        A resolved error reopens by itself if it happens again in a newer release.
                    </Typography>
                </Panel>
            }
        />
    );
}

function Who({ o }: { o: Occurrence }) {
    if (o.userId)
        return (
            <Link
                component={RouterLink}
                to={`/users/${o.userId}`}
                onClick={(e) => e.stopPropagation()}
            >
                Person
            </Link>
        );
    if (o.adminId) return <>Admin</>;
    return <>Visitor</>;
}
