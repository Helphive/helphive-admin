import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, ToggleButton, ToggleButtonGroup } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import { EmptyState, PageHeader, StatusPill } from '@/components/ui';
import { SearchIcon, UsersIcon } from '@/components/ui/icons';
import {
    DataTable,
    DateRangeField,
    FilterBar,
    SearchField,
    SelectFilter,
    type DateRangeValue,
} from '@/components/data';
import { MetaPill, PersonCell, When } from '@/features/ops/parts';
import { PROVIDER_STATUS } from '@/features/ops/model';
import { fetchAllPages } from '@/lib/exportAll';
import { formatDate, formatDateTime, titleCase } from '@/lib/format';
import { useDocumentTitle, useNow, useUrlState } from '@/lib/hooks';
import { rangeParams, sortParamFrom, sortingFromParam } from '@/lib/listQuery';
import { color, font } from '@/theme/tokens';
import { useLazyListUsersQuery, useListUsersQuery, type UserListItem } from './api';

const PAGE_SIZE = 25;
const DEFAULTS = {
    role: 'all',
    q: '',
    providerStatus: 'all',
    emailVerified: 'all',
    suspended: 'all',
    available: 'all',
    hasBookings: 'all',
    range: 'all',
    from: '',
    to: '',
    active: 'all',
    activeFrom: '',
    activeTo: '',
    sort: '-createdAt',
    page: '0',
};

const YES_NO = (yes: string, no: string) => [
    { value: 'all', label: 'Any' },
    { value: 'true', label: yes },
    { value: 'false', label: no },
];

/** "Salford, GB" from the free-text place fields (masked whole for the demo admin). */
function place(u: Pick<UserListItem, 'city' | 'country'>) {
    const city = u.city && !u.city.includes('•') ? titleCase(u.city) : u.city;
    const country =
        u.country && u.country.length <= 3 ? u.country.toUpperCase() : titleCase(u.country ?? '');
    return [city, country].filter(Boolean).join(', ');
}

