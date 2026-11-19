import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, MenuItem, TextField } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import { ConfirmDialog, EmptyState, PageHeader, StatusPill } from '@/components/ui';
import { AddIcon, CasesIcon, SearchIcon } from '@/components/ui/icons';
import {
    DataTable,
    FilterBar,
    KpiRow,
    KpiTile,
    SearchField,
    SelectFilter,
} from '@/components/data';
import { useToast } from '@/components/feedback/toastContext';
import GatedButton from '@/features/auth/GatedButton';
import { getErrorMessage } from '@/lib/api';
import { formatAgo, formatDateTime } from '@/lib/format';
import { useDocumentTitle, useNow, useUrlState } from '@/lib/hooks';
import { sortParamFrom, sortingFromParam } from '@/lib/listQuery';
import { color, font } from '@/theme/tokens';
import { useListCasesQuery, useOpenCaseMutation } from './api';
import {
    CATEGORIES,
    PRIORITIES,
    PRIORITY_TONE,
    STATUSES,
    STATUS_TONE,
    labelOf,
    type CaseSummary,
} from './model';

const PAGE_SIZE = 25;
const DEFAULTS = {
    q: '',
    open: 'true',
    status: 'all',
    category: 'all',
    priority: 'all',
    assignee: 'all',
    sort: '-lastActivityAt',
    page: '0',
};

const ID = /^[a-f\d]{24}$/i;

