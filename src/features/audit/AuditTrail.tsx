import { Link as RouterLink } from 'react-router-dom';
import { Box, Link, Skeleton } from '@mui/material';
import { EmptyState, ErrorState, Panel, StatusPill } from '@/components/ui';
import { AuditIcon, ChevronRightIcon } from '@/components/ui/icons';
import { getErrorMessage } from '@/lib/api';
import { formatAgo, formatDateTime } from '@/lib/format';
import { listQueryString } from '@/lib/listQuery';
import { useNow } from '@/lib/hooks';
import { color, font, hairline } from '@/theme/tokens';
import { useListAuditQuery } from './api';
import { actionLabel, actorName, OUTCOME_META } from './model';

export interface AuditTrailProps {
    title?: string;
    subtitle?: string;
    /** Entries about this record... */
    targetType?: string;
    targetId?: string;
    /** ...or entries by this admin (id or email). */
    actor?: string;
    limit?: number;
}

/**
 * The latest audit entries about one record (or by one admin), newest first, each linking to its
 * entry, with a link to the full filtered log. For record pages; needs `audit.read`.
 */
export default function AuditTrail({
    title = 'Audit trail',
    subtitle,
    targetType,
    targetId,
    actor,
    limit = 8,
}: AuditTrailProps) {
    const now = useNow();
    const filters = { targetType, targetId, actor };
    const list = useListAuditQuery({ page: 1, pageSize: limit, sort: '-at', ...filters });
    const total = list.data?.total ?? 0;
    const fullLog = `/audit${listQueryString(filters)}`;

    return (
        <Panel
            title={title}
            subtitle={subtitle}
            flush
            actions={
                <Link component={RouterLink} to={fullLog} sx={{ fontWeight: 700 }}>
                    Open in audit log
                </Link>
            }
            footer={
                total > limit ? (
                    <>
                        <span>
                            Latest {limit} of {total}
                        </span>
                        <Link component={RouterLink} to={fullLog} sx={{ fontWeight: 700 }}>
                            See all {total}
                        </Link>
                    </>
                ) : undefined
            }
        >
            {list.isLoading ? (
                <Box sx={{ p: 2 }} role="status" aria-label="Loading audit entries">
                    {[0, 1, 2].map((i) => (
                        <Skeleton key={i} height={36} />
                    ))}
                </Box>
            ) : list.error ? (
                <ErrorState
                    bare
                    title="Could not load the audit trail"
                    message={getErrorMessage(list.error, 'The API did not answer.')}
                    onRetry={list.refetch}
                    retrying={list.isFetching}
                />
            ) : !list.data?.items.length ? (
                <EmptyState
                    bare
                    icon={<AuditIcon />}
                    title="Nothing recorded yet"
                    description="Actions taken from now on appear here. Actions from before the audit log existed were not recorded."
                    sx={{ py: { xs: 3, sm: 4 } }}
                />
            ) : (
                <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label={title}>
                    {list.data.items.map((e) => (
                        <Box component="li" key={e._id} sx={{ '& + &': { borderTop: hairline } }}>
                            <Box
                                component={RouterLink}
                                to={`/audit/${e._id}`}
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(0, 1fr) auto 16px',
                                    alignItems: 'center',
                                    gap: 1.5,
                                    px: { xs: 2, sm: 2.5 },
                                    py: 1.25,
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    '&:hover': { bgcolor: color.subtle },
                                    '&:focus-visible': { outlineOffset: -2 },
                                }}
                            >
                                <Box sx={{ minWidth: 0 }}>
                                    <Box
                                        sx={{
                                            fontWeight: 700,
                                            color: color.ink900,
                                            fontSize: font.size.md,
                                        }}
                                    >
                                        {actionLabel(e.action)}
                                    </Box>
                                    <Box
                                        sx={{
                                            fontSize: font.size.xs,
                                            fontWeight: 600,
                                            color: color.ink500,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {actorName(e.actor)}
                                        <Box
                                            component="span"
                                            title={formatDateTime(e.at)}
                                            sx={{ ml: 1 }}
                                        >
                                            {formatAgo(e.at, now)}
                                        </Box>
                                    </Box>
                                </Box>
                                {e.outcome === 'failure' ? (
                                    <StatusPill tone={OUTCOME_META.failure.tone}>
                                        {OUTCOME_META.failure.label}
                                    </StatusPill>
                                ) : (
                                    <span />
                                )}
                                <ChevronRightIcon size={16} style={{ color: color.ink300 }} />
                            </Box>
                        </Box>
                    ))}
                </Box>
            )}
        </Panel>
    );
}
