import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Alert as MuiAlert,
    Box,
    Button,
    Collapse,
    Link,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { FilterBar, SearchField, SelectFilter } from '@/components/data';
import { JsonView } from '@/components/detail';
import { EmptyState, PageHeader, Panel, StatusPill, TableSkeleton } from '@/components/ui';
import { ChevronDownIcon, ChevronRightIcon, LogsIcon } from '@/components/ui/icons';
import { useDocumentTitle, useUrlState } from '@/lib/hooks';
import { color, font, hairline, hoverRow } from '@/theme/tokens';
import { useQueryLogsQuery } from './api';
import { SEVERITY_TONE, formatMs, isObjectId, mono, shortRevision, type LogEntry } from './model';
import { LoadError, Mono, OutLink, StackTrace } from './parts';

const RANGES: Record<string, number> = {
    '15m': 15,
    '1h': 60,
    '6h': 360,
    '24h': 1440,
    '7d': 10_080,
};
const DEFAULTS = { range: '1h', severity: 'all', requestId: '', route: '', userId: '', text: '' };

function Entry({ e, onRequest }: { e: LogEntry; onRequest: (id: string) => void }) {
    const [open, setOpen] = useState(false);
    const time = e.timestamp ? new Date(e.timestamp) : null;
    return (
        <Box component="li" sx={{ borderTop: hairline, '&:first-of-type': { borderTop: 0 } }}>
            <Box
                component="button"
                type="button"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
                sx={{
                    all: 'unset',
                    boxSizing: 'border-box',
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '16px 1fr',
                        md: '16px 92px 84px minmax(0, 1fr) auto',
                    },
                    columnGap: 1.5,
                    rowGap: 0.25,
                    alignItems: 'center',
                    px: 2,
                    py: 1,
                    cursor: 'pointer',
                    '&:hover': hoverRow,
                    '&:focus-visible': {
                        outline: `2px solid ${color.coral600}`,
                        outlineOffset: -2,
                    },
                }}
            >
                {open ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
                <Box
                    sx={{
                        fontFamily: mono,
                        fontSize: font.size.xs,
                        color: color.ink600,
                        fontVariantNumeric: 'tabular-nums',
                    }}
                >
                    {time
                        ? time.toLocaleTimeString('en-GB', { hour12: false }) +
                          '.' +
                          String(time.getMilliseconds()).padStart(3, '0')
                        : '—'}
                </Box>
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                    <StatusPill tone={SEVERITY_TONE[e.severity] ?? 'grey'}>{e.severity}</StatusPill>
                </Box>
                <Box
                    sx={{
                        gridColumn: { xs: '2', md: 'auto' },
                        fontSize: font.size.sm,
                        color: color.ink900,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {e.message}
                </Box>
                <Box
                    sx={{
                        display: { xs: 'none', md: 'block' },
                        fontFamily: mono,
                        fontSize: font.size.xs,
                        color: color.ink500,
                    }}
                >
                    {e.route ?? ''}
                </Box>
            </Box>
            <Collapse in={open} unmountOnExit>
                <Box sx={{ px: { xs: 2, md: 5 }, pb: 2, pt: 0.5 }}>
                    <Stack
                        direction="row"
                        spacing={1.5}
                        useFlexGap
                        sx={{ flexWrap: 'wrap', mb: 1.5, alignItems: 'center' }}
                    >
                        {e.requestId && (
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() => onRequest(e.requestId!)}
                            >
                                Show all entries for this request
                            </Button>
                        )}
                        <OutLink href={e.traceUrl}>Trace</OutLink>
                    </Stack>
                    <Box
                        component="dl"
                        sx={{
                            m: 0,
                            display: 'grid',
                            gridTemplateColumns: 'max-content 1fr',
                            columnGap: 2,
                            rowGap: 0.5,
                            fontSize: font.size.sm,
                            '& dt': { color: color.ink500, fontWeight: 600 },
                            '& dd': { m: 0, minWidth: 0, overflowWrap: 'anywhere' },
                        }}
                    >
                        <dt>Time</dt>
                        <dd>{e.timestamp ?? '—'}</dd>
                        <dt>Request</dt>
                        <dd>{e.requestId ? <Mono>{e.requestId}</Mono> : '—'}</dd>
                        {e.http && (
                            <>
                                <dt>HTTP</dt>
                                <dd>
                                    <Mono>{`${e.http.method} ${e.http.url} ${e.http.status ?? ''}`}</Mono>{' '}
                                    in {formatMs(e.http.latencyMs)}
                                </dd>
                            </>
                        )}
                        <dt>Signed in</dt>
                        <dd>
                            {e.userId ? (
                                <Link component={RouterLink} to={`/users/${e.userId}`}>
                                    User <Mono>{e.userId}</Mono>
                                </Link>
                            ) : e.adminId ? (
                                <>
                                    Admin <Mono>{e.adminId}</Mono>
                                </>
                            ) : (
                                'Nobody'
                            )}
                        </dd>
                        <dt>Client</dt>
                        <dd>{[e.appPlatform, e.appVersion].filter(Boolean).join(' ') || '—'}</dd>
                        <dt>Revision</dt>
                        <dd>{shortRevision(e.revision)}</dd>
                    </Box>
                    {e.error && (
                        <Box sx={{ mt: 1.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.75 }}>
                                {e.error.name}: {e.error.message}
                            </Typography>
                            <StackTrace stack={e.error.stack} />
                        </Box>
                    )}
                    {e.details != null && (
                        <Box sx={{ mt: 1.5 }}>
                            <JsonView value={e.details} label="Details" />
                        </Box>
                    )}
                </Box>
            </Collapse>
        </Box>
    );
}

export default function LogsPage() {
    useDocumentTitle('Logs');
    const [f, setF, resetF] = useUrlState(DEFAULTS);
    const [pageToken, setPageToken] = useState<string | undefined>();
    const [until] = useState(() => new Date());
    const span = useMemo(() => {
        const minutes = RANGES[f.range] ?? 60;
        return {
            from: new Date(until.getTime() - minutes * 60_000).toISOString(),
            to: until.toISOString(),
        };
    }, [f.range, until]);
    const userIdValid = !f.userId || isObjectId(f.userId);
    const q = useQueryLogsQuery({
        ...span,
        severity: f.severity,
        requestId: f.requestId,
        route: f.route,
        userId: userIdValid ? f.userId : undefined,
        text: f.text,
        pageSize: 100,
        pageToken,
    });
    const set = (patch: Partial<typeof DEFAULTS>) => {
        setPageToken(undefined);
        setF(patch);
    };
    const active =
        Number(f.severity !== 'all') +
        Number(!!f.requestId) +
        Number(!!f.route) +
        Number(!!f.userId) +
        Number(!!f.text);
    const data = q.data;

    return (
        <>
            <PageHeader
                title="Logs"
                subtitle="The API's log in Google Cloud, newest first. Open an entry to see everything it recorded."
                actions={<OutLink href={data?.consoleUrl}>Open this query in Google Cloud</OutLink>}
            />
            <Panel flush>
                <Box sx={{ p: 2, borderBottom: hairline }}>
                    <FilterBar
                        activeCount={active}
                        onClear={() => {
                            setPageToken(undefined);
                            resetF();
                        }}
                    >
                        <SelectFilter
                            label="Range"
                            value={f.range}
                            onChange={(range) => set({ range })}
                            options={[
                                { value: '15m', label: 'Last 15 minutes' },
                                { value: '1h', label: 'Last hour' },
                                { value: '6h', label: 'Last 6 hours' },
                                { value: '24h', label: 'Last 24 hours' },
                                { value: '7d', label: 'Last 7 days' },
                            ]}
                            minWidth={190}
                        />
                        <SelectFilter
                            label="Severity"
                            value={f.severity}
                            onChange={(severity) => set({ severity })}
                            options={[
                                { value: 'all', label: 'Any' },
                                { value: 'INFO', label: 'Info and up' },
                                { value: 'WARNING', label: 'Warnings and up' },
                                { value: 'ERROR', label: 'Errors and up' },
                            ]}
                        />
                        <SearchField
                            value={f.text}
                            onChange={(text) => set({ text })}
                            placeholder="Search text"
                            label="Search log text"
                        />
                        <TextField
                            size="small"
                            placeholder="Request id"
                            inputProps={{ 'aria-label': 'Request id' }}
                            value={f.requestId}
                            onChange={(e) => set({ requestId: e.target.value.trim() })}
                            sx={{ width: { xs: '100%', sm: 300 } }}
                        />
                        <TextField
                            size="small"
                            placeholder="Route, e.g. /admin/users/:id"
                            inputProps={{ 'aria-label': 'Route' }}
                            value={f.route}
                            onChange={(e) => set({ route: e.target.value.trim() })}
                            sx={{ width: { xs: '100%', sm: 230 } }}
                        />
                        <TextField
                            size="small"
                            placeholder="User or admin id"
                            inputProps={{ 'aria-label': 'User or admin id' }}
                            value={f.userId}
                            error={!userIdValid}
                            title={userIdValid ? undefined : 'A 24-character id'}
                            onChange={(e) => set({ userId: e.target.value.trim() })}
                            sx={{ width: { xs: '100%', sm: 230 } }}
                        />
                    </FilterBar>
                </Box>
                {q.isFetching && !data ? (
                    <Box sx={{ p: 2 }}>
                        <TableSkeleton rows={8} label="Loading logs" />
                    </Box>
                ) : q.error ? (
                    <Box sx={{ p: 2 }}>
                        <LoadError error={q.error} what="logs" onRetry={q.refetch} />
                    </Box>
                ) : data && data.status !== 'ok' ? (
                    <Box sx={{ p: 2.5 }}>
                        <MuiAlert severity={data.status === 'unavailable' ? 'warning' : 'info'}>
                            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>
                                {data.status === 'not_permitted'
                                    ? 'The API may not read its logs yet'
                                    : data.status === 'not_configured'
                                      ? 'Logs can only be read on Cloud Run'
                                      : 'Cloud Logging did not answer'}
                            </Typography>
                            <Typography variant="body2">{data.message}</Typography>
                            <Box sx={{ mt: 1 }}>
                                <OutLink href={data.consoleUrl}>
                                    Run the same query in Google Cloud
                                </OutLink>
                            </Box>
                        </MuiAlert>
                    </Box>
                ) : data && data.entries.length ? (
                    <>
                        <Box
                            component="ol"
                            aria-label="Log entries"
                            sx={{ m: 0, p: 0, listStyle: 'none', opacity: q.isFetching ? 0.6 : 1 }}
                        >
                            {data.entries.map((e) => (
                                <Entry
                                    key={e.id}
                                    e={e}
                                    onRequest={(requestId) =>
                                        set({
                                            requestId,
                                            range: '24h',
                                            text: '',
                                            route: '',
                                            userId: '',
                                            severity: 'all',
                                        })
                                    }
                                />
                            ))}
                        </Box>
                        <Stack
                            direction="row"
                            spacing={1}
                            sx={{
                                p: 2,
                                borderTop: hairline,
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                {data.entries.length} entries{pageToken ? ' (older page)' : ''}
                            </Typography>
                            <Stack direction="row" spacing={1}>
                                {pageToken && (
                                    <Button onClick={() => setPageToken(undefined)}>Newest</Button>
                                )}
                                <Button
                                    variant="outlined"
                                    disabled={!data.nextPageToken}
                                    onClick={() => setPageToken(data.nextPageToken ?? undefined)}
                                >
                                    Older entries
                                </Button>
                            </Stack>
                        </Stack>
                    </>
                ) : (
                    <EmptyState
                        bare
                        icon={<LogsIcon />}
                        title="No log entries match"
                        description="Widen the range or clear a filter. The API keeps 30 days of logs in Google Cloud."
                    />
                )}
            </Panel>
        </>
    );
}
