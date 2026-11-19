import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import { EmptyState, PageHeader } from '@/components/ui';
import { AddIcon, AdminsIcon, SearchIcon } from '@/components/ui/icons';
import { DataTable, FilterBar, SearchField, SelectFilter } from '@/components/data';
import GatedButton from '@/features/auth/GatedButton';
import { useGetRolesQuery } from '@/features/auth/authApi';
import { useSession } from '@/features/auth/useSession';
import { formatAgo, formatDate, formatDateTime } from '@/lib/format';
import { useDocumentTitle, useNow, useUrlState } from '@/lib/hooks';
import { sortParamFrom, sortingFromParam } from '@/lib/listQuery';
import { color, font } from '@/theme/tokens';
import { useListAdminsQuery } from './api';
import CreateAdminDialog from './CreateAdminDialog';
import { adminStatus, STATUS_META, type AdminRecord } from './model';
import { AdminStatusPill, RolePill, TwoStepState } from './parts';
import { assignableRoles } from './roles';

const PAGE_SIZE = 25;
const DEFAULTS = { q: '', role: 'all', status: 'all', sort: '-createdAt', page: '0' };

export default function AdminsPage() {
    useDocumentTitle('Admins');
    const navigate = useNavigate();
    const now = useNow();
    const { admin: me } = useSession();
    const roles = useGetRolesQuery();
    const [f, setF, resetF] = useUrlState(DEFAULTS);
    const [creating, setCreating] = useState(false);
    const pageIndex = Math.max(0, Number(f.page) || 0);

    const list = useListAdminsQuery({
        page: pageIndex + 1,
        pageSize: PAGE_SIZE,
        sort: f.sort,
        q: f.q.trim(),
        role: f.role,
        status: f.status,
    });

    const active = Number(Boolean(f.q)) + Number(f.role !== 'all') + Number(f.status !== 'all');
    // Any filter change starts again at the first page.
    const filter = (patch: Partial<typeof DEFAULTS>) => setF({ ...patch, page: '0' });

    const columns = useMemo<ColumnDef<AdminRecord>[]>(
        () => [
            {
                id: 'lastName',
                header: 'Admin',
                accessorFn: (a) => a.name,
                cell: ({ row }) => {
                    const a = row.original;
                    return (
                        <Box sx={{ minWidth: 0 }}>
                            <Box
                                sx={{ fontWeight: 700, color: color.ink900, whiteSpace: 'nowrap' }}
                            >
                                {a.name}
                                {me?._id === a.id && (
                                    <Box
                                        component="span"
                                        sx={{ ml: 0.75, color: color.ink500, fontWeight: 600 }}
                                    >
                                        (you)
                                    </Box>
                                )}
                            </Box>
                            <Box
                                sx={{
                                    fontSize: font.size.xs,
                                    color: color.ink500,
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: 260,
                                }}
                            >
                                {a.email}
                            </Box>
                        </Box>
                    );
                },
                meta: { label: 'Admin', alwaysVisible: true, csv: (a) => a.name },
            },
            {
                id: 'email',
                header: 'Email',
                accessorFn: (a) => a.email,
            },
            {
                id: 'role',
                header: 'Role',
                enableSorting: false,
                accessorFn: (a) => a.roleLabel,
                cell: ({ row }) => (
                    <RolePill role={row.original.role} label={row.original.roleLabel} />
                ),
            },
            {
                id: 'status',
                header: 'Status',
                enableSorting: false,
                accessorFn: (a) => STATUS_META[adminStatus(a)].label,
                cell: ({ row }) => <AdminStatusPill admin={row.original} />,
            },
            {
                id: 'mfa',
                header: 'Two-step',
                enableSorting: false,
                accessorFn: (a) => (a.mfaEnabled ? 'On' : 'Off'),
                cell: ({ row }) => <TwoStepState on={row.original.mfaEnabled} />,
            },
            {
                id: 'lastLoginAt',
                header: 'Last sign-in',
                accessorFn: (a) => a.lastLoginAt ?? '',
                cell: ({ row }) =>
                    row.original.lastLoginAt ? (
                        <span title={formatDateTime(row.original.lastLoginAt)}>
                            {formatAgo(row.original.lastLoginAt, now)}
                        </span>
                    ) : (
                        <Box component="span" sx={{ color: color.ink500 }}>
                            Not since sign-ins were recorded
                        </Box>
                    ),
                meta: { csv: (a) => (a.lastLoginAt ? formatDateTime(a.lastLoginAt) : '') },
            },
            {
                id: 'createdAt',
                header: 'Added',
                accessorFn: (a) => a.createdAt ?? '',
                cell: ({ row }) =>
                    row.original.createdAt ? formatDate(row.original.createdAt) : '',
                meta: { csv: (a) => (a.createdAt ? formatDateTime(a.createdAt) : '') },
            },
        ],
        [now, me?._id]
    );

    const empty =
        active > 0 ? (
            <EmptyState
                bare
                icon={<SearchIcon />}
                title="No admins match these filters"
                description="Change or clear the filters to see more."
                action={
                    <Button variant="outlined" onClick={resetF}>
                        Clear filters
                    </Button>
                }
            />
        ) : (
            <EmptyState bare icon={<AdminsIcon />} title="No admins yet" />
        );

    const total = list.data?.total;

    return (
        <>
            <PageHeader
                title="Admins"
                subtitle="Who can sign in to this console, what their role lets them do, and how they sign in."
                actions={
                    <GatedButton
                        permission="admins.manage"
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setCreating(true)}
                    >
                        Add admin
                    </GatedButton>
                }
            />
            <DataTable<AdminRecord>
                label="Admins"
                tableId="admins"
                data={list.data?.items ?? []}
                columns={columns}
                getRowId={(a) => a.id}
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
                initialColumnVisibility={{ email: false }}
                onRowActivate={(a) => navigate(`/admins/${a.id}`)}
                csvFilename="admins"
                toolbar={
                    <FilterBar
                        activeCount={active}
                        onClear={resetF}
                        summary={
                            total !== undefined
                                ? `${total} ${total === 1 ? 'admin' : 'admins'}`
                                : undefined
                        }
                    >
                        <SearchField
                            value={f.q}
                            onChange={(q) => filter({ q })}
                            placeholder="Search name or email"
                            label="Search admins"
                        />
                        <SelectFilter
                            label="Role"
                            value={f.role}
                            onChange={(role) => filter({ role })}
                            options={[
                                { value: 'all', label: 'Any' },
                                ...assignableRoles(roles.data).map((r) => ({
                                    value: r.role,
                                    label: r.label,
                                })),
                            ]}
                            minWidth={150}
                        />
                        <SelectFilter
                            label="Status"
                            value={f.status}
                            onChange={(status) => filter({ status })}
                            options={[
                                { value: 'all', label: 'Any' },
                                { value: 'active', label: 'Active' },
                                { value: 'disabled', label: 'Disabled' },
                            ]}
                            minWidth={130}
                        />
                    </FilterBar>
                }
            />
            {creating && <CreateAdminDialog onClose={() => setCreating(false)} />}
        </>
    );
}
