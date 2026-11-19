import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Alert as MuiAlert, Box, Link, Stack, TextField, Typography } from '@mui/material';
import { DetailLayout, Timeline } from '@/components/detail';
import { ConfirmDialog, DetailSkeleton, KeyValue, Panel, StatusPill } from '@/components/ui';
import { ReplayIcon } from '@/components/ui/icons';
import { useToast } from '@/components/feedback/toastContext';
import GatedButton from '@/features/auth/GatedButton';
import { usePageCrumb } from '@/features/shell/crumbContext';
import { getErrorMessage } from '@/lib/api';
import { formatAgo, formatDateTime } from '@/lib/format';
import { useDocumentTitle, useNow } from '@/lib/hooks';
import {
    useGetTaskQuery,
    useGetWebhookQuery,
    useReplayTaskMutation,
    useReplayWebhookMutation,
} from './api';
import { OUTCOME_TONE, formatMs, type Eligibility, type TaskRecord } from './model';
import { LoadError, Mono, OutLink, RequestIdLink } from './parts';

function ReplayAction({
    eligibility,
    what,
    onReplay,
    busy,
}: {
    eligibility: Eligibility;
    what: string;
    onReplay: (reason: string) => Promise<void>;
    busy: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);
    return (
        <>
            <GatedButton
                permission="observability.manage"
                blockedBecause={eligibility.eligible ? null : eligibility.reason}
                variant="contained"
                startIcon={<ReplayIcon />}
                onClick={() => setOpen(true)}
                showReason
            >
                Replay
            </GatedButton>
            <ConfirmDialog
                open={open}
                title={`Replay this ${what}?`}
                description={`${eligibility.effect ?? ''} It runs the same handler again; the handler only changes what has not already changed, and the replay is recorded in the audit log.`}
                confirmLabel="Replay"
                loading={busy}
                onClose={() => {
                    setOpen(false);
                    setError(null);
                }}
                onConfirm={async () => {
                    setError(null);
                    try {
                        await onReplay(reason.trim());
                        setOpen(false);
                        setReason('');
                    } catch (e) {
                        setError(getErrorMessage(e, 'The replay did not run.'));
                    }
                }}
            >
                <TextField
                    label="Reason (optional)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    fullWidth
                    multiline
                    minRows={2}
                    sx={{ mt: 2 }}
                    inputProps={{ maxLength: 1000 }}
                />
                {error && (
                    <MuiAlert severity="error" sx={{ mt: 2 }}>
                        {error}
                    </MuiAlert>
                )}
            </ConfirmDialog>
        </>
    );
}

