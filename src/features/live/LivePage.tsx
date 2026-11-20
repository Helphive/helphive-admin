import { Suspense, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Link, Skeleton, Typography } from '@mui/material';
import { ErrorBoundary, ErrorState, PageHeader, Panel, StatusPill } from '@/components/ui';
import { FilterBar, SelectFilter } from '@/components/data';
import { LiveIcon, RefreshIcon } from '@/components/ui/icons';
import { LazyAreaMap, type MapArea } from '@/components/map';
import { useSession } from '@/features/auth/useSession';
import { useGetLiveQuery, type LiveBooking, type LiveProvider } from '@/features/ops/api';
import { DISPLAY_STATUS, SERVICE_OPTIONS, metaFor } from '@/features/ops/model';
import { MetaPill, RecordLink, Ref } from '@/features/ops/parts';
import { getErrorMessage } from '@/lib/api';
import { formatAgo, formatDateTime } from '@/lib/format';
import { useDocumentTitle, useNow, useUrlState } from '@/lib/hooks';
import { color, font, hairline, hoverItem } from '@/theme/tokens';

const POLL_MS = 30_000;

/** The demo admin's positions are rounded again to 0.1° (about 11 km), whatever precisionKm says. */
const DEMO_RADIUS_KM = 11;

function cellKey(lat: number, lng: number) {
    return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

interface Cell {
    id: string;
    latitude: number;
    longitude: number;
    precisionKm: number;
    providers: LiveProvider[];
    bookings: LiveBooking[];
}

function ListRow({
    selected,
    onSelect,
    children,
    located,
}: {
    selected: boolean;
    onSelect: () => void;
    children: React.ReactNode;
    located: boolean;
}) {
    return (
        <Box
            component="li"
            sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'flex-start',
                px: 2,
                py: 1.25,
                borderTop: hairline,
                ...(selected ? hoverItem : { bgcolor: 'transparent' }),
                boxShadow: selected ? `inset 3px 0 0 ${color.ink900}` : 'none',
            }}
        >
            <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
            {located ? (
                <Button
                    size="small"
                    onClick={onSelect}
                    sx={{ minHeight: 28, px: 1, flexShrink: 0 }}
                >
                    Show
                </Button>
            ) : (
                <Box
                    component="span"
                    sx={{ fontSize: font.size.xs, color: color.ink500, fontWeight: 600, pt: 0.5 }}
                >
                    No position
                </Box>
            )}
        </Box>
    );
}