function OpenCaseDialog({
    onClose,
    onOpened,
}: {
    onClose: () => void;
    onOpened: (id: string) => void;
}) {
    const [open] = useOpenCaseMutation();
    const [v, setV] = useState({
        category: 'booking',
        subject: '',
        description: '',
        priority: 'normal',
        link: 'bookingId',
        id: '',
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const set = (patch: Partial<typeof v>) => setV((p) => ({ ...p, ...patch }));
    return (
        <ConfirmDialog
            open
            title="Open a support case?"
            description="Link it to a booking, a payment or a person; their customer and provider become the case's parties."
            confirmLabel="Open case"
            loading={busy}
            onClose={onClose}
            onConfirm={async () => {
                if (!ID.test(v.id.trim()))
                    return setError('Paste the 24-character id of the booking, payment or person.');
                if (v.subject.trim().length < 3 || v.description.trim().length < 3)
                    return setError('Write a subject and a description.');
                setBusy(true);
                setError(null);
                try {
                    const result = await open({
                        category: v.category,
                        subject: v.subject,
                        description: v.description,
                        priority: v.priority,
                        [v.link]: v.id.trim(),
                    }).unwrap();
                    onOpened(result.case._id);
                } catch (err) {
                    setError(getErrorMessage(err, 'The case was not opened.'));
                    setBusy(false);
                }
            }}
        >
            <Box sx={{ display: 'grid', gap: 2 }}>
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
                    <TextField
                        select
                        label="About a"
                        value={v.link}
                        onChange={(e) => set({ link: e.target.value })}
                    >
                        <MenuItem value="bookingId">Booking</MenuItem>
                        <MenuItem value="paymentId">Payment</MenuItem>
                        <MenuItem value="userId">Person</MenuItem>
                    </TextField>
                    <TextField
                        label="Its id"
                        value={v.id}
                        onChange={(e) => set({ id: e.target.value })}
                    />
                    <TextField
                        select
                        label="Category"
                        value={v.category}
                        onChange={(e) => set({ category: e.target.value })}
                    >
                        {CATEGORIES.map((c) => (
                            <MenuItem key={c.value} value={c.value}>
                                {c.label}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select
                        label="Priority"
                        value={v.priority}
                        onChange={(e) => set({ priority: e.target.value })}
                    >
                        {PRIORITIES.map((c) => (
                            <MenuItem key={c.value} value={c.value}>
                                {c.label}
                            </MenuItem>
                        ))}
                    </TextField>
                </Box>
                <TextField
                    label="Subject"
                    value={v.subject}
                    onChange={(e) => set({ subject: e.target.value })}
                    inputProps={{ maxLength: 200 }}
                />
                <TextField
                    label="What happened"
                    value={v.description}
                    onChange={(e) => set({ description: e.target.value })}
                    multiline
                    minRows={3}
                    inputProps={{ maxLength: 5000 }}
                />
                {error && (
                    <Alert severity="error" role="alert">
                        {error}
                    </Alert>
                )}
            </Box>
        </ConfirmDialog>
    );
}

export default function CasesPage() {
    useDocumentTitle('Cases');
    const navigate = useNavigate();
    const toast = useToast();
    const now = useNow();
    const [f, setF, resetF] = useUrlState(DEFAULTS);
    const [opening, setOpening] = useState(false);
    const pageIndex = Math.max(0, Number(f.page) || 0);
    const list = useListCasesQuery({
        page: pageIndex + 1,
        pageSize: PAGE_SIZE,
        q: f.q.trim(),
        open: f.open,
        status: f.status,
        category: f.category,
        priority: f.priority,
        assignee: f.assignee,
        sort: f.sort,
    });
    const filter = (patch: Partial<typeof DEFAULTS>) => setF({ ...patch, page: '0' });
    const active =
        Number(Boolean(f.q)) +
        Number(f.open !== 'true') +
        Number(f.status !== 'all') +
        Number(f.category !== 'all') +
        Number(f.priority !== 'all') +
        Number(f.assignee !== 'all');

    const columns = useMemo<ColumnDef<CaseSummary>[]>(
        () => [
            {
                id: 'subject',
                header: 'Case',
                enableSorting: false,
                accessorFn: (c) => c.subject,
                cell: ({ row }) => (
                    <Box sx={{ minWidth: 220, maxWidth: 420, whiteSpace: 'normal' }}>
                        <Box sx={{ fontWeight: 700, color: color.ink900 }}>
                            {row.original.subject}
                        </Box>
                        <Box sx={{ fontSize: font.size.xs, color: color.ink500, fontWeight: 600 }}>
                            {row.original.reference}, {labelOf(row.original.category).toLowerCase()}
                            {row.original.bookingReference
                                ? `, booking ${row.original.bookingReference}`
                                : ''}
                        </Box>
                    </Box>
                ),
                meta: {
                    label: 'Case',
                    alwaysVisible: true,
                    csv: (c) => `${c.reference} ${c.subject}`,
                },
            },
            {
                id: 'status',
                header: 'Status',
                enableSorting: false,
                accessorFn: (c) => c.status,
                cell: ({ row }) => (
                    <StatusPill tone={STATUS_TONE[row.original.status] ?? 'grey'}>
                        {labelOf(row.original.status)}
                    </StatusPill>
                ),
            },
            {
                id: 'priority',
                header: 'Priority',
                accessorFn: (c) => c.priority,
                cell: ({ row }) => (
                    <StatusPill tone={PRIORITY_TONE[row.original.priority] ?? 'grey'}>
                        {labelOf(row.original.priority)}
                    </StatusPill>
                ),
            },
            {
                id: 'people',
                header: 'Parties',
                enableSorting: false,
                accessorFn: (c) => (c.people ?? []).map((p) => p.person?.name).join(', '),
                cell: ({ row }) => (
                    <Box sx={{ fontSize: font.size.sm }}>
                        {(row.original.people ?? []).map((p) => (
                            <div key={`${p.role}-${p.person?._id}`}>
                                {p.person?.name ?? 'Unknown'}{' '}
                                <span style={{ color: color.ink500 }}>({p.role})</span>
                            </div>
                        ))}
                    </Box>
                ),
            },
            {
                id: 'assignee',
                header: 'Assignee',
                enableSorting: false,
                accessorFn: (c) => c.assignee?.email ?? '',
                cell: ({ row }) =>
                    row.original.assignee?.email ?? (
                        <span style={{ color: color.ink500 }}>Nobody</span>
                    ),
            },
            {
                id: 'lastActivityAt',
                header: 'Last activity',
                accessorFn: (c) => c.lastActivityAt,
                cell: ({ row }) => (
                    <span title={formatDateTime(row.original.lastActivityAt)}>
                        {formatAgo(row.original.lastActivityAt, now)}
                    </span>
                ),
            },
        ],
        [now]
    );

    const counts = list.data?.counts;
    return (
        <>
            <PageHeader
                title="Cases"
                subtitle="Support cases about a booking, a payment or a person: notes, emails to the people involved, what was done, and how it ended."
                actions={
                    <GatedButton
                        permission="support.manage"
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setOpening(true)}
                    >
                        Open case
                    </GatedButton>
                }
            />
            <KpiRow columns={3} aria-label="Open cases">
                <KpiTile label="Open" value={counts?.open ?? '—'} to="/support/cases?open=true" />
                <KpiTile
                    label="Assigned to you"
                    value={counts?.mine ?? '—'}
                    to="/support/cases?assignee=me"
                />
                <KpiTile
                    label="Nobody assigned"
                    value={counts?.unassigned ?? '—'}
                    to="/support/cases?assignee=none"
                />
            </KpiRow>
            <Box sx={{ mt: 2.5 }}>
                <DataTable<CaseSummary>
                    label="Cases"
                    tableId="support-cases"
                    data={list.data?.items ?? []}
                    columns={columns}
                    getRowId={(c) => c._id}
                    loading={list.isLoading}
                    error={list.error}
                    onRetry={list.refetch}
                    manualSorting
                    sorting={sortingFromParam(f.sort)}
                    onSortingChange={(s) =>
                        setF({ sort: sortParamFrom(s, DEFAULTS.sort), page: '0' })
                    }
                    pagination={{
                        mode: 'server',
                        pageIndex,
                        pageSize: PAGE_SIZE,
                        rowCount: list.data?.total ?? 0,
                        onChange: (p) => setF({ page: String(p.pageIndex) }),
                    }}
                    onRowActivate={(c) => navigate(`/support/cases/${c._id}`)}
                    csvFilename="cases"
                    empty={
                        active ? (
                            <EmptyState
                                bare
                                icon={<SearchIcon />}
                                title="No cases match these filters"
                                action={
                                    <Button variant="outlined" onClick={resetF}>
                                        Clear filters
                                    </Button>
                                }
                            />
                        ) : (
                            <EmptyState
                                bare
                                icon={<CasesIcon />}
                                title="No open cases"
                                description="Open one from a complaint, a refund request or anything that needs following up."
                            />
                        )
                    }
                    toolbar={
                        <FilterBar
                            activeCount={active}
                            onClear={resetF}
                            summary={list.data ? `${list.data.total} cases` : undefined}
                        >
                            <SearchField
                                value={f.q}
                                onChange={(q) => filter({ q })}
                                placeholder="Search reference or subject"
                                label="Search cases"
                            />
                            <SelectFilter
                                label="Show"
                                value={f.open}
                                onChange={(open) => filter({ open })}
                                options={[
                                    { value: 'true', label: 'Open' },
                                    { value: 'false', label: 'Done' },
                                    { value: 'all', label: 'All' },
                                ]}
                            />
                            <SelectFilter
                                label="Status"
                                value={f.status}
                                onChange={(status) => filter({ status })}
                                options={[{ value: 'all', label: 'Any' }, ...STATUSES]}
                                minWidth={170}
                            />
                            <SelectFilter
                                label="Category"
                                value={f.category}
                                onChange={(category) => filter({ category })}
                                options={[{ value: 'all', label: 'Any' }, ...CATEGORIES]}
                                minWidth={160}
                            />
                            <SelectFilter
                                label="Priority"
                                value={f.priority}
                                onChange={(priority) => filter({ priority })}
                                options={[{ value: 'all', label: 'Any' }, ...PRIORITIES]}
                            />
                            <SelectFilter
                                label="Assignee"
                                value={f.assignee}
                                onChange={(assignee) => filter({ assignee })}
                                options={[
                                    { value: 'all', label: 'Anyone' },
                                    { value: 'me', label: 'Me' },
                                    { value: 'none', label: 'Nobody' },
                                ]}
                            />
                        </FilterBar>
                    }
                />
            </Box>
            {opening && (
                <OpenCaseDialog
                    onClose={() => setOpening(false)}
                    onOpened={(id) => {
                        toast.success('Opened case');
                        setOpening(false);
                        navigate(`/support/cases/${id}`);
                    }}
                />
            )}
        </>
    );
}