function WebhookDetail({ id }: { id: string }) {
    const now = useNow();
    const toast = useToast();
    const q = useGetWebhookQuery(id);
    const [replay, replaying] = useReplayWebhookMutation();
    const w = q.data?.webhook;
    useDocumentTitle(w?.type ?? 'Webhook');
    usePageCrumb(w?.type);
    if (q.isLoading) return <DetailSkeleton />;
    if (q.error || !w)
        return <LoadError error={q.error} what="this webhook event" onRetry={q.refetch} />;
    const related = q.data?.related;
    return (
        <DetailLayout
            title={<Mono inherit>{w.type}</Mono>}
            subtitle={`Stripe event ${w.eventId}, received ${formatAgo(w.receivedAt, now)}`}
            status={
                <StatusPill tone={OUTCOME_TONE[w.outcome]} size="md">
                    {w.outcome}
                </StatusPill>
            }
            actions={
                <ReplayAction
                    eligibility={w.replay}
                    what="Stripe event"
                    busy={replaying.isLoading}
                    onReplay={async (reason) => {
                        const r = await replay({ id: w.id, reason: reason || undefined }).unwrap();
                        if (r.result.outcome === 'failed')
                            toast.error(
                                `Replayed; the handler failed again: ${r.result.error ?? 'no detail'}`
                            );
                        else toast.success(`Replayed ${w.type}: ${r.result.outcome}`);
                    }}
                />
            }
            aside={
                <Panel title="Record">
                    <KeyValue
                        variant="rows"
                        items={[
                            {
                                label: 'Endpoint',
                                value:
                                    w.endpoint === 'connected' ? 'Connected accounts' : 'Platform',
                            },
                            { label: 'Object', value: w.objectId ? <Mono>{w.objectId}</Mono> : '' },
                            { label: 'Deliveries', value: w.deliveries },
                            { label: 'Took', value: formatMs(w.durationMs) },
                            { label: 'Request', value: <RequestIdLink requestId={w.requestId} /> },
                            ...(related?.bookingId
                                ? [
                                      {
                                          label: 'Booking',
                                          value: (
                                              <Link
                                                  component={RouterLink}
                                                  to={`/bookings/${related.bookingId}`}
                                              >
                                                  Open booking
                                              </Link>
                                          ),
                                      },
                                  ]
                                : []),
                            ...(related?.paymentId
                                ? [
                                      {
                                          label: 'Payment',
                                          value: (
                                              <Link
                                                  component={RouterLink}
                                                  to={`/payments/${related.paymentId}`}
                                              >
                                                  Open payment
                                              </Link>
                                          ),
                                      },
                                  ]
                                : []),
                            ...(related?.payoutId
                                ? [
                                      {
                                          label: 'Payout',
                                          value: (
                                              <Link
                                                  component={RouterLink}
                                                  to={`/payouts/${related.payoutId}`}
                                              >
                                                  Open payout
                                              </Link>
                                          ),
                                      },
                                  ]
                                : []),
                        ]}
                    />
                    <Box sx={{ mt: 1.5 }}>
                        <OutLink href={w.logsUrl}>Logs in Google Cloud</OutLink>
                    </Box>
                </Panel>
            }
        >
            <Stack spacing={2.5}>
                {(w.error || w.note) && (
                    <Panel title={w.error ? 'Error' : 'Note'}>
                        <Typography
                            variant="body2"
                            sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                        >
                            {w.error ?? w.note}
                        </Typography>
                    </Panel>
                )}
                <Panel title="Replay">
                    <Typography
                        variant="body2"
                        color={w.replay.eligible ? 'text.primary' : 'text.secondary'}
                    >
                        {w.replay.eligible ? w.replay.effect : w.replay.reason}
                    </Typography>
                </Panel>
                <Panel title="What happened">
                    <Timeline
                        items={[
                            {
                                id: 'received',
                                title: 'Received from Stripe',
                                time: formatDateTime(w.receivedAt),
                                dateTime: w.receivedAt,
                                tone: 'blue',
                            },
                            ...(w.processedAt
                                ? [
                                      {
                                          id: 'processed',
                                          title: `Handled: ${w.outcome}`,
                                          time: formatDateTime(w.processedAt),
                                          dateTime: w.processedAt,
                                          tone:
                                              w.outcome === 'failed'
                                                  ? ('red' as const)
                                                  : ('green' as const),
                                      },
                                  ]
                                : []),
                            ...w.replays.map((r, i) => ({
                                id: `replay-${i}`,
                                title: `Replayed by ${r.by ?? 'an admin'}: ${r.outcome}`,
                                description: r.error ?? undefined,
                                time: formatDateTime(r.at),
                                dateTime: r.at,
                                tone:
                                    r.outcome === 'failed' ? ('red' as const) : ('green' as const),
                            })),
                        ]}
                    />
                </Panel>
            </Stack>
        </DetailLayout>
    );
}

