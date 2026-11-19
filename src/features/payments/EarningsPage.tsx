import { useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';
import { EmptyState, PageHeader } from '@/components/ui';
import { EarningsIcon, SearchIcon } from '@/components/ui/icons';
import {
    DataTable,
    DateRangeField,
    FilterBar,
    SelectFilter,
    type DateRangeValue,
} from '@/components/data';
import { EARNING_STATUS, isObjectId, referenceOf } from '@/features/ops/model';
import { AmountRangeFilter, FilterChip } from '@/features/ops/filters';
import { fetchAllPages } from '@/lib/exportAll';
import { useDocumentTitle, useUrlState } from '@/lib/hooks';
import { rangeParams, sortParamFrom, sortingFromParam } from '@/lib/listQuery';
import { useLazyListEarningsQuery, useListEarningsQuery, type EarningRecord } from './api';
import { useEarningColumns } from './columns';

const PAGE_SIZE = 25;
const DEFAULTS = {
    status: 'all',
    providerId: '',
    bookingId: '',
    amountMin: '',
    amountMax: '',
    range: 'all',
    from: '',
    to: '',
    sort: '-createdAt',
    page: '0',
};

/** Every provider earning: 95 % of a completed booking, released to Stripe about 30 s later. */
export default function EarningsPage() {
    useDocumentTitle('Earnings');
    const navigate = useNavigate();
    const [f, setF, resetF] = useUrlState(DEFAULTS);
    const pageIndex = Math.max(0, Number(f.page) || 0);
    const range: DateRangeValue = {
        range: f.range as DateRangeValue['range'],
        from: f.from || undefined,
        to: f.to || undefined,
    };
    const params = {
        sort: f.sort,
        status: f.status,
        providerId: isObjectId(f.providerId) ? f.providerId : '',
        bookingId: isObjectId(f.bookingId) ? f.bookingId : '',
        amountMin: f.amountMin,
        amountMax: f.amountMax,
        ...rangeParams(range),
    };
    const list = useListEarningsQuery({ ...params, page: pageIndex + 1, pageSize: PAGE_SIZE });
    const [fetchPage] = useLazyListEarningsQuery();
    const columns = useEarningColumns();
    const filter = (patch: Partial<typeof DEFAULTS>) => setF({ ...patch, page: '0' });
    const active =
        Number(f.status !== 'all') +
        Number(Boolean(f.providerId)) +
        Number(Boolean(f.bookingId)) +
        Number(Boolean(f.amountMin || f.amountMax)) +
        Number(f.range !== 'all');
    const providerName = list.data?.items.find((e) => e.provider?._id === f.providerId)?.provider
        ?.name;
    const total = list.data?.total;

    return (
        <>
            <PageHeader
                title="Earnings"
                subtitle="What providers earn from completed bookings (95 %), and whether it has been released to their Stripe account."
            />
            <DataTable<EarningRecord>
                label="Earnings"
                tableId="earnings"
                data={list.data?.items ?? []}
                columns={columns}
                getRowId={(e) => e._id}
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
                initialColumnVisibility={{ transferId: false }}
                onRowActivate={(e) => navigate(`/earnings/${e._id}`)}
                csvFilename="earnings"
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
                            title="No earnings match these filters"
                            action={
                                <Button variant="outlined" onClick={resetF}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState bare icon={<EarningsIcon />} title="No earnings yet" />
                    )
                }
                toolbar={
                    <FilterBar
                        activeCount={active}
                        onClear={resetF}
                        summary={
                            total !== undefined
                                ? `${total} ${total === 1 ? 'earning' : 'earnings'}`
                                : undefined
                        }
                    >
                        {f.providerId && (
                            <FilterChip
                                label={`Provider: ${providerName ?? f.providerId.slice(-6)}`}
                                onClear={() => filter({ providerId: '' })}
                            />
                        )}
                        {f.bookingId && (
                            <FilterChip
                                label={`Booking ${isObjectId(f.bookingId) ? referenceOf(f.bookingId) : f.bookingId}`}
                                onClear={() => filter({ bookingId: '' })}
                            />
                        )}
                        <SelectFilter
                            label="Status"
                            value={f.status}
                            onChange={(status) => filter({ status })}
                            options={[
                                { value: 'all', label: 'Any' },
                                ...Object.entries(EARNING_STATUS).map(([value, m]) => ({
                                    value,
                                    label: m.label,
                                })),
                            ]}
                            minWidth={160}
                        />
                        <AmountRangeFilter
                            min={f.amountMin}
                            max={f.amountMax}
                            onChange={({ min, max }) => filter({ amountMin: min, amountMax: max })}
                        />
                        <DateRangeField
                            label="Created"
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
