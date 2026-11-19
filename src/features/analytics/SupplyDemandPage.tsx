import { useMemo } from 'react';
import {
    Box,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    ToggleButton,
    ToggleButtonGroup,
} from '@mui/material';
import { ErrorBoundary, ErrorState, Panel } from '@/components/ui';
import { SelectFilter } from '@/components/data';
import { HeatmapChart } from '@/components/charts';
import { getErrorMessage } from '@/lib/api';
import { useUrlState } from '@/lib/hooks';
import { chart, color, font, radius } from '@/theme/tokens';
import { useGetSupplyDemandQuery } from './api';
import AnalyticsPage, { PanelGrid } from './AnalyticsPage';
import { EmptyRange } from './MetricPanel';
import { formatValue, SERVICE_NAMES, useAnalysis } from './model';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

const MEASURES = {
    demand: { label: 'Bookings', note: 'Bookings by booked start time.' },
    unfilled: {
        label: 'Without a provider',
        note: 'Bookings that never got a provider, by booked start.',
    },
    supply: {
        label: 'Providers going online',
        note: 'Distinct providers who switched availability on in that hour (recorded from the event-stream release on).',
    },
} as const;
type Measure = keyof typeof MEASURES;

export default function SupplyDemandPage() {
    const { args, set, state } = useAnalysis();
    const [f, setF] = useUrlState({ service: 'all', measure: 'demand' });
    const measure = (f.measure in MEASURES ? f.measure : 'demand') as Measure;
    const q = useGetSupplyDemandQuery({
        ...args,
        service: f.service === 'all' ? undefined : f.service,
    });

    const cells = useMemo(() => {
        const grid = new Map<string, number>();
        const add = (d: number, h: number, v: number) =>
            grid.set(`${d}|${h}`, (grid.get(`${d}|${h}`) ?? 0) + v);
        if (measure === 'supply') q.data?.grid.supply.forEach((c) => add(c.day, c.hour, c.supply));
        else
            q.data?.grid.demand.forEach((c) =>
                add(c.day, c.hour, measure === 'demand' ? c.demand : c.demand - c.filled)
            );
        return [...grid].map(([k, v]) => {
            const [d, h] = k.split('|').map(Number);
            return [h, d - 1, v] as [number, number, number];
        });
    }, [q.data, measure]);

    const allTime =
        state.range === 'all' ? undefined : () => set({ range: 'all', from: '', to: '' });
    const areas = useMemo(() => {
        if (!q.data) return [];
        const providers = new Map(
            q.data.areas.providers.map((p) => [`${p.latitude}|${p.longitude}`, p.providers])
        );
        const rows = q.data.areas.demand.map((a) => ({
            ...a,
            providers: providers.get(`${a.latitude}|${a.longitude}`) ?? 0,
        }));
        // Areas with providers but no demand still matter (idle supply).
        for (const p of q.data.areas.providers) {
            if (!rows.some((r) => r.latitude === p.latitude && r.longitude === p.longitude))
                rows.push({
                    latitude: p.latitude,
                    longitude: p.longitude,
                    demand: 0,
                    filled: 0,
                    value: 0,
                    providers: p.providers,
                });
        }
        return rows.sort((a, b) => b.demand - a.demand || b.providers - a.providers).slice(0, 25);
    }, [q.data]);
    const maxDemand = Math.max(1, ...areas.map((a) => a.demand));

    let grid;
    if (q.isLoading) grid = <Skeleton variant="rounded" height={300} />;
    else if (q.error || !q.data)
        grid = (
            <ErrorState
                bare
                title="Could not load supply and demand"
                message={getErrorMessage(q.error, '')}
                onRetry={q.refetch}
            />
        );
    else if (!cells.some((c) => c[2] > 0))
        grid = <EmptyRange what={MEASURES[measure].label.toLowerCase()} onAllTime={allTime} />;
    else
        grid = (
            <ErrorBoundary>
                <HeatmapChart
                    title={`${MEASURES[measure].label} by hour of the week`}
                    xLabels={HOURS}
                    yLabels={DAYS}
                    cells={cells}
                    xLabel="Hour"
                    yLabel="Day"
                    height={300}
                />
            </ErrorBoundary>
        );

    return (
        <AnalyticsPage
            title="Supply and demand"
            subtitle="When and where bookings start, against when providers are online"
            actions={
                <SelectFilter
                    label="Service"
                    value={f.service}
                    onChange={(service) => setF({ service })}
                    options={[
                        { value: 'all', label: 'All services' },
                        ...Object.entries(SERVICE_NAMES).map(([value, label]) => ({
                            value,
                            label,
                        })),
                    ]}
                    minWidth={190}
                />
            }
        >
            <PanelGrid>
                <Box className="wide">
                    <Panel
                        title="Hour of the week"
                        subtitle={MEASURES[measure].note}
                        actions={
                            <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={measure}
                                onChange={(_, v) => v && setF({ measure: v })}
                                aria-label="Measure"
                            >
                                {(Object.keys(MEASURES) as Measure[]).map((m) => (
                                    <ToggleButton key={m} value={m}>
                                        {MEASURES[m].label}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                        }
                    >
                        {grid}
                    </Panel>
                </Box>
                <Box className="wide">
                    <Panel
                        title="Areas"
                        subtitle="Bookings by location, rounded to about 11 km, against approved providers last seen there"
                        flush={areas.length > 0}
                    >
                        {q.isLoading ? (
                            <Skeleton variant="rounded" height={200} />
                        ) : !areas.length ? (
                            <EmptyRange what="bookings with a location" onAllTime={allTime} />
                        ) : (
                            <Box sx={{ overflowX: 'auto' }}>
                                <Table size="small" aria-label="Bookings and providers by area">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Area (latitude, longitude)</TableCell>
                                            <TableCell>Bookings</TableCell>
                                            <TableCell align="right">Fill rate</TableCell>
                                            <TableCell align="right">Value</TableCell>
                                            <TableCell align="right">Providers there now</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {areas.map((a) => (
                                            <TableRow key={`${a.latitude}|${a.longitude}`}>
                                                <TableCell
                                                    sx={{
                                                        whiteSpace: 'nowrap',
                                                        fontVariantNumeric: 'tabular-nums',
                                                    }}
                                                >
                                                    {a.latitude.toFixed(1)},{' '}
                                                    {a.longitude.toFixed(1)}
                                                </TableCell>
                                                <TableCell sx={{ minWidth: 160 }}>
                                                    <Box
                                                        sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 1,
                                                        }}
                                                    >
                                                        <Box
                                                            aria-hidden="true"
                                                            sx={{
                                                                height: 10,
                                                                width: `${(a.demand / maxDemand) * 100}px`,
                                                                bgcolor: chart.categorical[0],
                                                                borderRadius: `${radius.sm}px`,
                                                            }}
                                                        />
                                                        <Box
                                                            component="span"
                                                            sx={{
                                                                fontWeight: 700,
                                                                fontSize: font.size.sm,
                                                            }}
                                                        >
                                                            {a.demand}
                                                        </Box>
                                                    </Box>
                                                </TableCell>
                                                <TableCell align="right">
                                                    {a.demand
                                                        ? `${Math.round((a.filled / a.demand) * 100)}%`
                                                        : '—'}
                                                </TableCell>
                                                <TableCell align="right">
                                                    {formatValue(a.value, 'money', true)}
                                                </TableCell>
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        color: a.providers
                                                            ? color.ink900
                                                            : color.red700,
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {a.providers}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Box>
                        )}
                    </Panel>
                </Box>
            </PanelGrid>
        </AnalyticsPage>
    );
}
