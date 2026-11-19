import { useMemo } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Button, Switch, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, FilterBar, SelectFilter } from '@/components/data';
import { EmptyState, PageHeader, StatusPill } from '@/components/ui';
import { AddIcon, AlertsIcon } from '@/components/ui/icons';
import { useToast } from '@/components/feedback/toastContext';
import GatedButton from '@/features/auth/GatedButton';
import { useActionGate } from '@/features/auth/useSession';
import { getErrorMessage } from '@/lib/api';
import { formatAgo, formatNumber } from '@/lib/format';
import { useDocumentTitle, useNow, useUrlState } from '@/lib/hooks';
import { sortParamFrom, sortingFromParam } from '@/lib/listQuery';
import { color, font } from '@/theme/tokens';
import {
    useGetObsMetaQuery,
    useListAlertRulesQuery,
    useListAlertsQuery,
    useUpdateAlertRuleMutation,
} from './api';
import { ALERT_TONE, type Alert, type AlertRule } from './model';

const PAGE_SIZE = 50;
const DEFAULTS = { tab: 'inbox', status: 'open', sort: '-firedAt', page: '0' };

function Inbox() {
    const navigate = useNavigate();
    const now = useNow();
    const [f, setF] = useUrlState(DEFAULTS);
    const list = useListAlertsQuery({
        page: Number(f.page) + 1,
        pageSize: PAGE_SIZE,
        sort: f.sort,
        ...(f.status === 'open' ? { open: 'true' } : { status: f.status }),
    });
    const columns = useMemo<ColumnDef<Alert>[]>(
        () => [
            {
                id: 'firedAt',
                header: 'Fired',
                accessorFn: (a) => a.firedAt,
                cell: ({ row }) => (
                    <Box sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {formatAgo(row.original.firedAt, now)}
                    </Box>
                ),
            },
            {
                id: 'rule',
                header: 'Alert',
                enableSorting: false,
                accessorFn: (a) => a.ruleName,
                cell: ({ row }) => (
                    <Box>
                        <Box sx={{ fontWeight: 700, color: color.ink900 }}>
                            {row.original.ruleName}
                        </Box>
                        <Box sx={{ fontSize: font.size.xs, color: color.ink500, fontWeight: 600 }}>
                            {row.original.summary}
                        </Box>
                    </Box>
                ),
                meta: { alwaysVisible: true },
            },
            {
                id: 'severity',
                header: 'Severity',
                accessorFn: (a) => a.severity,
                cell: ({ row }) => (
                    <StatusPill tone={row.original.severity === 'critical' ? 'red' : 'amber'}>
                        {row.original.severity}
                    </StatusPill>
                ),
            },
            {
                id: 'status',
                header: 'State',
                enableSorting: false,
                accessorFn: (a) => a.status,
                cell: ({ row }) => (
                    <StatusPill tone={ALERT_TONE[row.original.status]}>
                        {row.original.status}
                    </StatusPill>
                ),
            },
        ],
        [now]
    );
    const open = list.data?.open ?? {};
    return (
        <DataTable<Alert>
            label="Alerts"
            tableId="obs-alerts"
            data={list.data?.items ?? []}
            columns={columns}
            getRowId={(a) => a.id}
            loading={list.isLoading}
            error={list.error}
            onRetry={list.refetch}
            manualSorting
            sorting={sortingFromParam(f.sort)}
            onSortingChange={(s) => setF({ sort: sortParamFrom(s, DEFAULTS.sort), page: '0' })}
            pagination={{
                mode: 'server',
                pageIndex: Number(f.page),
                pageSize: PAGE_SIZE,
                rowCount: list.data?.total ?? 0,
                onChange: (p) => setF({ page: String(p.pageIndex) }),
            }}
            onRowActivate={(a) => navigate(`/observability/alerts/${a.id}`)}
            toolbar={
                <FilterBar
                    summary={`${open.firing ?? 0} firing, ${open.acknowledged ?? 0} acknowledged`}
                >
                    <SelectFilter
                        label="Show"
                        value={f.status}
                        onChange={(status) => setF({ status, page: '0' })}
                        options={[
                            { value: 'open', label: 'Open' },
                            { value: 'firing', label: 'Firing' },
                            { value: 'acknowledged', label: 'Acknowledged' },
                            { value: 'resolved', label: 'Resolved (history)' },
                        ]}
                    />
                </FilterBar>
            }
            empty={
                <EmptyState
                    bare
                    icon={<AlertsIcon />}
                    title={f.status === 'resolved' ? 'No resolved alerts yet' : 'Nothing is firing'}
                    description="Alerts open here when a rule's condition holds, and close by themselves when it clears. Rules start turned off: open the rules tab to choose which to turn on."
                />
            }
        />
    );
}

