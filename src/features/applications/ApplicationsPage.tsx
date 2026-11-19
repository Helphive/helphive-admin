import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Tab, Tabs } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import { Count, EmptyState, PageHeader } from '@/components/ui';
import { ApplicationsIcon, CopyTextIcon, SearchIcon } from '@/components/ui/icons';
import {
    DataTable,
    DateRangeField,
    FilterBar,
    SearchField,
    SelectFilter,
    inRange,
    resolveRange,
    type DateRangeValue,
} from '@/components/data';
import { useToast } from '@/components/feedback/toastContext';
import { formatDate, formatDateTime, formatDuration } from '@/lib/format';
import { useDocumentTitle, useNow, useUrlState } from '@/lib/hooks';
import { hairline } from '@/theme/tokens';
import { useListPendingApplicationsQuery, useListReviewedApplicationsQuery } from './api';
import { SERVICE_KEYS, SERVICES, STATUS_META, type Application, type ServiceKey } from './model';
import { ApplicantCell, ApplicationStatusPill, ServiceList, WaitMeter } from './parts';

type View = 'queue' | 'history';

const FILTER_DEFAULTS = {
    view: 'queue',
    q: '',
    status: 'all',
    service: 'all',
    range: 'all',
    from: '',
    to: '',
};

function matches(a: Application, q: string) {
    if (!q) return true;
    const hay = `${a.name} ${a.email} ${a.phone} ${a.city} ${a.state} ${a.country}`.toLowerCase();
    return q
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every((w) => hay.includes(w));
}

const csvCommon = {
    services: (a: Application) => a.services.map((s) => SERVICES[s].label).join('; '),
};

