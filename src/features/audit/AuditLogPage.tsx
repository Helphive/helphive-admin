import { useMemo } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { Box, Button, Chip, Link, Typography } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import { EmptyState, PageHeader, StatusPill } from '@/components/ui';
import { AuditIcon, SearchIcon } from '@/components/ui/icons';
import {
    DataTable,
    DateRangeField,
    FilterBar,
    SearchField,
    SelectFilter,
    type DateRangeValue,
} from '@/components/data';
import { formatAgo, formatDateTime } from '@/lib/format';
import { useDocumentTitle, useNow, useUrlState } from '@/lib/hooks';
import { rangeParams, sortParamFrom, sortingFromParam } from '@/lib/listQuery';
import { color, font } from '@/theme/tokens';
import { useListAuditActionsQuery, useListAuditQuery } from './api';
import {
    ACTION_GROUPS,
    actionLabel,
    actorName,
    isEmailLike,
    isObjectId,
    OUTCOME_META,
    shortId,
    TARGET_TYPES,
    targetPath,
    targetTypeLabel,
    type AuditEntry,
} from './model';

const PAGE_SIZE = 50;
const DEFAULTS = {
    actor: '',
    action: 'all',
    targetType: 'all',
    targetId: '',
    outcome: 'all',
    range: 'all',
    from: '',
    to: '',
    sort: '-at',
    page: '0',
};

