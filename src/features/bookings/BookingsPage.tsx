import { useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';
import { EmptyState, PageHeader } from '@/components/ui';
import { BookingsIcon, SearchIcon } from '@/components/ui/icons';
import {
    DataTable,
    DateRangeField,
    FilterBar,
    SearchField,
    SelectFilter,
    type DateRangeValue,
} from '@/components/data';
import { AmountRangeFilter, FilterChip } from '@/features/ops/filters';
import {
    BOOKING_STATUS,
    DISPLAY_STATUS,
    REFUND_STATE_OPTIONS,
    SERVICE_OPTIONS,
    isObjectId,
} from '@/features/ops/model';
import { fetchAllPages } from '@/lib/exportAll';
import { useDocumentTitle, useUrlState } from '@/lib/hooks';
import { rangeParams, sortParamFrom, sortingFromParam } from '@/lib/listQuery';
import { useLazyListBookingsQuery, useListBookingsQuery, type BookingListItem } from './api';
import { useBookingColumns } from './columns';

const PAGE_SIZE = 25;
const DEFAULTS = {
    q: '',
    displayStatus: 'all',
    status: 'all',
    service: 'all',
    hasProvider: 'all',
    paymentState: 'all',
    refundState: 'all',
    customerId: '',
    providerId: '',
    amountMin: '',
    amountMax: '',
    range: 'all',
    from: '',
    to: '',
    start: 'all',
    startFrom: '',
    startTo: '',
    done: 'all',
    completedFrom: '',
    completedTo: '',
    sort: '-createdAt',
    page: '0',
};

const option = (map: Record<string, { label: string }>) => [
    { value: 'all', label: 'Any' },
    ...Object.entries(map).map(([value, m]) => ({ value, label: m.label })),
];

const range = (r: string, from: string, to: string): DateRangeValue => ({
    range: r as DateRangeValue['range'],
    from: from || undefined,
    to: to || undefined,
});

export default function BookingsPage() {
    useDocumentTitle('Bookings');
    const navigate = useNavigate();
    const [f, setF, resetF] = useUrlState(DEFAULTS);
    const pageIndex = Math.max(0, Number(f.page) || 0);
    const created = range(f.range, f.from, f.to);
    const start = range(f.start, f.startFrom, f.startTo);
    const done = range(f.done, f.completedFrom, f.completedTo);
    const startP = rangeParams(start);
    const doneP = rangeParams(done);

    const params = {
        sort: f.sort,
        q: f.q.trim(),
        displayStatus: f.displayStatus,
        status: f.status,
        service: f.service,
        hasProvider: f.hasProvider,
        paymentState: f.paymentState,
        refundState: f.refundState,
        customerId: isObjectId(f.customerId) ? f.customerId : '',
        providerId: isObjectId(f.providerId) ? f.providerId : '',
        amountMin: f.amountMin,
        amountMax: f.amountMax,
        ...rangeParams(created),
        startFrom: startP.from,
        startTo: startP.to,
        completedFrom: doneP.from,
        completedTo: doneP.to,
    };
    const list = useListBookingsQuery({ ...params, page: pageIndex + 1, pageSize: PAGE_SIZE });
    const [fetchPage] = useLazyListBookingsQuery();
    const columns = useBookingColumns();
    const filter = (patch: Partial<typeof DEFAULTS>) => setF({ ...patch, page: '0' });

    const active =
        Number(Boolean(f.q)) +
        Number(f.displayStatus !== 'all') +
        Number(f.status !== 'all') +
        Number(f.service !== 'all') +
        Number(f.hasProvider !== 'all') +
        Number(f.paymentState !== 'all') +
        Number(f.refundState !== 'all') +
        Number(Boolean(f.customerId)) +
        Number(Boolean(f.providerId)) +
        Number(Boolean(f.amountMin || f.amountMax)) +
        Number(f.range !== 'all') +
        Number(f.start !== 'all') +
        Number(f.done !== 'all');

    const items = list.data?.items ?? [];
    const customerName = items.find((b) => b.customer?._id === f.customerId)?.customer?.name;
    const providerName = items.find((b) => b.provider?._id === f.providerId)?.provider?.name;
    const total = list.data?.total;

    return (
        <>
            <PageHeader
                title="Bookings"
                subtitle="Every shift booked on HelpHive, with who is working it, the money and what happened."
            />
            <DataTable<BookingListItem>
                label="Bookings"
                tableId="bookings"
                data={items}
                columns={columns}
                getRowId={(b) => b._id}
                loading={list.isLoading}
                error={list.error}
                onRetry={list.refetch}
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
                    service: false,
                    hours: false,
                    completedAt: false,
                    cancelledAt: false,
                    address: false,
                    id: false,
                }}
                onRowActivate={(b) => navigate(`/bookings/${b._id}`)}
                csvFilename="bookings"
                exportAllRows={() =>
                    fetchAllPages((page, pageSize) =>
                        fetchPage({ ...params, page, pageSize }, true).unwrap()
                    )
                }
                empty={
                    active ? (
                        <EmptyState
                            bare
                            icon={<SearchIcon />}
                            title="No bookings match these filters"
                            description="Search takes a receipt number (HH-…), a booking id, a customer's or provider's name, email or phone (from the start), or the start of the address."
                            action={
                                <Button variant="outlined" onClick={resetF}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState bare icon={<BookingsIcon />} title="No bookings yet" />
                    )
                }
                toolbar={
                    <FilterBar
                        activeCount={active}
                        onClear={resetF}
                        summary={
                            total !== undefined
                                ? `${total} ${total === 1 ? 'booking' : 'bookings'}`
                                : undefined
                        }
                    >
                        <SearchField
                            value={f.q}
                            onChange={(q) => filter({ q })}
                            placeholder="Receipt, person or address"
                            label="Search bookings"
                        />
                        {f.customerId && (
                            <FilterChip
                                label={`Customer: ${customerName ?? f.customerId.slice(-6)}`}
                                onClear={() => filter({ customerId: '' })}
                            />
                        )}
                        {f.providerId && (
                            <FilterChip
                                label={`Provider: ${providerName ?? f.providerId.slice(-6)}`}
                                onClear={() => filter({ providerId: '' })}
                            />
                        )}
                        <SelectFilter
                            label="Status"
                            value={f.displayStatus}
                            onChange={(displayStatus) => filter({ displayStatus })}
                            options={option(DISPLAY_STATUS)}
                            minWidth={170}
                        />
                        <SelectFilter
                            label="Stored status"
                            value={f.status}
                            onChange={(status) => filter({ status })}
                            options={option(BOOKING_STATUS)}
                            minWidth={170}
                        />
                        <SelectFilter
                            label="Service"
                            value={f.service}
                            onChange={(service) => filter({ service })}
                            options={SERVICE_OPTIONS}
                            minWidth={170}
                        />
                        <SelectFilter
                            label="Provider"
                            value={f.hasProvider}
                            onChange={(hasProvider) => filter({ hasProvider })}
                            options={[
                                { value: 'all', label: 'Any' },
                                { value: 'true', label: 'Assigned' },
                                { value: 'false', label: 'Not assigned' },
                            ]}
                            minWidth={150}
                        />
                        <SelectFilter
                            label="Payment"
                            value={f.paymentState}
                            onChange={(paymentState) => filter({ paymentState })}
                            options={[
                                { value: 'all', label: 'Any' },
                                { value: 'paid', label: 'Paid' },
                                { value: 'pending', label: 'Awaiting payment' },
                                { value: 'unpaid', label: 'Not paid' },
                                { value: 'cancelled', label: 'Cancelled' },
                            ]}
                            minWidth={150}
                        />
                        <SelectFilter
                            label="Refund"
                            value={f.refundState}
                            onChange={(refundState) => filter({ refundState })}
                            options={REFUND_STATE_OPTIONS}
                            minWidth={150}
                        />
                        <AmountRangeFilter
                            min={f.amountMin}
                            max={f.amountMax}
                            onChange={({ min, max }) => filter({ amountMin: min, amountMax: max })}
                        />
                        <DateRangeField
                            label="Shift"
                            value={start}
                            onChange={(v) =>
                                filter({
                                    start: v.range,
                                    startFrom: v.from ?? '',
                                    startTo: v.to ?? '',
                                })
                            }
                        />
                        <DateRangeField
                            label="Booked"
                            value={created}
                            onChange={(v) =>
                                filter({ range: v.range, from: v.from ?? '', to: v.to ?? '' })
                            }
                        />
                        <DateRangeField
                            label="Completed"
                            value={done}
                            onChange={(v) =>
                                filter({
                                    done: v.range,
                                    completedFrom: v.from ?? '',
                                    completedTo: v.to ?? '',
                                })
                            }
                        />
                    </FilterBar>
                }
            />
        </>
    );
}