export default function ApplicationsPage() {
    const navigate = useNavigate();
    const toast = useToast();
    const now = useNow();
    const [filters, setFilters, resetFilters] = useUrlState(FILTER_DEFAULTS);
    const view: View = filters.view === 'history' ? 'history' : 'queue';
    useDocumentTitle(
        view === 'queue' ? 'Applications waiting for review' : 'Reviewed applications'
    );

    const pending = useListPendingApplicationsQuery();
    const reviewed = useListReviewedApplicationsQuery();
    const source = view === 'queue' ? pending : reviewed;

    const range: DateRangeValue = {
        range: filters.range as DateRangeValue['range'],
        from: filters.from || undefined,
        to: filters.to || undefined,
    };
    const resolved = resolveRange(range);

    const rows = useMemo(
        () =>
            (source.data ?? []).filter(
                (a) =>
                    matches(a, filters.q) &&
                    (filters.status === 'all' || a.status === filters.status) &&
                    (filters.service === 'all' ||
                        a.services.includes(filters.service as ServiceKey)) &&
                    inRange(a.submittedAt, resolved)
            ),
        // resolved is derived from the filter strings below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            source.data,
            filters.q,
            filters.status,
            filters.service,
            filters.range,
            filters.from,
            filters.to,
        ]
    );

    const activeFilters =
        Number(Boolean(filters.q)) +
        Number(filters.status !== 'all') +
        Number(filters.service !== 'all') +
        Number(filters.range !== 'all');

    const columns = useMemo<ColumnDef<Application>[]>(() => {
        const applicant: ColumnDef<Application> = {
            id: 'applicant',
            header: 'Applicant',
            accessorFn: (a) => a.name,
            cell: ({ row }) => <ApplicantCell application={row.original} />,
            meta: { alwaysVisible: true, csv: (a) => a.name },
        };
        const email: ColumnDef<Application> = {
            id: 'email',
            header: 'Email',
            accessorFn: (a) => a.email,
        };
        const services: ColumnDef<Application> = {
            id: 'services',
            header: 'Services',
            accessorFn: (a) => a.services.length,
            cell: ({ row }) => <ServiceList services={row.original.services} compact />,
            meta: { csv: csvCommon.services },
        };
        const place: ColumnDef<Application> = {
            id: 'place',
            header: 'Location',
            accessorFn: (a) => a.place,
            cell: ({ row }) => (
                <Box
                    component="span"
                    title={row.original.place}
                    sx={{
                        display: 'block',
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {row.original.place}
                </Box>
            ),
        };
        const phone: ColumnDef<Application> = {
            id: 'phone',
            header: 'Phone',
            accessorFn: (a) => a.phone,
            enableSorting: false,
        };
        const submitted: ColumnDef<Application> = {
            id: 'submitted',
            header: 'Submitted',
            accessorFn: (a) => new Date(a.submittedAt).getTime(),
            cell: ({ row }) => formatDate(row.original.submittedAt),
            meta: { csv: (a) => formatDateTime(a.submittedAt) },
        };
        if (view === 'queue') {
            return [
                applicant,
                email,
                services,
                place,
                phone,
                submitted,
                {
                    id: 'waiting',
                    header: 'Waiting',
                    accessorFn: (a) => now - new Date(a.submittedAt).getTime(),
                    cell: ({ row }) => <WaitMeter since={row.original.submittedAt} now={now} />,
                    meta: {
                        width: 150,
                        csv: (a) => formatDuration(now - new Date(a.submittedAt).getTime()),
                    },
                },
            ];
        }
        return [
            applicant,
            email,
            services,
            place,
            phone,
            submitted,
            {
                id: 'status',
                header: 'Decision',
                accessorFn: (a) => a.status,
                cell: ({ row }) => <ApplicationStatusPill status={row.original.status} />,
                meta: { csv: (a) => STATUS_META[a.status].label },
            },
            {
                id: 'reason',
                header: 'Reason given',
                accessorFn: (a) => a.rejectReason,
                cell: ({ row }) => row.original.rejectReason || '',
                enableSorting: false,
            },
        ];
    }, [view, now]);

    const copyEmails = async (selected: Application[], clear: () => void) => {
        try {
            await navigator.clipboard.writeText(selected.map((a) => a.email).join(', '));
            toast.success(
                `Copied ${selected.length} email ${selected.length === 1 ? 'address' : 'addresses'}`
            );
            clear();
        } catch {
            toast.error(
                'The browser blocked the clipboard. Select the emails from the table instead.'
            );
        }
    };

    const emptyState =
        activeFilters > 0 ? (
            <EmptyState
                bare
                icon={<SearchIcon />}
                title="No applications match these filters"
                description="Change or clear the filters to see more."
                action={
                    <Button variant="outlined" onClick={resetFilters}>
                        Clear filters
                    </Button>
                }
            />
        ) : view === 'queue' ? (
            <EmptyState
                bare
                icon={<ApplicationsIcon />}
                title="No applications are waiting"
                description="New applications from the provider app appear here as soon as they are submitted."
                action={
                    <Button variant="outlined" onClick={() => setFilters({ view: 'history' })}>
                        See reviewed applications
                    </Button>
                }
            />
        ) : (
            <EmptyState
                bare
                icon={<ApplicationsIcon />}
                title="No applications have been reviewed yet"
            />
        );

    return (
        <>
            <PageHeader
                title="Provider applications"
                subtitle="Check each applicant's documents, then approve them to start taking jobs or reject with a reason."
            />
            <Tabs
                value={view}
                onChange={(_, v: View) => setFilters({ view: v, status: 'all' })}
                aria-label="Application lists"
                sx={{ borderBottom: hairline, mb: 2 }}
            >
                <Tab
                    value="queue"
                    label={
                        <Box
                            component="span"
                            sx={{ display: 'inline-flex', gap: 0.75, alignItems: 'center' }}
                        >
                            Waiting for review
                            {pending.data && <Count value={pending.data.length} />}
                        </Box>
                    }
                />
                <Tab
                    value="history"
                    label={
                        <Box
                            component="span"
                            sx={{ display: 'inline-flex', gap: 0.75, alignItems: 'center' }}
                        >
                            Reviewed
                            {reviewed.data && <Count value={reviewed.data.length} />}
                        </Box>
                    }
                />
            </Tabs>
            <DataTable<Application>
                key={view}
                label={
                    view === 'queue' ? 'Applications waiting for review' : 'Reviewed applications'
                }
                tableId={`applications-${view}`}
                data={rows}
                columns={columns}
                getRowId={(a) => a.id}
                loading={source.isLoading}
                error={source.error}
                onRetry={source.refetch}
                empty={emptyState}
                initialSorting={
                    view === 'queue'
                        ? [{ id: 'waiting', desc: true }]
                        : [{ id: 'submitted', desc: true }]
                }
                initialColumnVisibility={{ email: false, phone: view === 'queue' }}
                enableSelection
                selectionActions={(selected, clear) => (
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<CopyTextIcon />}
                        onClick={() => copyEmails(selected, clear)}
                    >
                        Copy emails
                    </Button>
                )}
                onRowActivate={(a) => navigate(`/applications/${a.id}`, { state: { from: view } })}
                csvFilename={view === 'queue' ? 'applications-waiting' : 'applications-reviewed'}
                toolbar={
                    <FilterBar
                        activeCount={activeFilters}
                        onClear={resetFilters}
                        summary={
                            source.data
                                ? rows.length === source.data.length
                                    ? `${rows.length} ${rows.length === 1 ? 'application' : 'applications'}`
                                    : `${rows.length} of ${source.data.length}`
                                : undefined
                        }
                    >
                        <SearchField
                            value={filters.q}
                            onChange={(q) => setFilters({ q })}
                            placeholder="Search applicants"
                            label="Search applications"
                        />
                        {view === 'history' && (
                            <SelectFilter
                                label="Decision"
                                value={filters.status}
                                onChange={(status) => setFilters({ status })}
                                options={[
                                    { value: 'all', label: 'Any' },
                                    { value: 'approved', label: 'Approved' },
                                    { value: 'rejected', label: 'Rejected' },
                                ]}
                                minWidth={140}
                            />
                        )}
                        <SelectFilter
                            label="Service"
                            value={filters.service}
                            onChange={(service) => setFilters({ service })}
                            options={[
                                { value: 'all', label: 'Any' },
                                ...SERVICE_KEYS.map((k) => ({
                                    value: k,
                                    label: SERVICES[k].label,
                                })),
                            ]}
                            minWidth={150}
                        />
                        <DateRangeField
                            label="Submitted"
                            value={range}
                            onChange={(v) =>
                                setFilters({ range: v.range, from: v.from ?? '', to: v.to ?? '' })
                            }
                        />
                    </FilterBar>
                }
            />
        </>
    );
}
