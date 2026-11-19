import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Link } from '@mui/material';
import { EmptyState, Panel } from '@/components/ui';
import { EarningsIcon, PayoutsIcon } from '@/components/ui/icons';
import { DataTable } from '@/components/data';
import { useEarningColumns, usePayoutColumns } from './columns';
import {
    useListEarningsQuery,
    useListPayoutsQuery,
    type EarningRecord,
    type PayoutListItem,
} from './api';

const PAGE = 10;

/** One provider's earnings, ten at a time, for record pages. */
export function EarningsTable({
    providerId,
    title,
    compact,
}: {
    providerId: string;
    title: string;
    compact?: boolean;
}) {
    const navigate = useNavigate();
    const [page, setPage] = useState(0);
    const list = useListEarningsQuery({
        page: page + 1,
        pageSize: PAGE,
        providerId,
        sort: '-createdAt',
    });
    const columns = useEarningColumns(true);
    return (
        <Panel
            title={title}
            flush
            actions={
                <Link
                    component={RouterLink}
                    to={`/earnings?providerId=${providerId}`}
                    sx={{ fontWeight: 700 }}
                >
                    Open in earnings
                </Link>
            }
        >
            <Box sx={{ '& > div': { border: 0, borderRadius: 0 } }}>
                <DataTable<EarningRecord>
                    label={title}
                    tableId={compact ? 'earnings-compact' : 'earnings-embedded'}
                    data={list.data?.items ?? []}
                    columns={columns}
                    getRowId={(e) => e._id}
                    loading={list.isLoading}
                    error={list.error}
                    onRetry={list.refetch}
                    manualSorting
                    pagination={{
                        mode: 'server',
                        pageIndex: page,
                        pageSize: PAGE,
                        rowCount: list.data?.total ?? 0,
                        onChange: (p) => setPage(p.pageIndex),
                        pageSizeOptions: [PAGE],
                    }}
                    initialColumnVisibility={{ transferId: false, platformFee: false }}
                    onRowActivate={(e) => navigate(`/earnings/${e._id}`)}
                    maxHeight="none"
                    empty={
                        <EmptyState
                            bare
                            icon={<EarningsIcon />}
                            title="No earnings yet"
                            sx={{ py: 3 }}
                        />
                    }
                />
            </Box>
        </Panel>
    );
}

/** One provider's payouts, ten at a time, for record pages. */
export function PayoutsTable({
    providerId,
    title,
    compact,
}: {
    providerId: string;
    title: string;
    compact?: boolean;
}) {
    const navigate = useNavigate();
    const [page, setPage] = useState(0);
    const list = useListPayoutsQuery({
        page: page + 1,
        pageSize: PAGE,
        providerId,
        sort: '-createdAt',
    });
    const columns = usePayoutColumns(true);
    return (
        <Panel
            title={title}
            flush
            actions={
                <Link
                    component={RouterLink}
                    to={`/payouts?providerId=${providerId}`}
                    sx={{ fontWeight: 700 }}
                >
                    Open in payouts
                </Link>
            }
        >
            <Box sx={{ '& > div': { border: 0, borderRadius: 0 } }}>
                <DataTable<PayoutListItem>
                    label={title}
                    tableId={compact ? 'payouts-compact' : 'payouts-embedded'}
                    data={list.data?.items ?? []}
                    columns={columns}
                    getRowId={(p) => p._id}
                    loading={list.isLoading}
                    error={list.error}
                    onRetry={list.refetch}
                    manualSorting
                    pagination={{
                        mode: 'server',
                        pageIndex: page,
                        pageSize: PAGE,
                        rowCount: list.data?.total ?? 0,
                        onChange: (p) => setPage(p.pageIndex),
                        pageSizeOptions: [PAGE],
                    }}
                    initialColumnVisibility={{ payoutId: false }}
                    onRowActivate={(p) => navigate(`/payouts/${p._id}`)}
                    maxHeight="none"
                    empty={
                        <EmptyState
                            bare
                            icon={<PayoutsIcon />}
                            title="No payouts yet"
                            sx={{ py: 3 }}
                        />
                    }
                />
            </Box>
        </Panel>
    );
}