export default function AuditLogPage() {
    useDocumentTitle('Audit log');
    const navigate = useNavigate();
    const location = useLocation();
    const now = useNow();
    const [f, setF, resetF] = useUrlState(DEFAULTS);
    const actions = useListAuditActionsQuery();
    const pageIndex = Math.max(0, Number(f.page) || 0);
    const filter = (patch: Partial<typeof DEFAULTS>) => setF({ ...patch, page: '0' });

    const actor = f.actor.trim();
    const actorValid = !actor || isEmailLike(actor) || isObjectId(actor);
    const range: DateRangeValue = {
        range: f.range as DateRangeValue['range'],
        from: f.from || undefined,
        to: f.to || undefined,
    };

    const list = useListAuditQuery({
        page: pageIndex + 1,
        pageSize: PAGE_SIZE,
        sort: f.sort,
        actor: actorValid ? actor : undefined,
        action: f.action,
        targetType: f.targetType,
        targetId: f.targetId,
        outcome: f.outcome,
        ...rangeParams(range),
    });

    const active =
        Number(Boolean(actor)) +
        Number(f.action !== 'all') +
        Number(f.targetType !== 'all') +
        Number(Boolean(f.targetId)) +
        Number(f.outcome !== 'all') +
        Number(f.range !== 'all');

    const actionOptions = useMemo(
        () => [
            { value: 'all', label: 'Any action' },
            ...ACTION_GROUPS.map((g) => ({ value: g.prefix, label: `${g.label} (all)` })),
            ...Object.keys(actions.data ?? {}).map((a) => ({ value: a, label: actionLabel(a) })),
        ],
        [actions.data]
    );

    const columns = useMemo<ColumnDef<AuditEntry>[]>(
        () => [
            {
                id: 'at',
                header: 'When',
                accessorFn: (e) => e.at,
                cell: ({ row }) => (
                    <Box sx={{ whiteSpace: 'nowrap' }}>
                        <Box
                            sx={{
                                fontWeight: 600,
                                color: color.ink900,
                                fontVariantNumeric: 'tabular-nums',
                            }}
                        >
                            {formatDateTime(row.original.at)}
                        </Box>
                        <Box sx={{ fontSize: font.size.xs, color: color.ink500, fontWeight: 600 }}>
                            {formatAgo(row.original.at, now)}
                        </Box>
                    </Box>
                ),
                meta: { width: 170, alwaysVisible: true, csv: (e) => e.at },
            },
            {
                id: 'action',
                header: 'Action',
                accessorFn: (e) => e.action,
                cell: ({ row }) => (
                    <Box>
                        <Box sx={{ fontWeight: 700, color: color.ink900, whiteSpace: 'nowrap' }}>
                            {actionLabel(row.original.action)}
                        </Box>
                        <Box
                            component="code"
                            sx={{
                                fontSize: font.size.xs,
                                color: color.ink500,
                                fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
                            }}
                        >
                            {row.original.action}
                        </Box>
                    </Box>
                ),
                meta: { alwaysVisible: true, csv: (e) => e.action },
            },
            {
                id: 'actor',
                header: 'Who',
                enableSorting: false,
                accessorFn: (e) => actorName(e.actor),
                cell: ({ row }) => (
                    <Box
                        component="span"
                        sx={{
                            display: 'block',
                            maxWidth: 240,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontWeight: 600,
                        }}
                        title={actorName(row.original.actor)}
                    >
                        {actorName(row.original.actor)}
                    </Box>
                ),
            },
            {
                id: 'target',
                header: 'Record',
                enableSorting: false,
                accessorFn: (e) => (e.target ? `${e.target.type} ${e.target.id ?? ''}` : ''),
                cell: ({ row }) => {
                    const t = row.original.target;
                    if (!t)
                        return (
                            <Box component="span" sx={{ color: color.ink500 }}>
                                None
                            </Box>
                        );
                    return (
                        <Box sx={{ whiteSpace: 'nowrap' }}>
                            <Box sx={{ fontWeight: 600 }}>{targetTypeLabel(t.type)}</Box>
                            {t.id && (
                                <Box
                                    component="code"
                                    title={t.id}
                                    sx={{
                                        fontSize: font.size.xs,
                                        color: color.ink500,
                                        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
                                    }}
                                >
                                    {shortId(t.id)}
                                </Box>
                            )}
                        </Box>
                    );
                },
            },
            {
                id: 'outcome',
                header: 'Outcome',
                enableSorting: false,
                accessorFn: (e) => OUTCOME_META[e.outcome]?.label ?? e.outcome,
                cell: ({ row }) => {
                    const m = OUTCOME_META[row.original.outcome];
                    return m ? (
                        <StatusPill tone={m.tone}>{m.label}</StatusPill>
                    ) : (
                        row.original.outcome
                    );
                },
            },
            {
                id: 'reason',
                header: 'Reason',
                enableSorting: false,
                accessorFn: (e) => e.reason ?? '',
                cell: ({ row }) => (
                    <Box
                        component="span"
                        sx={{
                            display: 'block',
                            maxWidth: 260,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                        title={row.original.reason ?? undefined}
                    >
                        {row.original.reason ?? ''}
                    </Box>
                ),
            },
            {
                id: 'requestId',
                header: 'Request id',
                enableSorting: false,
                accessorFn: (e) => e.requestId ?? '',
            },
        ],
        [now]
    );

    const empty =
        active > 0 ? (
            <EmptyState
                bare
                icon={<SearchIcon />}
                title="No entries match these filters"
                description="Change or clear the filters to see more."
                action={
                    <Button variant="outlined" onClick={resetF}>
                        Clear filters
                    </Button>
                }
            />
        ) : (
            <EmptyState
                bare
                icon={<AuditIcon />}
                title="Nothing has been recorded yet"
                description="Sign-ins, account changes, admin management and application decisions appear here as they happen."
            />
        );

    const total = list.data?.total;
    const recordLink = f.targetId ? targetPath({ type: f.targetType, id: f.targetId }) : null;

    return (
        <>
            <PageHeader
                title="Audit log"
                subtitle="Every sign-in, account change, admin change and application decision, newest first. Entries cannot be edited or removed."
            />
            {f.targetId && (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 1.5,
                        flexWrap: 'wrap',
                    }}
                >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Showing one record:
                    </Typography>
                    <Chip
                        label={`${targetTypeLabel(f.targetType === 'all' ? '' : f.targetType) || 'Record'} ${shortId(f.targetId)}`}
                        onDelete={() => filter({ targetId: '' })}
                        size="small"
                    />
                    {recordLink && (
                        <Link
                            component={RouterLink}
                            to={recordLink}
                            sx={{ fontWeight: 700, fontSize: font.size.sm }}
                        >
                            Open the record
                        </Link>
                    )}
                </Box>
            )}
            <DataTable<AuditEntry>
                label="Audit log entries"
                tableId="audit"
                data={list.data?.items ?? []}
                columns={columns}
                getRowId={(e) => e._id}
                loading={list.isLoading}
                error={list.error}
                onRetry={list.refetch}
                empty={empty}
                manualSorting
                sorting={sortingFromParam(f.sort)}
                onSortingChange={(s) => setF({ sort: sortParamFrom(s, DEFAULTS.sort), page: '0' })}
                pagination={{
                    mode: 'server',
                    pageIndex,
                    pageSize: PAGE_SIZE,
                    rowCount: total ?? 0,
                    onChange: (p) => setF({ page: String(p.pageIndex) }),
                    pageSizeOptions: [PAGE_SIZE],
                }}
                initialColumnVisibility={{ reason: false, requestId: false }}
                onRowActivate={(e) =>
                    navigate(`/audit/${e._id}`, { state: { back: location.search } })
                }
                csvFilename="audit-log"
                toolbar={
                    <FilterBar
                        activeCount={active}
                        onClear={resetF}
                        summary={
                            !actorValid
                                ? 'Enter a full email address or an admin id'
                                : total !== undefined
                                  ? `${total.toLocaleString('en-GB')} ${total === 1 ? 'entry' : 'entries'}`
                                  : undefined
                        }
                    >
                        <SearchField
                            value={f.actor}
                            onChange={(v) => filter({ actor: v })}
                            placeholder="Who: email or admin id"
                            label="Filter by who acted: a full email address or an admin id"
                        />
                        <SelectFilter
                            label="Action"
                            value={f.action}
                            onChange={(action) => filter({ action })}
                            options={actionOptions}
                            minWidth={190}
                        />
                        <SelectFilter
                            label="Record"
                            value={f.targetType}
                            onChange={(targetType) => filter({ targetType })}
                            options={[{ value: 'all', label: 'Any' }, ...TARGET_TYPES]}
                            minWidth={150}
                        />
                        <SelectFilter
                            label="Outcome"
                            value={f.outcome}
                            onChange={(outcome) => filter({ outcome })}
                            options={[
                                { value: 'all', label: 'Any' },
                                { value: 'success', label: 'Done' },
                                { value: 'failure', label: 'Refused' },
                            ]}
                            minWidth={120}
                        />
                        <DateRangeField
                            label="When"
                            value={range}
                            onChange={(v) =>
                                filter({ range: v.range, from: v.from ?? '', to: v.to ?? '' })
                            }
                        />
                    </FilterBar>
                }
            />
        </>
    );
}
