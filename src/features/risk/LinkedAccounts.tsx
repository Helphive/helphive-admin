import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Link, Skeleton, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { Chart } from '@/components/charts';
import { ErrorBoundary, ErrorState, StatusPill } from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import { color, font, hairline } from '@/theme/tokens';
import { useGetUserGraphQuery } from './api';
import { SEVERITY_FILL, recordPath, type GraphData } from './model';

const LINK_COLOR: Record<string, string> = {
    payout_destination: color.red700,
    phone: color.amber700,
    device: color.amber500,
    pairing: color.blue700,
    booking_address: color.ink600,
    ip: color.ink300,
};

/**
 * People connected to someone through shared devices, addresses, phone numbers, payout details or
 * repeated bookings: an ECharts force graph with a table alternative listing each link and why.
 */
export default function LinkedAccounts({ userId }: { userId: string }) {
    const [depth, setDepth] = useState(2);
    const [view, setView] = useState<'graph' | 'table'>('graph');
    const q = useGetUserGraphQuery({ id: userId, depth, maxNodes: 40 });

    return (
        <Box>
            <Box
                sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 1.5 }}
            >
                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={view}
                    onChange={(_e, v) => v && setView(v)}
                    aria-label="Show as"
                >
                    <ToggleButton value="graph">Graph</ToggleButton>
                    <ToggleButton value="table">Table</ToggleButton>
                </ToggleButtonGroup>
                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={depth}
                    onChange={(_e, v) => v && setDepth(v)}
                    aria-label="How far to look"
                >
                    <ToggleButton value={1}>Direct links</ToggleButton>
                    <ToggleButton value={2}>Two steps</ToggleButton>
                    <ToggleButton value={3}>Three steps</ToggleButton>
                </ToggleButtonGroup>
                {q.data?.truncated && (
                    <Box sx={{ fontSize: font.size.xs, color: color.ink500, fontWeight: 600 }}>
                        Showing the strongest links only (at most {q.data.limits.maxNodes} people).
                    </Box>
                )}
            </Box>
            {q.isFetching && !q.data ? (
                <Skeleton variant="rounded" height={360} />
            ) : q.error || !q.data ? (
                <ErrorState
                    bare
                    title="Linked accounts could not load"
                    message={getErrorMessage(q.error, 'Try again.')}
                    onRetry={q.refetch}
                />
            ) : q.data.nodes.length <= 1 ? (
                <Box sx={{ py: 3, color: color.ink500 }}>
                    No other account shares a device, network, phone, bank details or booking
                    address with this person, and none books with them repeatedly.
                </Box>
            ) : view === 'graph' ? (
                <ErrorBoundary>
                    <GraphView data={q.data} />
                </ErrorBoundary>
            ) : (
                <LinkTable data={q.data} />
            )}
        </Box>
    );
}