export default function LivePage() {
    useDocumentTitle('Live');
    const now = useNow(15_000);
    const { demo } = useSession();
    const [f, setF] = useUrlState({ service: 'all', hours: '4', show: 'all' });
    const hours = Math.min(24, Math.max(1, Number(f.hours) || 4));
    const res = useGetLiveQuery(hours, { pollingInterval: POLL_MS, skipPollingIfUnfocused: true });
    const [focus, setFocus] = useState<string | null>(null);
    const data = res.data;

    const serviceId = f.service === 'all' ? null : Number(f.service);
    const providers = useMemo(
        () =>
            f.show === 'bookings'
                ? []
                : (data?.providers ?? []).filter(
                      (p) => serviceId === null || p.services.some((s) => s.id === serviceId)
                  ),
        [data, serviceId, f.show]
    );
    const bookings = useMemo(
        () =>
            f.show === 'providers'
                ? []
                : (data?.bookings ?? [])
                      .filter((b) => serviceId === null || b.service?.id === serviceId)
                      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
        [data, serviceId, f.show]
    );

    // One area per grid cell: positions are snapped to a fixed grid, so several records share one.
    const cells = useMemo(() => {
        const map = new Map<string, Cell>();
        const add = (loc: LiveProvider['approximateLocation'], fn: (c: Cell) => void) => {
            if (!loc) return;
            const id = cellKey(loc.latitude, loc.longitude);
            const c =
                map.get(id) ??
                ({
                    id,
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    precisionKm: loc.precisionKm,
                    providers: [],
                    bookings: [],
                } as Cell);
            fn(c);
            map.set(id, c);
        };
        providers.forEach((p) => add(p.approximateLocation, (c) => c.providers.push(p)));
        bookings.forEach((b) => add(b.approximateLocation, (c) => c.bookings.push(b)));
        return [...map.values()];
    }, [providers, bookings]);

    const areas: MapArea[] = cells.map((c) => {
        const inProgress = c.bookings.filter((b) => b.status === 'in progress').length;
        const label = [
            c.providers.length ? `${c.providers.length} online` : '',
            c.bookings.length
                ? `${c.bookings.length} ${c.bookings.length === 1 ? 'booking' : 'bookings'}`
                : '',
        ]
            .filter(Boolean)
            .join(', ');
        return {
            id: c.id,
            latitude: c.latitude,
            longitude: c.longitude,
            radiusKm: demo ? DEMO_RADIUS_KM : Math.max(c.precisionKm, 0.5),
            tone: inProgress ? 'coral' : c.bookings.length ? 'amber' : 'blue',
            label,
            popup: (
                <Box>
                    <Box sx={{ fontWeight: 700, mb: 0.5 }}>
                        Within about {demo ? DEMO_RADIUS_KM : c.precisionKm.toFixed(1)} km
                    </Box>
                    {c.providers.map((p) => (
                        <Box key={p._id}>
                            <RecordLink type="user" id={p._id}>
                                {p.firstName} {p.lastName}
                            </RecordLink>{' '}
                            online
                        </Box>
                    ))}
                    {c.bookings.map((b) => (
                        <Box key={b._id}>
                            <RecordLink type="booking" id={b._id}>
                                {b.reference}
                            </RecordLink>{' '}
                            {metaFor(DISPLAY_STATUS, b.displayStatus).label.toLowerCase()}
                        </Box>
                    ))}
                </Box>
            ),
        };
    });

    const cellOf = (loc: LiveProvider['approximateLocation']) =>
        loc ? cellKey(loc.latitude, loc.longitude) : null;
    const unlocated =
        providers.filter((p) => !p.approximateLocation).length +
        bookings.filter((b) => !b.approximateLocation).length;

    if (res.error && !data) {
        return (
            <>
                <PageHeader title="Live" />
                <ErrorState
                    title="Could not load the live view"
                    message={getErrorMessage(res.error, 'The API did not answer.')}
                    onRetry={res.refetch}
                    retrying={res.isFetching}
                />
            </>
        );
    }

    return (
        <>
            <PageHeader
                title="Live"
                subtitle="Providers online now, and bookings in progress or starting soon. Areas are approximate on purpose."
                actions={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography variant="body2" color="text.secondary" aria-live="polite">
                            {data
                                ? `Updated ${formatAgo(data.generatedAt, now)}, every 30 s`
                                : 'Loading'}
                        </Typography>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => void res.refetch()}
                            disabled={res.isFetching}
                            startIcon={
                                res.isFetching ? <CircularProgress size={14} /> : <RefreshIcon />
                            }
                        >
                            Refresh
                        </Button>
                    </Box>
                }
            />
            <Box sx={{ mb: 2 }}>
                <FilterBar
                    summary={
                        data
                            ? `${providers.length} online, ${bookings.length} ${bookings.length === 1 ? 'booking' : 'bookings'}`
                            : undefined
                    }
                >
                    <SelectFilter
                        label="Service"
                        value={f.service}
                        onChange={(service) => setF({ service })}
                        options={SERVICE_OPTIONS}
                        minWidth={190}
                    />
                    <SelectFilter
                        label="Show"
                        value={f.show}
                        onChange={(show) => setF({ show })}
                        options={[
                            { value: 'all', label: 'Providers and bookings' },
                            { value: 'providers', label: 'Providers online' },
                            { value: 'bookings', label: 'Bookings' },
                        ]}
                        minWidth={200}
                    />
                    <SelectFilter
                        label="Starting within"
                        value={String(hours)}
                        onChange={(h) => setF({ hours: h })}
                        options={[1, 2, 4, 8, 12, 24].map((h) => ({
                            value: String(h),
                            label: `${h} h`,
                        }))}
                        minWidth={170}
                    />
                </FilterBar>
            </Box>
            <Box
                sx={{
                    display: 'grid',
                    gap: 2.5,
                    gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 380px' },
                    alignItems: 'start',
                }}
            >
                <Panel flush sx={{ p: 0.75 }}>
                    <ErrorBoundary>
                        <Suspense fallback={<Skeleton variant="rounded" height={520} />}>
                            <LazyAreaMap
                                areas={areas}
                                focusId={focus}
                                onSelect={setFocus}
                                label="Map of providers online and bookings, by approximate area"
                                height={{ xs: 360, md: 560 }}
                            />
                        </Suspense>
                    </ErrorBoundary>
                    <Box
                        sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 2,
                            px: 1.25,
                            pt: 1,
                            pb: 0.5,
                            fontSize: font.size.xs,
                            fontWeight: 600,
                            color: color.ink600,
                            '& span': { display: 'inline-flex', alignItems: 'center', gap: 0.75 },
                            '& i': {
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                display: 'inline-block',
                                opacity: 0.7,
                            },
                        }}
                    >
                        <span>
                            <i style={{ background: color.blue700 }} /> Providers online
                        </span>
                        <span>
                            <i style={{ background: color.amber700 }} /> Bookings starting within{' '}
                            {hours} h
                        </span>
                        <span>
                            <i style={{ background: color.coral600 }} /> In progress
                        </span>
                        <Box component="span" sx={{ ml: { sm: 'auto' }, color: color.ink500 }}>
                            {demo
                                ? 'Demo: positions rounded to about 11 km.'
                                : (data?.precision ?? 'Locations are rounded to about 1 km.')}
                        </Box>
                    </Box>
                </Panel>
                <Box sx={{ display: 'grid', gap: 2.5 }}>
                    {unlocated > 0 && (
                        <Alert severity="info">
                            {unlocated} {unlocated === 1 ? 'record has' : 'records have'} no
                            position yet (the app had no location fix) and{' '}
                            {unlocated === 1 ? 'is' : 'are'} only in the lists.
                        </Alert>
                    )}
                    <Panel
                        title="Bookings"
                        subtitle={`In progress, or starting within ${hours} h`}
                        flush
                        actions={<Count n={bookings.length} />}
                    >
                        {res.isLoading ? (
                            <Box sx={{ p: 2 }}>
                                <Skeleton height={36} />
                                <Skeleton height={36} />
                            </Box>
                        ) : bookings.length ? (
                            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, mt: '-1px' }}>
                                {bookings.map((b) => (
                                    <ListRow
                                        key={b._id}
                                        selected={
                                            focus !== null &&
                                            focus === cellOf(b.approximateLocation)
                                        }
                                        onSelect={() => setFocus(cellOf(b.approximateLocation))}
                                        located={Boolean(b.approximateLocation)}
                                    >
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                gap: 1,
                                                alignItems: 'center',
                                                flexWrap: 'wrap',
                                            }}
                                        >
                                            <RecordLink type="booking" id={b._id}>
                                                <Ref>{b.reference}</Ref>
                                            </RecordLink>
                                            <MetaPill
                                                map={DISPLAY_STATUS}
                                                value={b.displayStatus}
                                            />
                                        </Box>
                                        <Box
                                            sx={{
                                                fontSize: font.size.sm,
                                                color: color.ink600,
                                                mt: 0.25,
                                            }}
                                        >
                                            {b.service?.name}, {formatDateTime(b.startDate)},{' '}
                                            {b.hours} h
                                        </Box>
                                        <Box
                                            sx={{
                                                fontSize: font.size.xs,
                                                color: color.ink500,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {b.customer ? (
                                                <RecordLink type="user" id={b.customer._id}>
                                                    {b.customer.name}
                                                </RecordLink>
                                            ) : (
                                                'Customer unknown'
                                            )}
                                            {' for '}
                                            {b.provider ? (
                                                <RecordLink type="user" id={b.provider._id}>
                                                    {b.provider.name}
                                                </RecordLink>
                                            ) : (
                                                'no provider yet'
                                            )}
                                        </Box>
                                    </ListRow>
                                ))}
                            </Box>
                        ) : (
                            <Empty text={`Nothing in progress or starting within ${hours} h.`} />
                        )}
                    </Panel>
                    <Panel title="Providers online" flush actions={<Count n={providers.length} />}>
                        {res.isLoading ? (
                            <Box sx={{ p: 2 }}>
                                <Skeleton height={36} />
                            </Box>
                        ) : providers.length ? (
                            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, mt: '-1px' }}>
                                {providers.map((p) => (
                                    <ListRow
                                        key={p._id}
                                        selected={
                                            focus !== null &&
                                            focus === cellOf(p.approximateLocation)
                                        }
                                        onSelect={() => setFocus(cellOf(p.approximateLocation))}
                                        located={Boolean(p.approximateLocation)}
                                    >
                                        <RecordLink type="user" id={p._id}>
                                            {p.firstName} {p.lastName}
                                        </RecordLink>
                                        <Box sx={{ fontSize: font.size.sm, color: color.ink600 }}>
                                            {p.services.map((s) => s.name).join(', ') ||
                                                'No services chosen'}
                                        </Box>
                                        <Box
                                            sx={{
                                                fontSize: font.size.xs,
                                                color: color.ink500,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {p.locationUpdatedAt
                                                ? `Position sent ${formatAgo(p.locationUpdatedAt, now)}`
                                                : 'Position time not recorded'}
                                        </Box>
                                    </ListRow>
                                ))}
                            </Box>
                        ) : (
                            <Empty
                                text={
                                    serviceId
                                        ? 'No provider offering this service is online.'
                                        : 'No provider is online. Providers go online from the app.'
                                }
                            />
                        )}
                    </Panel>
                    <Typography variant="caption" component="p" sx={{ color: color.ink500 }}>
                        Need someone who is not here? Search{' '}
                        <Link component={RouterLink} to="/users?role=provider&available=true">
                            available providers
                        </Link>{' '}
                        or the{' '}
                        <Link component={RouterLink} to="/bookings?displayStatus=scheduled">
                            bookings still finding a provider
                        </Link>
                        .
                    </Typography>
                </Box>
            </Box>
        </>
    );
}

function Count({ n }: { n: number }) {
    return <StatusPill tone={n ? 'blue' : 'grey'}>{n}</StatusPill>;
}

function Empty({ text }: { text: string }) {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 2.5,
                color: color.ink500,
                fontSize: font.size.sm,
                fontWeight: 600,
                '& svg': { color: color.ink300 },
            }}
        >
            <LiveIcon />
            {text}
        </Box>
    );
}
