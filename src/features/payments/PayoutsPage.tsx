import { useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';
import { EmptyState, PageHeader } from '@/components/ui';
import { PayoutsIcon, SearchIcon } from '@/components/ui/icons';
import {
    DataTable,
    DateRangeField,
    FilterBar,
    SelectFilter,
    type DateRangeValue,
} from '@/components/data';
import { PAYOUT_STATUS, isObjectId } from '@/features/ops/model';
import { AmountRangeFilter, FilterChip } from '@/features/ops/filters';
import { fetchAllPages } from '@/lib/exportAll';
import { useDocumentTitle, useUrlState } from '@/lib/hooks';
import { rangeParams, sortParamFrom, sortingFromParam } from '@/lib/listQuery';
import { useLazyListPayoutsQuery, useListPayoutsQuery, type PayoutListItem } from './api';
import { usePayoutColumns } from './columns';

const PAGE_SIZE = 25;
const DEFAULTS = {
    status: 'all',
    providerId: '',
    amountMin: '',
    amountMax: '',
    range: 'all',
    from: '',
    to: '',
    sort: '-createdAt',
    page: '0',
};

/** Every payout: money a provider moved from their balance to their bank account or card. */
export default function PayoutsPage() {
    useDocumentTitle('Payouts');
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
        amountMin: f.amountMin,
        amountMax: f.amountMax,
        ...rangeParams(range),
    };
    const list = useListPayoutsQuery({ ...params, page: pageIndex + 1, pageSize: PAGE_SIZE });
    const [fetchPage] = useLazyListPayoutsQuery();
    const columns = usePayoutColumns();
    const filter = (patch: Partial<typeof DEFAULTS>) => setF({ ...patch, page: '0' });
    const active =
        Number(f.status !== 'all') +
        Number(Boolean(f.providerId)) +
        Number(Boolean(f.amountMin || f.amountMax)) +
        Number(f.range !== 'all');
    const providerName = list.data?.items.find((e) => e.provider?._id === f.providerId)?.provider
        ?.name;
    const total = list.data?.total;

    return (
        <>
            <PageHeader
                title="Payouts"
                subtitle="Money providers moved from their HelpHive balance to their bank account or card, through Stripe."
            />
            <DataTable<PayoutListItem>
                label="Payouts"
                tableId="payouts"
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
                initialColumnVisibility={{ payoutId: false }}
                onRowActivate={(e) => navigate(`/payouts/${e._id}`)}
                csvFilename="payouts"
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
                            title="No payouts match these filters"
                            action={
                                <Button variant="outlined" onClick={resetF}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState bare icon={<PayoutsIcon />} title="No payouts yet" />
                    )
                }
                toolbar={
                    <FilterBar
                        activeCount={active}
                        onClear={resetF}
                        summary={
                            total !== undefined
                                ? `${total} ${total === 1 ? 'payout' : 'payouts'}`
                                : undefined
                        }
                    >
                        {f.providerId && (
                            <FilterChip
                                label={`Provider: ${providerName ?? f.providerId.slice(-6)}`}
                                onClear={() => filter({ providerId: '' })}
                            />
                        )}
                        <SelectFilter
                            label="Status"
                            value={f.status}
                            onChange={(status) => filter({ status })}
                            options={[
                                { value: 'all', label: 'Any' },
                                ...Object.entries(PAYOUT_STATUS).map(([value, m]) => ({
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
                            label="Requested"
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
