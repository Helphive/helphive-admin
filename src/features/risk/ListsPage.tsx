import { useMemo, useState } from 'react';
import { Box, Button, MenuItem, TextField } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, FilterBar, SearchField, SelectFilter } from '@/components/data';
import { EmptyState, PageHeader, StatusPill } from '@/components/ui';
import { AddIcon, ListsIcon } from '@/components/ui/icons';
import { useToast } from '@/components/feedback/toastContext';
import GatedButton from '@/features/auth/GatedButton';
import ReasonDialog from '@/features/admins/ReasonDialog';
import { useSession } from '@/features/auth/useSession';
import { formatAgo, formatDate, formatDateTime } from '@/lib/format';
import { useDocumentTitle, useNow, useUrlState } from '@/lib/hooks';
import { sortParamFrom, sortingFromParam } from '@/lib/listQuery';
import { color, font } from '@/theme/tokens';
import {
    useAddEntryMutation,
    useListEntriesQuery,
    useRemoveEntryMutation,
    useSetEntryExpiryMutation,
} from './api';
import { LIST_KIND_HINT, LIST_KIND_LABEL, type ListEntry, type ListKind } from './model';

const PAGE_SIZE = 50;
const DEFAULTS = {
    list: 'all',
    kind: 'all',
    status: 'active',
    q: '',
    sort: '-createdAt',
    page: '0',
};
const EXPIRY = [
    { value: '0', label: 'Never' },
    { value: '1', label: 'In 1 day' },
    { value: '7', label: 'In 7 days' },
    { value: '30', label: 'In 30 days' },
    { value: '90', label: 'In 90 days' },
];
const expiresFrom = (days: string) =>
    days === '0' ? null : new Date(Date.now() + Number(days) * 86400000).toISOString();