function GraphView({ data }: { data: GraphData }) {
    const option = useMemo(
        () => ({
            tooltip: {
                formatter: (p: { dataType: string; data: { name?: string; detail?: string } }) =>
                    p.dataType === 'edge' ? p.data.detail : p.data.name,
            },
            series: [
                {
                    type: 'graph',
                    layout: 'force',
                    roam: true,
                    draggable: true,
                    force: { repulsion: 420, edgeLength: [80, 150], gravity: 0.15 },
                    zoom: 0.9,
                    label: {
                        show: true,
                        position: 'bottom',
                        fontSize: 11,
                        fontWeight: 600,
                        color: color.ink700,
                    },
                    lineStyle: { opacity: 0.85 },
                    data: data.nodes.map((n) => ({
                        id: n.id,
                        name: `${n.name}${n.role ? ` (${n.role})` : ''}${n.score !== null ? `, score ${n.score}` : ''}${n.suspended ? ', suspended' : ''}`,
                        symbolSize: n.depth === 0 ? 34 : n.depth === 1 ? 22 : 16,
                        symbol: n.role === 'provider' ? 'roundRect' : 'circle',
                        itemStyle: {
                            color: n.band ? SEVERITY_FILL[n.band] : color.ink200,
                            borderColor:
                                n.depth === 0
                                    ? color.ink900
                                    : n.suspended
                                      ? color.red700
                                      : color.surface,
                            borderWidth: n.depth === 0 || n.suspended ? 3 : 1,
                        },
                        label: { show: true, formatter: n.name },
                    })),
                    links: data.edges.map((e) => {
                        const strongest = [...e.kinds].sort(
                            (a, b) =>
                                Object.keys(LINK_COLOR).indexOf(a.kind) -
                                Object.keys(LINK_COLOR).indexOf(b.kind)
                        )[0];
                        return {
                            source: e.source,
                            target: e.target,
                            detail: e.kinds
                                .map((k) => (k.count > 1 ? `${k.label} (${k.count})` : k.label))
                                .join(', '),
                            lineStyle: {
                                color: LINK_COLOR[strongest.kind] ?? color.ink300,
                                width: Math.min(1 + e.strength / 2, 5),
                                type: strongest.kind === 'ip' ? 'dashed' : 'solid',
                            },
                        };
                    }),
                },
            ],
        }),
        [data]
    );
    const kinds = [...new Set(data.edges.flatMap((e) => e.kinds.map((k) => k.kind)))];
    return (
        <Box>
            <Chart
                option={option}
                height={380}
                title="Linked accounts"
                summary={`${data.nodes.length - 1} accounts linked through ${data.edges.length} connections. Use the table view for the full list.`}
            />
            <Box
                sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 2,
                    mt: 1,
                    fontSize: font.size.xs,
                    color: color.ink600,
                    fontWeight: 600,
                }}
            >
                {kinds.map((k) => (
                    <Box
                        key={k}
                        component="span"
                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
                    >
                        <Box
                            component="span"
                            sx={{ width: 16, height: 3, bgcolor: LINK_COLOR[k] ?? color.ink300 }}
                        />
                        {data.edges.flatMap((e) => e.kinds).find((x) => x.kind === k)?.label}
                    </Box>
                ))}
                <Box component="span">Squares are providers; colour is the person’s risk band.</Box>
            </Box>
        </Box>
    );
}

function LinkTable({ data }: { data: GraphData }) {
    const people = new Map(data.nodes.map((n) => [n.id, n]));
    const rows = [...data.edges].sort((a, b) => b.strength - a.strength);
    const person = (id: string) => {
        const n = people.get(id);
        return (
            <Box>
                <Link component={RouterLink} to={recordPath.user(id)} sx={{ fontWeight: 700 }}>
                    {n?.name ?? id}
                </Link>
                <Box sx={{ fontSize: font.size.xs, color: color.ink500 }}>
                    {n?.role ?? ''}
                    {n?.score !== null && n?.score !== undefined ? `, score ${n.score}` : ''}
                    {n?.suspended ? ', suspended' : ''}
                </Box>
            </Box>
        );
    };
    return (
        <Box sx={{ overflowX: 'auto' }}>
            <Box
                component="table"
                aria-label="Linked accounts"
                sx={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: font.size.sm,
                    '& td, & th': {
                        px: 1.5,
                        py: 1,
                        borderTop: hairline,
                        textAlign: 'left',
                        verticalAlign: 'top',
                    },
                    '& th': { color: color.ink500, fontWeight: 700, bgcolor: color.subtle },
                }}
            >
                <thead>
                    <tr>
                        <th>Account</th>
                        <th>Linked to</th>
                        <th>Why</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((e) => (
                        <tr key={`${e.source}-${e.target}`}>
                            <td>{person(e.source)}</td>
                            <td>{person(e.target)}</td>
                            <td>
                                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                                    {e.kinds.map((k) => (
                                        <StatusPill
                                            key={k.kind}
                                            tone={
                                                k.kind === 'payout_destination' ||
                                                k.kind === 'phone'
                                                    ? 'red'
                                                    : k.kind === 'ip'
                                                      ? 'grey'
                                                      : 'amber'
                                            }
                                        >
                                            {k.count > 1 ? `${k.label} (${k.count})` : k.label}
                                        </StatusPill>
                                    ))}
                                </Box>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Box>
        </Box>
    );
}
