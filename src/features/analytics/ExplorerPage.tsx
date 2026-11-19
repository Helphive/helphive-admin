import { useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    IconButton,
    Link,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
} from '@mui/material';
import { ConfirmDialog, EmptyState, ErrorBoundary, ErrorState, Panel } from '@/components/ui';
import { SelectFilter } from '@/components/data';
import { TimeSeriesChart } from '@/components/charts';
import { CloseIcon, ExportCsvIcon, SavedViewIcon } from '@/components/ui/icons';
import { useToast } from '@/components/feedback/toastContext';
import GatedButton from '@/features/auth/GatedButton';
import { useSession } from '@/features/auth/useSession';
import { getErrorMessage } from '@/lib/api';
import { downloadText } from '@/lib/csv';
import { useUrlState } from '@/lib/hooks';
import { formatDate } from '@/lib/format';
import { chart, color, font, hairline } from '@/theme/tokens';
import {
    useCreateViewMutation,
    useDeleteViewMutation,
    useExportSeriesCsvMutation,
    useGetCatalogueQuery,
    useGetSeriesQuery,
    useListViewsQuery,
    useUpdateViewMutation,
    type SavedView,
    type SeriesResult,
} from './api';
import AnalyticsPage, { PanelGrid } from './AnalyticsPage';
import { EmptyRange } from './MetricPanel';
import {
    ANALYSIS_DEFAULTS,
    BREAKDOWN_LABELS,
    bucketLabel,
    drillHref,
    formatValue,
    chartScale,
    gaps,
    rangeText,
    seriesLabel,
    useAnalysis,
} from './model';

const EXPLORER_DEFAULTS = { metric: 'bookings_created', breakdown: '', stat: 'p50', chart: 'line' };
const GROUP_LABELS: Record<string, string> = {
    bookings: 'Bookings',
    revenue: 'Revenue',
    health: 'Health',
    customers: 'Customers',
    providers: 'Providers',
    platform: 'Platform',
};

