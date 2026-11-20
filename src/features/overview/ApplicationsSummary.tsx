import { Link as RouterLink } from 'react-router-dom';
import { Box, Link, Skeleton } from '@mui/material';
import { EmptyState, ErrorState, Panel } from '@/components/ui';
import { KpiRow, KpiTile } from '@/components/data';
import { ApplicationsIcon } from '@/components/ui/icons';
import { useAllApplications } from '@/features/applications/api';
import { ApplicantCell, WaitMeter } from '@/features/applications/parts';
import { getErrorMessage } from '@/lib/api';
import { formatDuration } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { hairline, hoverRow } from '@/theme/tokens';

/** The provider-application queue in brief: how many wait, the oldest, and who waits longest. */
export default function ApplicationsSummary() {
    const now = useNow();
    const { all, isLoading, error, refetch, isFetching } = useAllApplications();
    const waiting = all
        .filter((a) => a.status === 'pending')
        .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    const month = all.filter(
        (a) => now - new Date(a.submittedAt).getTime() < 30 * 86_400_000
    ).length;

    return (
        <Panel
            title="Provider applications"
            flush
            actions={
                <Link component={RouterLink} to="/applications" sx={{ fontWeight: 700 }}>
                    Review queue
                </Link>
            }
        >
            {isLoading ? (
                <Box sx={{ p: 2 }}>
                    <Skeleton height={64} />
                    <Skeleton height={36} />
                </Box>
            ) : error && !all.length ? (
                <ErrorState
                    bare
                    title="Could not load applications"
                    message={getErrorMessage(error, 'The API did not answer.')}
                    onRetry={refetch}
                    retrying={isFetching}
                />
            ) : (
                <>
                    <Box sx={{ '& > [role=group]': { border: 0, borderRadius: 0 } }}>
                        <KpiRow columns={3} aria-label="Applications">
                            <KpiTile label="Waiting" value={waiting.length} to="/applications" />
                            <KpiTile
                                label="Oldest waiting"
                                value={
                                    waiting[0]
                                        ? formatDuration(
                                              now - new Date(waiting[0].submittedAt).getTime()
                                          )
                                        : 'None'
                                }
                                to={waiting[0] ? `/applications/${waiting[0].id}` : undefined}
                            />
                            <KpiTile
                                label="Received, 30 days"
                                value={month}
                                to="/applications/insights"
                            />
                        </KpiRow>
                    </Box>
                    {waiting.length ? (
                        <Box
                            component="ol"
                            sx={{ listStyle: 'none', m: 0, p: 0, borderTop: hairline }}
                        >
                            {waiting.slice(0, 5).map((a, i) => (
                                <Box component="li" key={a.id} sx={{ borderTop: i ? hairline : 0 }}>
                                    <Box
                                        component={RouterLink}
                                        to={`/applications/${a.id}`}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 1.5,
                                            px: 2,
                                            py: 1.25,
                                            color: 'inherit',
                                            textDecoration: 'none',
                                            '&:hover': hoverRow,
                                            '&:focus-visible': { outlineOffset: -2 },
                                        }}
                                    >
                                        <ApplicantCell application={a} />
                                        <WaitMeter since={a.submittedAt} now={now} />
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    ) : (
                        <EmptyState
                            bare
                            icon={<ApplicationsIcon />}
                            title="Nothing is waiting"
                            description="New applications show up here, oldest first."
                            sx={{ py: { xs: 3, sm: 3 }, borderTop: hairline }}
                        />
                    )}
                </>
            )}
        </Panel>
    );
}