function TaskDetail({ id }: { id: string }) {
    const now = useNow();
    const toast = useToast();
    const q = useGetTaskQuery(id);
    const [replay, replaying] = useReplayTaskMutation();
    const t = q.data?.task;
    useDocumentTitle(t?.task ?? 'Task run');
    usePageCrumb(t?.task);
    if (q.isLoading) return <DetailSkeleton />;
    if (q.error || !t)
        return <LoadError error={q.error} what="this task run" onRetry={q.refetch} />;
    const runs: TaskRecord[] = [t, ...(q.data?.related ?? [])].sort((a, b) =>
        a.receivedAt.localeCompare(b.receivedAt)
    );
    return (
        <DetailLayout
            title={<Mono inherit>{t.task}</Mono>}
            subtitle={`Ran ${formatAgo(t.receivedAt, now)}, answered ${t.status}`}
            status={
                <StatusPill tone={OUTCOME_TONE[t.outcome]} size="md">
                    {t.outcome}
                </StatusPill>
            }
            actions={
                <ReplayAction
                    eligibility={t.replay}
                    what="task"
                    busy={replaying.isLoading}
                    onReplay={async (reason) => {
                        const r = await replay({ id: t.id, reason: reason || undefined }).unwrap();
                        if (r.result.outcome === 'failed')
                            toast.error(
                                `Replayed; it failed again: ${r.result.message ?? r.result.status}`
                            );
                        else toast.success(`Replayed ${t.task}: ${r.result.outcome}`);
                    }}
                />
            }
            aside={
                <Panel title="Run">
                    <KeyValue
                        variant="rows"
                        items={[
                            {
                                label: 'Booking',
                                value: t.bookingId ? (
                                    <Link component={RouterLink} to={`/bookings/${t.bookingId}`}>
                                        <Mono>{t.bookingId}</Mono>
                                    </Link>
                                ) : (
                                    ''
                                ),
                            },
                            { label: 'Queue', value: t.queue ?? '' },
                            {
                                label: 'Attempt',
                                value:
                                    t.executionCount != null
                                        ? `${t.executionCount + 1}${t.retryCount ? `, retry ${t.retryCount}` : ''}`
                                        : '',
                            },
                            { label: 'Took', value: formatMs(t.durationMs) },
                            { label: 'Request', value: <RequestIdLink requestId={t.requestId} /> },
                            ...(t.replayOf
                                ? [
                                      {
                                          label: 'Replay of',
                                          value: (
                                              <Link
                                                  component={RouterLink}
                                                  to={`/observability/tasks/${t.replayOf}`}
                                              >
                                                  Original run
                                              </Link>
                                          ),
                                      },
                                  ]
                                : []),
                        ]}
                    />
                    <Box sx={{ mt: 1.5 }}>
                        <OutLink href={t.logsUrl}>Logs in Google Cloud</OutLink>
                    </Box>
                </Panel>
            }
        >
            <Stack spacing={2.5}>
                {(t.error || t.note) && (
                    <Panel title={t.error ? 'Error' : 'Answer'}>
                        <Typography variant="body2">{t.error ?? t.note}</Typography>
                    </Panel>
                )}
                <Panel title="Replay">
                    <Typography
                        variant="body2"
                        color={t.replay.eligible ? 'text.primary' : 'text.secondary'}
                    >
                        {t.replay.eligible ? t.replay.effect : t.replay.reason}
                    </Typography>
                </Panel>
                <Panel title="Every run for this booking">
                    <Timeline
                        items={runs.map((r) => ({
                            id: r.id,
                            title: `${r.task}: ${r.outcome}${r.replayOf ? ` (replay by ${r.replayedBy ?? 'an admin'})` : ''}${r.id === t.id ? ', this run' : ''}`,
                            description: r.error ?? r.note ?? undefined,
                            time: formatDateTime(r.receivedAt),
                            dateTime: r.receivedAt,
                            tone:
                                r.outcome === 'failed'
                                    ? ('red' as const)
                                    : r.outcome === 'processed'
                                      ? ('green' as const)
                                      : ('grey' as const),
                        }))}
                    />
                </Panel>
            </Stack>
        </DetailLayout>
    );
}

export default function DeliveryDetailPage({ kind }: { kind: 'webhooks' | 'tasks' }) {
    const { recordId = '' } = useParams();
    return kind === 'webhooks' ? <WebhookDetail id={recordId} /> : <TaskDetail id={recordId} />;
}