function ResultTable({ data }: { data: SeriesResult }) {
    const unit = data.metric.unit;
    const columns = data.series.length
        ? data.series.map((s) => ({ name: seriesLabel(s.label), values: s.values }))
        : [{ name: data.metric.label, values: data.values }];
    return (
        <Box sx={{ overflowX: 'auto', maxHeight: 420 }}>
            <Table size="small" stickyHeader aria-label={`${data.metric.label} by period`}>
                <TableHead>
                    <TableRow>
                        <TableCell>Period</TableCell>
                        {columns.map((c) => (
                            <TableCell key={c.name} align="right">
                                {c.name}
                            </TableCell>
                        ))}
                        {data.previous && <TableCell align="right">Previous period</TableCell>}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {data.buckets.map((b, i) => (
                        <TableRow key={b}>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                {bucketLabel(b, data.range.interval)}
                            </TableCell>
                            {columns.map((c) => (
                                <TableCell key={c.name} align="right">
                                    {formatValue(c.values[i], unit)}
                                </TableCell>
                            ))}
                            {data.previous && (
                                <TableCell align="right" sx={{ color: color.ink500 }}>
                                    {formatValue(data.previous.values[i], unit)}
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                    <TableRow sx={{ '& td': { fontWeight: 800, borderTop: hairline } }}>
                        <TableCell>Whole period</TableCell>
                        {data.series.length ? (
                            data.series.map((s) => (
                                <TableCell key={s.key} align="right">
                                    {formatValue(s.total, unit)}
                                </TableCell>
                            ))
                        ) : (
                            <TableCell align="right">{formatValue(data.total, unit)}</TableCell>
                        )}
                        {data.previous && (
                            <TableCell align="right">
                                {formatValue(data.previous.total, unit)}
                            </TableCell>
                        )}
                    </TableRow>
                </TableBody>
            </Table>
        </Box>
    );
}

function SaveDialog({
    open,
    onClose,
    onSave,
    saving,
    error,
}: {
    open: boolean;
    onClose: () => void;
    onSave: (name: string, shared: boolean) => void;
    saving: boolean;
    error: string | null;
}) {
    const [name, setName] = useState('');
    const [shared, setShared] = useState(false);
    return (
        <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
            <Box
                component="form"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (name.trim()) onSave(name.trim(), shared);
                }}
            >
                <DialogTitle>Save this view</DialogTitle>
                <DialogContent sx={{ display: 'grid', gap: 1.5 }}>
                    <TextField
                        label="Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        inputProps={{ maxLength: 80 }}
                        autoFocus
                        required
                        helperText="For example: Weekly paid value by service"
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={shared}
                                onChange={(e) => setShared(e.target.checked)}
                            />
                        }
                        label="Share with every admin"
                    />
                    {error && (
                        <Box role="alert" sx={{ color: color.red700, fontSize: font.size.sm }}>
                            {error}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="contained" disabled={saving || !name.trim()}>
                        Save view
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
}

function SavedViews({ onOpen }: { onOpen: (v: SavedView) => void }) {
    const toast = useToast();
    const { demo } = useSession();
    const views = useListViewsQuery();
    const [update] = useUpdateViewMutation();
    const [remove, removing] = useDeleteViewMutation();
    const [deleting, setDeleting] = useState<SavedView | null>(null);
    const [renaming, setRenaming] = useState<SavedView | null>(null);
    const [newName, setNewName] = useState('');

    const act = async (fn: () => Promise<unknown>, done: string) => {
        try {
            await fn();
            toast.success(done);
        } catch (error) {
            toast.error(getErrorMessage(error, 'That did not work. Try again.'));
        }
    };

    let body;
    if (views.isLoading) body = <Skeleton variant="rounded" height={120} />;
    else if (views.error)
        body = (
            <ErrorState
                bare
                title="Could not load saved views"
                message={getErrorMessage(views.error, '')}
                onRetry={views.refetch}
            />
        );
    else if (!views.data?.length)
        body = (
            <EmptyState
                bare
                icon={<SavedViewIcon />}
                title="No saved views yet"
                description={
                    demo
                        ? 'Saving views is turned off in the demo.'
                        : 'Choose a metric above and save it to come back with one click.'
                }
                sx={{ py: 3 }}
            />
        );
    else
        body = (
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {views.data.map((v) => (
                    <Box
                        component="li"
                        key={v._id}
                        sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: 1,
                            px: { xs: 2, sm: 2.5 },
                            py: 1.25,
                            borderBottom: hairline,
                            '&:last-of-type': { borderBottom: 0 },
                        }}
                    >
                        <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
                            <Link
                                component="button"
                                onClick={() => onOpen(v)}
                                sx={{ fontWeight: 700, textAlign: 'left' }}
                            >
                                {v.name}
                            </Link>
                            <Box sx={{ fontSize: font.size.xs, color: color.ink500 }}>
                                {v.shared ? 'Shared' : 'Only you'}
                                {!v.mine && `, saved by ${v.ownerEmail}`}, updated{' '}
                                {formatDate(v.updatedAt)}
                            </Box>
                        </Box>
                        {v.mine && (
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                <GatedButton
                                    permission="analytics.read"
                                    size="small"
                                    onClick={() => {
                                        setRenaming(v);
                                        setNewName(v.name);
                                    }}
                                >
                                    Rename
                                </GatedButton>
                                <GatedButton
                                    permission="analytics.read"
                                    size="small"
                                    onClick={() =>
                                        act(
                                            () => update({ id: v._id, shared: !v.shared }).unwrap(),
                                            v.shared
                                                ? `Stopped sharing ${v.name}`
                                                : `Shared ${v.name}`
                                        )
                                    }
                                >
                                    {v.shared ? 'Stop sharing' : 'Share'}
                                </GatedButton>
                                <GatedButton
                                    permission="analytics.read"
                                    size="small"
                                    color="error"
                                    onClick={() => setDeleting(v)}
                                >
                                    Delete
                                </GatedButton>
                            </Box>
                        )}
                    </Box>
                ))}
            </Box>
        );

    return (
        <Panel
            title="Saved views"
            subtitle="Yours and the ones other admins shared"
            flush={!!views.data?.length}
        >
            {body}
            <ConfirmDialog
                open={!!deleting}
                title={`Delete ${deleting?.name ?? 'this view'}?`}
                description={
                    deleting?.shared
                        ? 'It disappears for every admin it was shared with.'
                        : 'It disappears from your saved views.'
                }
                confirmLabel="Delete view"
                confirmColor="error"
                loading={removing.isLoading}
                onClose={() => setDeleting(null)}
                onConfirm={async () => {
                    const v = deleting!;
                    await act(() => remove(v._id).unwrap(), `Deleted ${v.name}`);
                    setDeleting(null);
                }}
            />
            <Dialog open={!!renaming} onClose={() => setRenaming(null)} fullWidth maxWidth="xs">
                <Box
                    component="form"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        const v = renaming!;
                        await act(
                            () => update({ id: v._id, name: newName.trim() }).unwrap(),
                            `Renamed to ${newName.trim()}`
                        );
                        setRenaming(null);
                    }}
                >
                    <DialogTitle
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        Rename view
                        <IconButton aria-label="Close" onClick={() => setRenaming(null)}>
                            <CloseIcon />
                        </IconButton>
                    </DialogTitle>
                    <DialogContent>
                        <TextField
                            label="Name"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            inputProps={{ maxLength: 80 }}
                            fullWidth
                            autoFocus
                            sx={{ mt: 1 }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button type="submit" variant="contained" disabled={!newName.trim()}>
                            Rename view
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Panel>
    );
}

export default function ExplorerPage() {
    const navigate = useNavigate();
    const toast = useToast();
    const { args, interval, compare, state, set } = useAnalysis();
    const [f, setF] = useUrlState(EXPLORER_DEFAULTS);
    const catalogue = useGetCatalogueQuery();
    const metric = catalogue.data?.metrics.find((m) => m.id === f.metric);
    const breakdown = metric?.breakdowns.includes(f.breakdown) ? f.breakdown : '';
    const seriesArgs = {
        ...args,
        metric: f.metric,
        interval,
        breakdown: breakdown || undefined,
        compare,
        stat: metric?.distribution ? f.stat : undefined,
    };
    const q = useGetSeriesQuery(seriesArgs, { skip: !catalogue.data });
    const [exportCsv, exporting] = useExportSeriesCsvMutation();
    const [createView, creating] = useCreateViewMutation();
    const [saveOpen, setSaveOpen] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const metricOptions = useMemo(
        () =>
            (catalogue.data?.metrics ?? []).map((m) => ({
                value: m.id,
                label: `${GROUP_LABELS[m.group] ?? m.group}: ${m.label}`,
            })),
        [catalogue.data]
    );

    const data = q.data;
    const chartType = f.chart as 'line' | 'bar' | 'table';

    const openView = (v: SavedView) => {
        const p = new URLSearchParams();
        const put = (k: string, val: string | null | undefined, def?: string) => {
            if (val && val !== def) p.set(k, val);
        };
        put('metric', v.query.metric);
        put('breakdown', v.query.breakdown);
        put('stat', v.query.stat, 'p50');
        put('chart', v.query.chart, 'line');
        put('range', v.query.range, ANALYSIS_DEFAULTS.range);
        put('from', v.query.from);
        put('to', v.query.to);
        put('interval', v.query.interval, 'auto');
        put('compare', v.query.compare ?? 'none', ANALYSIS_DEFAULTS.compare);
        navigate({ search: p.toString() }, { replace: true });
        toast.show(`Opened ${v.name}`);
    };

    let result;
    if (catalogue.isLoading || q.isLoading) result = <Skeleton variant="rounded" height={320} />;
    else if (catalogue.error || q.error || !data)
        result = (
            <ErrorState
                bare
                title="Could not run this query"
                message={getErrorMessage(q.error ?? catalogue.error, 'Try again in a moment.')}
                onRetry={q.refetch}
            />
        );
    else if (data.count === 0 && !data.previous?.total)
        result = (
            <EmptyRange
                what={data.metric.label.toLowerCase()}
                onAllTime={
                    state.range === 'all'
                        ? undefined
                        : () => set({ range: 'all', from: '', to: '' })
                }
            />
        );
    else {
        const sc = chartScale(data.metric.unit, [
            data.values,
            data.previous?.values ?? [],
            ...data.series.map((s) => s.values),
        ]);
        const fmt = (v: number) => formatValue(v * sc.scale, data.metric.unit);
        const series = data.series.length
            ? data.series.map((s, i) => ({
                  name: seriesLabel(s.label),
                  values: gaps(s.values, sc.scale),
                  color:
                      s.key === 'other'
                          ? color.ink300
                          : chart.categorical[i % chart.categorical.length],
              }))
            : [
                  {
                      name: `This period${sc.axis ? ` (${sc.axis})` : ''}`,
                      values: gaps(data.values, sc.scale),
                      color: chart.categorical[0],
                  },
                  ...(data.previous
                      ? [
                            {
                                name: 'Previous period',
                                values: gaps(data.previous.values, sc.scale),
                                color: color.ink300,
                            },
                        ]
                      : []),
              ];
        result = (
            <Box sx={{ display: 'grid', gap: 2 }}>
                {chartType !== 'table' && (
                    <ErrorBoundary>
                        <TimeSeriesChart
                            title={data.metric.label}
                            summary={`${data.metric.label}, ${rangeText(data.range)}: ${fmt(data.total ?? NaN)}.`}
                            x={data.buckets.map((b) => bucketLabel(b, data.range.interval))}
                            series={series}
                            kind={chartType}
                            stacked={chartType === 'bar' && data.series.length > 0}
                            format={fmt}
                            height={320}
                        />
                    </ErrorBoundary>
                )}
                <ResultTable data={data} />
            </Box>
        );
    }

    const download = async () => {
        try {
            const text = await exportCsv(seriesArgs).unwrap();
            downloadText(`helphive-${f.metric}${breakdown ? `-by-${breakdown}` : ''}.csv`, text);
        } catch (error) {
            toast.error(getErrorMessage(error, 'Could not export the CSV.'));
        }
    };

    const save = async (name: string, shared: boolean) => {
        setSaveError(null);
        try {
            await createView({
                name,
                shared,
                query: {
                    metric: f.metric,
                    breakdown: breakdown || null,
                    range: state.range === 'custom' ? 'custom' : state.range,
                    from: state.range === 'custom' ? state.from || null : null,
                    to: state.range === 'custom' ? state.to || null : null,
                    interval: state.interval,
                    compare: state.compare,
                    stat: metric?.distribution ? f.stat : null,
                    chart: f.chart,
                },
            }).unwrap();
            setSaveOpen(false);
            toast.success(`Saved ${name}`);
        } catch (error) {
            setSaveError(getErrorMessage(error, 'Could not save the view.'));
        }
    };

    const href = drillHref(data?.drill);

    return (
        <AnalyticsPage
            title="Explorer"
            subtitle="Any metric, any breakdown, as a chart and a table"
            actions={
                <>
                    <Button
                        variant="outlined"
                        startIcon={<ExportCsvIcon />}
                        onClick={download}
                        disabled={!data || exporting.isLoading}
                    >
                        Export CSV
                    </Button>
                    <GatedButton
                        permission="analytics.read"
                        variant="contained"
                        startIcon={<SavedViewIcon />}
                        onClick={() => {
                            setSaveError(null);
                            setSaveOpen(true);
                        }}
                        disabled={!data}
                    >
                        Save view
                    </GatedButton>
                </>
            }
        >
            <PanelGrid>
                <Box className="wide">
                    <Panel
                        title={metric?.label ?? 'Metric'}
                        subtitle={
                            metric ? `${metric.description} ${metric.computation}` : undefined
                        }
                        footer={
                            metric?.note || href ? (
                                <>
                                    <Box sx={{ color: color.ink500, fontSize: font.size.xs }}>
                                        {metric?.note ?? ''}
                                    </Box>
                                    {href && (
                                        <Link
                                            component={RouterLink}
                                            to={href}
                                            sx={{ fontWeight: 700, flexShrink: 0 }}
                                        >
                                            Open the list
                                        </Link>
                                    )}
                                </>
                            ) : undefined
                        }
                    >
                        <Box
                            sx={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 1.5,
                                alignItems: 'center',
                                mb: 2,
                            }}
                        >
                            <SelectFilter
                                label="Metric"
                                value={f.metric}
                                onChange={(m) => setF({ metric: m, breakdown: '' })}
                                options={
                                    metricOptions.length
                                        ? metricOptions
                                        : [{ value: f.metric, label: f.metric }]
                                }
                                minWidth={280}
                            />
                            <SelectFilter
                                label="Break down by"
                                value={breakdown || 'none'}
                                onChange={(b) => setF({ breakdown: b === 'none' ? '' : b })}
                                options={[
                                    { value: 'none', label: 'Nothing' },
                                    ...(metric?.breakdowns ?? []).map((b) => ({
                                        value: b,
                                        label: BREAKDOWN_LABELS[b] ?? b,
                                    })),
                                ]}
                                minWidth={170}
                            />
                            {metric?.distribution && (
                                <SelectFilter
                                    label="Statistic"
                                    value={f.stat}
                                    onChange={(stat) => setF({ stat })}
                                    options={[
                                        { value: 'p50', label: 'Median' },
                                        { value: 'p90', label: '90th percentile' },
                                        { value: 'mean', label: 'Mean' },
                                    ]}
                                    minWidth={160}
                                />
                            )}
                            <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={f.chart}
                                onChange={(_, v) => v && setF({ chart: v })}
                                aria-label="Show as"
                            >
                                <ToggleButton value="line">Line</ToggleButton>
                                <ToggleButton value="bar">Bars</ToggleButton>
                                <ToggleButton value="table">Table only</ToggleButton>
                            </ToggleButtonGroup>
                            {data && (
                                <Tooltip title={rangeText(data.range)}>
                                    <Box sx={{ ml: 'auto', textAlign: 'right' }}>
                                        <Box sx={{ fontSize: font.size.xl, fontWeight: 800 }}>
                                            {formatValue(data.total, data.metric.unit)}
                                        </Box>
                                        {data.delta?.changePct != null && (
                                            <Box
                                                sx={{
                                                    fontSize: font.size.xs,
                                                    color: color.ink500,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {data.delta.changePct > 0 ? '+' : ''}
                                                {data.delta.changePct}% vs previous period
                                            </Box>
                                        )}
                                    </Box>
                                </Tooltip>
                            )}
                        </Box>
                        {result}
                    </Panel>
                </Box>
                <Box className="wide">
                    <SavedViews onOpen={openView} />
                </Box>
            </PanelGrid>
            <SaveDialog
                key={saveOpen ? 'open' : 'closed'}
                open={saveOpen}
                onClose={() => setSaveOpen(false)}
                onSave={save}
                saving={creating.isLoading}
                error={saveError}
            />
        </AnalyticsPage>
    );
}