export default function UsersPage() {
    useDocumentTitle('Customers and providers');
    const navigate = useNavigate();
    const now = useNow();
    const [f, setF] = useUrlState(DEFAULTS);
    const pageIndex = Math.max(0, Number(f.page) || 0);
    const created: DateRangeValue = {
        range: f.range as DateRangeValue['range'],
        from: f.from || undefined,
        to: f.to || undefined,
    };
    const active: DateRangeValue = {
        range: f.active as DateRangeValue['range'],
        from: f.activeFrom || undefined,
        to: f.activeTo || undefined,
    };
    const createdParams = rangeParams(created);
    const activeParams = rangeParams(active);
    const isProviders = f.role === 'provider';

    const params = {
        sort: f.sort,
        q: f.q.trim(),
        role: f.role,
        providerStatus: isProviders ? f.providerStatus : 'all',
        emailVerified: f.emailVerified,
        suspended: f.suspended,
        available: isProviders ? f.available : 'all',
        hasBookings: f.hasBookings,
        from: createdParams.from,
        to: createdParams.to,
        activeFrom: activeParams.from,
        activeTo: activeParams.to,
    };
    const list = useListUsersQuery({ ...params, page: pageIndex + 1, pageSize: PAGE_SIZE });
    const [fetchPage] = useLazyListUsersQuery();

    const filter = (patch: Partial<typeof DEFAULTS>) => setF({ ...patch, page: '0' });
    const activeCount =
        Number(Boolean(f.q)) +
        Number(isProviders && f.providerStatus !== 'all') +
        Number(f.emailVerified !== 'all') +
        Number(f.suspended !== 'all') +
        Number(isProviders && f.available !== 'all') +
        Number(f.hasBookings !== 'all') +
        Number(f.range !== 'all') +
        Number(f.active !== 'all');
    const clear = () => setF({ ...DEFAULTS, role: f.role });

    const columns = useMemo<ColumnDef<UserListItem>[]>(
        () => [
            {
                id: 'lastName',
                header: 'Person',
                accessorFn: (u) => `${u.firstName} ${u.lastName}`.trim(),
                cell: ({ row }) => <PersonCell person={row.original} />,
                meta: { label: 'Person', alwaysVisible: true },
            },
            {
                id: 'email',
                header: 'Email',
                accessorFn: (u) => u.email ?? '',
            },
            {
                id: 'phone',
                header: 'Phone',
                enableSorting: false,
                accessorFn: (u) => u.phone ?? '',
            },
            {
                id: 'role',
                header: 'Role',
                enableSorting: false,
                accessorFn: (u) => (u.role === 'provider' ? 'Provider' : 'Customer'),
                cell: ({ row }) => (
                    <StatusPill tone={row.original.role === 'provider' ? 'blue' : 'grey'}>
                        {row.original.role === 'provider' ? 'Provider' : 'Customer'}
                    </StatusPill>
                ),
            },
            {
                id: 'providerStatus',
                header: 'Provider status',
                enableSorting: false,
                accessorFn: (u) =>
                    u.providerStatus
                        ? (PROVIDER_STATUS[u.providerStatus]?.label ?? u.providerStatus)
                        : '',
                cell: ({ row }) =>
                    row.original.providerStatus ? (
                        <MetaPill map={PROVIDER_STATUS} value={row.original.providerStatus} />
                    ) : (
                        ''
                    ),
            },
            {
                id: 'account',
                header: 'Account',
                enableSorting: false,
                accessorFn: (u) =>
                    u.suspended ? 'Suspended' : u.emailVerified ? 'Active' : 'Email not verified',
                cell: ({ row }) => {
                    const u = row.original;
                    if (u.suspended) return <StatusPill tone="red">Suspended</StatusPill>;
                    if (!u.emailVerified)
                        return <StatusPill tone="amber">Email not verified</StatusPill>;
                    return <StatusPill tone="green">Active</StatusPill>;
                },
            },
            {
                id: 'available',
                header: 'Online',
                enableSorting: false,
                accessorFn: (u) => (u.available === null ? '' : u.available ? 'Online' : 'Offline'),
                cell: ({ row }) =>
                    row.original.available === null ? (
                        ''
                    ) : (
                        <Box
                            component="span"
                            sx={{
                                fontWeight: 700,
                                color: row.original.available ? color.green700 : color.ink500,
                            }}
                        >
                            {row.original.available ? 'Online' : 'Offline'}
                        </Box>
                    ),
            },
            {
                id: 'services',
                header: 'Services',
                enableSorting: false,
                accessorFn: (u) => u.services.join(', '),
                cell: ({ row }) => (
                    <Box
                        component="span"
                        sx={{ fontSize: font.size.sm, color: color.ink600, whiteSpace: 'nowrap' }}
                    >
                        {row.original.services.join(', ')}
                    </Box>
                ),
            },
            {
                id: 'place',
                header: 'Place',
                enableSorting: false,
                accessorFn: (u) => place(u),
            },
            {
                id: 'lastActiveAt',
                header: 'Last active',
                accessorFn: (u) => u.lastActiveAt ?? '',
                cell: ({ row }) => (
                    <When at={row.original.lastActiveAt} now={now} empty="Not seen yet" />
                ),
                meta: { csv: (u) => (u.lastActiveAt ? formatDateTime(u.lastActiveAt) : '') },
            },
            {
                id: 'suspendedAt',
                header: 'Suspended',
                accessorFn: (u) => u.suspendedAt ?? '',
                cell: ({ row }) =>
                    row.original.suspendedAt ? formatDate(row.original.suspendedAt) : '',
                meta: { csv: (u) => (u.suspendedAt ? formatDateTime(u.suspendedAt) : '') },
            },
            {
                id: 'createdAt',
                header: 'Joined',
                accessorFn: (u) => u.createdAt ?? '',
                cell: ({ row }) =>
                    row.original.createdAt ? (
                        <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                            {formatDate(row.original.createdAt)}
                        </Box>
                    ) : (
                        ''
                    ),
                meta: { csv: (u) => (u.createdAt ? formatDateTime(u.createdAt) : '') },
            },
            {
                id: 'id',
                header: 'Id',
                enableSorting: false,
                accessorFn: (u) => u._id,
            },
        ],
        [now]
    );

    const total = list.data?.total;
    const noun = f.role === 'customer' ? 'customer' : f.role === 'provider' ? 'provider' : 'person';
    const nouns = noun === 'person' ? 'people' : `${noun}s`;

    return (
        <>
            <PageHeader
                title="Customers and providers"
                subtitle="Everyone with a HelpHive account. Open a person for their bookings, money, sessions and history."
            />
            <ToggleButtonGroup
                exclusive
                size="small"
                value={f.role}
                onChange={(_, role: string | null) =>
                    role &&
                    filter({
                        role,
                        ...(role !== 'provider' ? { providerStatus: 'all', available: 'all' } : {}),
                    })
                }
                aria-label="Show"
                sx={{ mb: 1.5, bgcolor: color.surface }}
            >
                <ToggleButton value="all" sx={{ px: 2 }}>
                    Everyone
                </ToggleButton>
                <ToggleButton value="customer" sx={{ px: 2 }}>
                    Customers
                </ToggleButton>
                <ToggleButton value="provider" sx={{ px: 2 }}>
                    Providers
                </ToggleButton>
            </ToggleButtonGroup>
            <DataTable<UserListItem>
                label="Customers and providers"
                tableId="users"
                data={list.data?.items ?? []}
                columns={columns}
                getRowId={(u) => u._id}
                loading={list.isFetching && !list.data}
                error={list.error}
                onRetry={list.refetch}
                empty={
                    activeCount > 0 ? (
                        <EmptyState
                            bare
                            icon={<SearchIcon />}
                            title={`No ${nouns} match these filters`}
                            description="Search matches the start of a name, email or phone number, or a whole id."
                            action={
                                <Button variant="outlined" onClick={clear}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState bare icon={<UsersIcon />} title={`No ${nouns} yet`} />
                    )
                }
                manualSorting
                sorting={sortingFromParam(f.sort)}
                onSortingChange={(s) => filter({ sort: sortParamFrom(s, DEFAULTS.sort) })}
                pagination={{
                    mode: 'server',
                    pageIndex,
                    pageSize: PAGE_SIZE,
                    rowCount: total ?? 0,
                    onChange: (p) => setF({ page: String(p.pageIndex) }),
                    pageSizeOptions: [PAGE_SIZE],
                }}
                initialColumnVisibility={{
                    email: false,
                    phone: false,
                    services: false,
                    suspendedAt: false,
                    id: false,
                }}
                onRowActivate={(u) => navigate(`/users/${u._id}`)}
                csvFilename={f.role === 'all' ? 'people' : `${f.role}s`}
                exportAllRows={() =>
                    fetchAllPages((page, pageSize) =>
                        fetchPage({ ...params, page, pageSize }, true).unwrap()
                    )
                }
                toolbar={
                    <FilterBar
                        activeCount={activeCount}
                        onClear={clear}
                        summary={
                            total !== undefined
                                ? `${total} ${total === 1 ? noun : nouns}`
                                : undefined
                        }
                    >
                        <SearchField
                            value={f.q}
                            onChange={(q) => filter({ q })}
                            placeholder="Name, email, phone or id"
                            label="Search people"
                        />
                        {isProviders && (
                            <SelectFilter
                                label="Provider"
                                value={f.providerStatus}
                                onChange={(providerStatus) => filter({ providerStatus })}
                                options={[
                                    { value: 'all', label: 'Any' },
                                    ...Object.entries(PROVIDER_STATUS).map(([value, m]) => ({
                                        value,
                                        label: m.label,
                                    })),
                                ]}
                                minWidth={170}
                            />
                        )}
                        {isProviders && (
                            <SelectFilter
                                label="Online"
                                value={f.available}
                                onChange={(available) => filter({ available })}
                                options={YES_NO('Online', 'Offline')}
                                minWidth={120}
                            />
                        )}
                        <SelectFilter
                            label="Account"
                            value={f.suspended}
                            onChange={(suspended) => filter({ suspended })}
                            options={YES_NO('Suspended', 'Not suspended')}
                            minWidth={130}
                        />
                        <SelectFilter
                            label="Email"
                            value={f.emailVerified}
                            onChange={(emailVerified) => filter({ emailVerified })}
                            options={YES_NO('Verified', 'Not verified')}
                            minWidth={120}
                        />
                        <SelectFilter
                            label="Bookings"
                            value={f.hasBookings}
                            onChange={(hasBookings) => filter({ hasBookings })}
                            options={YES_NO('Has bookings', 'None')}
                            minWidth={130}
                        />
                        <DateRangeField
                            label="Joined"
                            value={created}
                            onChange={(v) =>
                                filter({ range: v.range, from: v.from ?? '', to: v.to ?? '' })
                            }
                        />
                        <DateRangeField
                            label="Last active"
                            value={active}
                            onChange={(v) =>
                                filter({
                                    active: v.range,
                                    activeFrom: v.from ?? '',
                                    activeTo: v.to ?? '',
                                })
                            }
                        />
                    </FilterBar>
                }
            />
        </>
    );
}