function Rules() {
    const navigate = useNavigate();
    const now = useNow();
    const toast = useToast();
    const rules = useListAlertRulesQuery();
    const meta = useGetObsMetaQuery();
    const [update, updating] = useUpdateAlertRuleMutation();
    const gate = useActionGate('observability.manage');
    const columns = useMemo<ColumnDef<AlertRule>[]>(
        () => [
            {
                id: 'enabled',
                header: 'On',
                enableSorting: false,
                cell: ({ row }) => {
                    const r = row.original;
                    const sw = (
                        <Switch
                            checked={r.enabled}
                            disabled={!gate.allowed || updating.isLoading}
                            inputProps={{
                                'aria-label': `${r.enabled ? 'Turn off' : 'Turn on'} ${r.name}`,
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onChange={async (_e, enabled) => {
                                try {
                                    await update({ id: r.id, enabled }).unwrap();
                                    toast.success(
                                        `${enabled ? 'Turned on' : 'Turned off'} ${r.name}`
                                    );
                                } catch (error) {
                                    toast.error(
                                        getErrorMessage(error, 'Could not change the rule.')
                                    );
                                }
                            }}
                        />
                    );
                    return gate.allowed ? (
                        sw
                    ) : (
                        <Tooltip title={gate.reason ?? ''}>
                            <span>{sw}</span>
                        </Tooltip>
                    );
                },
                meta: { width: 64 },
            },
            {
                id: 'name',
                header: 'Rule',
                accessorFn: (r) => r.name,
                cell: ({ row }) => (
                    <Box>
                        <Box sx={{ fontWeight: 700, color: color.ink900 }}>{row.original.name}</Box>
                        <Box sx={{ fontSize: font.size.xs, color: color.ink500, fontWeight: 600 }}>
                            {meta.data?.kinds[row.original.kind]?.label ?? row.original.kind},{' '}
                            {row.original.severity}
                            {row.original.recipients.length
                                ? `, emails ${row.original.recipients.length}`
                                : ', no email'}
                        </Box>
                    </Box>
                ),
                meta: { alwaysVisible: true },
            },
            {
                id: 'last',
                header: 'Last check',
                enableSorting: false,
                cell: ({ row }) =>
                    row.original.lastEvaluatedAt ? (
                        <Box>
                            <Box sx={{ fontSize: font.size.sm }}>{row.original.lastSummary}</Box>
                            <Box sx={{ fontSize: font.size.xs, color: color.ink500 }}>
                                {formatAgo(row.original.lastEvaluatedAt, now)}
                            </Box>
                        </Box>
                    ) : (
                        <Box sx={{ color: color.ink500 }}>
                            {row.original.enabled ? 'Waiting for the first check' : 'Off'}
                        </Box>
                    ),
            },
            {
                id: 'open',
                header: 'Open alerts',
                accessorFn: (r) => r.openAlerts ?? 0,
                cell: ({ getValue }) =>
                    getValue<number>() ? (
                        <StatusPill tone="red">{formatNumber(getValue<number>())}</StatusPill>
                    ) : (
                        '0'
                    ),
                meta: { align: 'right' },
            },
        ],
        [gate.allowed, gate.reason, meta.data, now, toast, update, updating.isLoading]
    );
    return (
        <DataTable<AlertRule>
            label="Alert rules"
            tableId="obs-rules"
            data={rules.data?.items ?? []}
            columns={columns}
            getRowId={(r) => r.id}
            loading={rules.isLoading}
            error={rules.error}
            onRetry={rules.refetch}
            pagination={{ mode: 'none' }}
            onRowActivate={(r) => navigate(`/observability/alerts/rules/${r.id}`)}
            toolbar={
                <Typography variant="body2" color="text.secondary">
                    Checked every minute by one API instance. Recipients get an email when an alert
                    fires and when it clears.
                </Typography>
            }
            empty={
                <EmptyState
                    bare
                    icon={<AlertsIcon />}
                    title="No rules yet"
                    description="The API creates eight suggested rules, all turned off, within two minutes of its first start with this version."
                    action={
                        <Button
                            component={RouterLink}
                            to="/observability/alerts/rules/new"
                            variant="outlined"
                        >
                            Write a rule
                        </Button>
                    }
                />
            }
        />
    );
}

export default function AlertsPage() {
    useDocumentTitle('Alerts');
    const [f, setF] = useUrlState(DEFAULTS);
    const navigate = useNavigate();
    return (
        <>
            <PageHeader
                title="Alerts"
                subtitle="What needs attention now, and the rules that decide it."
                actions={
                    <GatedButton
                        permission="observability.manage"
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => navigate('/observability/alerts/rules/new')}
                    >
                        New rule
                    </GatedButton>
                }
            />
            <Tabs
                value={f.tab}
                onChange={(_e, tab) => setF({ ...DEFAULTS, tab })}
                sx={{ mb: 2, borderBottom: `1px solid ${color.line}` }}
            >
                <Tab value="inbox" label="Inbox" />
                <Tab value="rules" label="Rules" />
            </Tabs>
            {f.tab === 'rules' ? <Rules /> : <Inbox />}
        </>
    );
}
