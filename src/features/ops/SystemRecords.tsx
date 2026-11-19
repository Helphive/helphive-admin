// Stripe webhook deliveries and Cloud Tasks runs about a record: the plumbing behind money moving.
import { Box } from '@mui/material';
import { EmptyState, Panel, StatusPill, type Tone } from '@/components/ui';
import { ActivityIcon } from '@/components/ui/icons';
import { DataTable } from '@/components/data';
import type { TaskRun } from '@/features/bookings/api';
import type { WebhookEvent } from '@/features/payments/api';
import { formatDateTime } from '@/lib/format';
import { color, font } from '@/theme/tokens';
import { Muted, StripeId } from './parts';

const OUTCOME_TONE: Record<string, Tone> = {
    processed: 'green',
    received: 'blue',
    ignored: 'grey',
    skipped: 'grey',
    failed: 'red',
    rejected: 'red',
};

function Outcome({ value }: { value: string | null }) {
    if (!value) return <Muted>Unknown</Muted>;
    return (
        <StatusPill tone={OUTCOME_TONE[value] ?? 'grey'}>
            {value.charAt(0).toUpperCase() + value.slice(1)}
        </StatusPill>
    );
}

function Detail({ note, error }: { note: string | null; error: string | null }) {
    if (!note && !error) return null;
    return (
        <Box
            sx={{
                fontSize: font.size.xs,
                fontWeight: 600,
                color: error ? color.red700 : color.ink500,
                maxWidth: 360,
                whiteSpace: 'normal',
            }}
        >
            {error ?? note}
        </Box>
    );
}

export function WebhookEventsPanel({
    events,
    subtitle = 'Stripe deliveries about this record, newest first. Recorded from the Operations release on; older records have none.',
}: {
    events: WebhookEvent[];
    subtitle?: string;
}) {
    return (
        <Panel title="Stripe webhooks" subtitle={subtitle} flush>
            <Box sx={{ '& > div': { border: 0, borderRadius: 0 } }}>
                <DataTable<WebhookEvent>
                    label="Stripe webhooks"
                    data={events}
                    getRowId={(e) => e.eventId}
                    pagination={{ mode: 'none' }}
                    maxHeight="none"
                    columns={[
                        {
                            id: 'type',
                            header: 'Event',
                            accessorFn: (e) => e.type,
                            cell: ({ row }) => (
                                <Box>
                                    <Box sx={{ fontWeight: 700 }}>{row.original.type}</Box>
                                    <Box sx={{ fontSize: font.size.xs }}>
                                        <StripeId kind="event" id={row.original.eventId} />
                                    </Box>
                                </Box>
                            ),
                        },
                        {
                            id: 'outcome',
                            header: 'Outcome',
                            accessorFn: (e) => e.outcome,
                            cell: ({ row }) => (
                                <Box>
                                    <Outcome value={row.original.outcome} />
                                    <Detail note={row.original.note} error={row.original.error} />
                                </Box>
                            ),
                        },
                        {
                            id: 'endpoint',
                            header: 'Endpoint',
                            accessorFn: (e) =>
                                e.endpoint === 'connected' ? 'Connected accounts' : 'Platform',
                        },
                        {
                            id: 'receivedAt',
                            header: 'Received',
                            accessorFn: (e) => e.receivedAt,
                            cell: ({ row }) => formatDateTime(row.original.receivedAt),
                        },
                        {
                            id: 'deliveries',
                            header: 'Deliveries',
                            accessorFn: (e) => e.deliveries,
                            meta: { align: 'right' },
                        },
                    ]}
                    empty={
                        <EmptyState
                            bare
                            icon={<ActivityIcon />}
                            title="No webhook deliveries recorded"
                            sx={{ py: 3 }}
                        />
                    }
                />
            </Box>
        </Panel>
    );
}

const TASK_LABEL: Record<string, string> = {
    'earning-complete': 'Release earning',
    'booking-expired': 'Expire booking',
};

export function TaskRunsPanel({ runs, subtitle }: { runs: TaskRun[]; subtitle?: string }) {
    return (
        <Panel
            title="Background tasks"
            subtitle={subtitle ?? 'Cloud Tasks runs for this record (earning release, expiry)'}
            flush
        >
            <Box sx={{ '& > div': { border: 0, borderRadius: 0 } }}>
                <DataTable<TaskRun>
                    label="Background tasks"
                    data={runs}
                    getRowId={(r) => `${r.task}-${r.receivedAt}`}
                    pagination={{ mode: 'none' }}
                    maxHeight="none"
                    columns={[
                        {
                            id: 'task',
                            header: 'Task',
                            accessorFn: (r) => TASK_LABEL[r.task] ?? r.task,
                        },
                        {
                            id: 'outcome',
                            header: 'Outcome',
                            accessorFn: (r) => r.outcome ?? '',
                            cell: ({ row }) => (
                                <Box>
                                    <Outcome value={row.original.outcome} />
                                    <Detail note={row.original.note} error={row.original.error} />
                                </Box>
                            ),
                        },
                        {
                            id: 'receivedAt',
                            header: 'Ran',
                            accessorFn: (r) => r.receivedAt,
                            cell: ({ row }) => formatDateTime(row.original.receivedAt),
                        },
                        {
                            id: 'retryCount',
                            header: 'Retries',
                            accessorFn: (r) => r.retryCount ?? '',
                            meta: { align: 'right' },
                        },
                    ]}
                    empty={
                        <EmptyState
                            bare
                            icon={<ActivityIcon />}
                            title="No task runs recorded"
                            sx={{ py: 3 }}
                        />
                    }
                />
            </Box>
        </Panel>
    );
}