export default function ListsPage() {
    useDocumentTitle('Block and allow lists');
    const now = useNow();
    const { demo } = useSession();
    const toast = useToast();
    const [f, setF, resetF] = useUrlState(DEFAULTS);
    const pageIndex = Math.max(0, Number(f.page) || 0);
    const q = useListEntriesQuery({
        page: pageIndex + 1,
        pageSize: PAGE_SIZE,
        list: f.list,
        kind: f.kind,
        status: f.status,
        q: f.q.trim(),
        sort: f.sort,
    });
    const [adding, setAdding] = useState<'block' | 'allow' | null>(null);
    const [expiring, setExpiring] = useState<ListEntry | null>(null);
    const [removing, setRemoving] = useState<ListEntry | null>(null);
    const [addEntry] = useAddEntryMutation();
    const [setExpiry] = useSetEntryExpiryMutation();
    const [remove] = useRemoveEntryMutation();
    const filter = (patch: Partial<typeof DEFAULTS>) => setF({ ...patch, page: '0' });
    const active =
        Number(f.list !== 'all') +
        Number(f.kind !== 'all') +
        Number(f.status !== 'active') +
        Number(!!f.q);

    const columns = useMemo<ColumnDef<ListEntry>[]>(
        () => [
            {
                id: 'list',
                header: 'List',
                enableSorting: false,
                accessorFn: (e) => e.list,
                cell: ({ row }) => (
                    <StatusPill tone={row.original.list === 'block' ? 'red' : 'green'}>
                        {row.original.list === 'block' ? 'Block' : 'Allow'}
                    </StatusPill>
                ),
            },
            {
                id: 'value',
                header: 'Value',
                enableSorting: false,
                accessorFn: (e) => e.value,
                cell: ({ row }) => (
                    <Box>
                        <Box sx={{ fontWeight: 700, color: color.ink900, wordBreak: 'break-all' }}>
                            {row.original.value}
                        </Box>
                        <Box sx={{ fontSize: font.size.xs, color: color.ink500, fontWeight: 600 }}>
                            {row.original.kindLabel}
                        </Box>
                    </Box>
                ),
                meta: { alwaysVisible: true },
            },
            { id: 'reason', header: 'Reason', enableSorting: false, accessorFn: (e) => e.reason },
            {
                id: 'status',
                header: 'Status',
                enableSorting: false,
                accessorFn: (e) => e.status,
                cell: ({ row }) => (
                    <StatusPill tone={row.original.status === 'active' ? 'blue' : 'grey'}>
                        {row.original.status === 'active'
                            ? 'Active'
                            : row.original.status === 'expired'
                              ? 'Expired'
                              : 'Removed'}
                    </StatusPill>
                ),
            },
            {
                id: 'expiresAt',
                header: 'Expires',
                accessorFn: (e) => e.expiresAt ?? '',
                cell: ({ row }) =>
                    row.original.expiresAt ? (
                        formatDate(row.original.expiresAt)
                    ) : (
                        <Box component="span" sx={{ color: color.ink500 }}>
                            Never
                        </Box>
                    ),
            },
            {
                id: 'matches',
                header: 'Matched',
                accessorFn: (e) => e.matches,
                cell: ({ row }) => (
                    <span
                        title={
                            row.original.lastMatchedAt
                                ? `Last ${formatDateTime(row.original.lastMatchedAt)}`
                                : undefined
                        }
                    >
                        {row.original.matches}
                        {row.original.lastMatchedAt
                            ? `, last ${formatAgo(row.original.lastMatchedAt, now)}`
                            : ''}
                    </span>
                ),
                meta: { align: 'right' },
            },
            {
                id: 'createdAt',
                header: 'Added',
                accessorFn: (e) => e.createdAt,
                cell: ({ row }) => (
                    <span title={row.original.createdBy?.email ?? undefined}>
                        {formatDate(row.original.createdAt)}
                    </span>
                ),
            },
            {
                id: 'manage',
                header: '',
                enableSorting: false,
                cell: ({ row }) =>
                    row.original.status === 'removed' ? null : (
                        <Box
                            sx={{ display: 'flex', gap: 0.5 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <GatedButton
                                permission="risk.manage"
                                size="small"
                                onClick={() => setExpiring(row.original)}
                            >
                                Expiry
                            </GatedButton>
                            <GatedButton
                                permission="risk.manage"
                                size="small"
                                color="error"
                                onClick={() => setRemoving(row.original)}
                            >
                                Remove
                            </GatedButton>
                        </Box>
                    ),
                meta: { noCsv: true, label: 'Manage' },
            },
        ],
        [now]
    );

    return (
        <>
            <PageHeader
                title="Block and allow lists"
                subtitle="Checked at sign-up, sign-in and booking. A blocked person sees a general message. An allow entry lets someone through a block and keeps rules from acting on them. The shared demo accounts are never blocked."
                actions={
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <GatedButton
                            permission="risk.manage"
                            variant="outlined"
                            onClick={() => setAdding('allow')}
                        >
                            Allow
                        </GatedButton>
                        <GatedButton
                            permission="risk.manage"
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => setAdding('block')}
                        >
                            Block
                        </GatedButton>
                    </Box>
                }
            />
            <DataTable<ListEntry>
                label="List entries"
                tableId="risk-lists"
                data={q.data?.items ?? []}
                columns={columns}
                getRowId={(e) => e._id}
                loading={q.isLoading}
                error={q.error}
                onRetry={q.refetch}
                manualSorting
                sorting={sortingFromParam(f.sort)}
                onSortingChange={(s) => setF({ sort: sortParamFrom(s, DEFAULTS.sort), page: '0' })}
                pagination={{
                    mode: 'server',
                    pageIndex,
                    pageSize: PAGE_SIZE,
                    rowCount: q.data?.total ?? 0,
                    onChange: (p) => setF({ page: String(p.pageIndex) }),
                    pageSizeOptions: [PAGE_SIZE],
                }}
                csvFilename="risk-lists"
                empty={
                    active ? (
                        <EmptyState
                            bare
                            icon={<ListsIcon />}
                            title="No entries match these filters"
                            action={
                                <Button variant="outlined" onClick={resetF}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            bare
                            icon={<ListsIcon />}
                            title="Nothing is blocked or allowed"
                            description="Block an email, domain, device, IP address or range, or phone number here or from a case."
                        />
                    )
                }
                toolbar={
                    <FilterBar
                        activeCount={active}
                        onClear={resetF}
                        summary={q.data ? `${q.data.total} entries` : undefined}
                    >
                        {!demo && (
                            <SearchField
                                value={f.q}
                                onChange={(v) => filter({ q: v })}
                                placeholder="Search values"
                            />
                        )}
                        <SelectFilter
                            label="List"
                            value={f.list}
                            onChange={(list) => filter({ list })}
                            options={[
                                { value: 'all', label: 'Both' },
                                { value: 'block', label: 'Block' },
                                { value: 'allow', label: 'Allow' },
                            ]}
                        />
                        <SelectFilter
                            label="Kind"
                            value={f.kind}
                            onChange={(kind) => filter({ kind })}
                            options={[
                                { value: 'all', label: 'Any' },
                                ...(Object.keys(LIST_KIND_LABEL) as ListKind[]).map((k) => ({
                                    value: k,
                                    label: LIST_KIND_LABEL[k],
                                })),
                            ]}
                        />
                        <SelectFilter
                            label="Status"
                            value={f.status}
                            onChange={(status) => filter({ status })}
                            options={[
                                { value: 'active', label: 'Active' },
                                { value: 'expired', label: 'Expired' },
                                { value: 'removed', label: 'Removed' },
                                { value: 'all', label: 'Any' },
                            ]}
                        />
                    </FilterBar>
                }
            />
            {adding && (
                <AddDialog
                    list={adding}
                    onClose={() => setAdding(null)}
                    onAdd={async (body) => {
                        await addEntry({ list: adding, ...body }).unwrap();
                        setAdding(null);
                        toast.success(adding === 'block' ? 'Blocked' : 'Allowed');
                    }}
                />
            )}
            {expiring && (
                <ExpiryDialog
                    entry={expiring}
                    onClose={() => setExpiring(null)}
                    onSave={async (expiresAt, reason) => {
                        await setExpiry({ id: expiring._id, expiresAt, reason }).unwrap();
                        setExpiring(null);
                        toast.success('Expiry changed');
                    }}
                />
            )}
            {removing && (
                <ReasonDialog
                    title={`Remove ${removing.value} from the ${removing.list} list?`}
                    effect={
                        removing.list === 'block'
                            ? 'It stops being blocked within a minute on every server.'
                            : 'It is no longer let through blocks, and rules can act on it again.'
                    }
                    reason="required"
                    destructive
                    confirmLabel="Remove"
                    busyLabel="Removing"
                    onClose={() => setRemoving(null)}
                    onConfirm={async (reason) => {
                        await remove({ id: removing._id, reason }).unwrap();
                        setRemoving(null);
                        toast.success('Removed');
                    }}
                />
            )}
        </>
    );
}

function AddDialog({
    list,
    onClose,
    onAdd,
}: {
    list: 'block' | 'allow';
    onClose: () => void;
    onAdd: (body: {
        kind: ListKind;
        value: string;
        reason: string;
        expiresAt: string | null;
    }) => Promise<void>;
}) {
    const [kind, setKind] = useState<ListKind>('email');
    const [value, setValue] = useState('');
    const [days, setDays] = useState('0');
    return (
        <ReasonDialog
            title={list === 'block' ? 'Block something?' : 'Allow something?'}
            effect={
                list === 'block'
                    ? 'Sign-ups, sign-ins and new bookings that present it are refused with a general message, on every server within a minute. Nobody already signed in is signed out.'
                    : 'Anyone presenting it gets through block entries, and risk rules stop acting on (and scoring) a person whose email, phone or device is allowed.'
            }
            reason="required"
            destructive={list === 'block'}
            confirmLabel={list === 'block' ? 'Block' : 'Allow'}
            busyLabel="Saving"
            validate={() => (value.trim() ? null : 'Enter what to add.')}
            onClose={onClose}
            onConfirm={(reason) =>
                onAdd({ kind, value: value.trim(), reason, expiresAt: expiresFrom(days) })
            }
        >
            <Box
                sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' } }}
            >
                <TextField
                    select
                    label="Kind"
                    value={kind}
                    onChange={(e) => setKind(e.target.value as ListKind)}
                >
                    {(Object.keys(LIST_KIND_LABEL) as ListKind[]).map((k) => (
                        <MenuItem key={k} value={k}>
                            {LIST_KIND_LABEL[k]}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    label="Value"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    helperText={LIST_KIND_HINT[kind]}
                />
                <TextField
                    select
                    label="Expires"
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                >
                    {EXPIRY.map((o) => (
                        <MenuItem key={o.value} value={o.value}>
                            {o.label}
                        </MenuItem>
                    ))}
                </TextField>
            </Box>
        </ReasonDialog>
    );
}

function ExpiryDialog({
    entry,
    onClose,
    onSave,
}: {
    entry: ListEntry;
    onClose: () => void;
    onSave: (expiresAt: string | null, reason: string) => Promise<void>;
}) {
    const [days, setDays] = useState('0');
    return (
        <ReasonDialog
            title={`Change when ${entry.value} expires?`}
            effect={`It is now ${entry.expiresAt ? `set to expire ${formatDate(entry.expiresAt)}` : 'permanent'}. After it expires it stops applying, and stays here as expired.`}
            reason="required"
            confirmLabel="Change expiry"
            busyLabel="Saving"
            onClose={onClose}
            onConfirm={(reason) => onSave(expiresFrom(days), reason)}
        >
            <TextField
                select
                fullWidth
                label="Expires"
                value={days}
                onChange={(e) => setDays(e.target.value)}
            >
                {EXPIRY.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                        {o.label}
                    </MenuItem>
                ))}
            </TextField>
        </ReasonDialog>
    );
}
