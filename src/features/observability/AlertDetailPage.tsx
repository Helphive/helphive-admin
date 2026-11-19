import { Link as RouterLink, useParams } from 'react-router-dom';
import { Link, Stack, Typography } from '@mui/material';
import { DetailLayout, Timeline } from '@/components/detail';
import { DetailSkeleton, KeyValue, Panel, StatusPill } from '@/components/ui';
import { ApproveIcon, SuccessIcon } from '@/components/ui/icons';
import { useToast } from '@/components/feedback/toastContext';
import GatedButton from '@/features/auth/GatedButton';
import { usePageCrumb } from '@/features/shell/crumbContext';
import { getErrorMessage } from '@/lib/api';
import { formatAgo, formatDateTime } from '@/lib/format';
import { useDocumentTitle, useNow } from '@/lib/hooks';
import { useAlertActionMutation, useGetAlertQuery } from './api';
import { ALERT_TONE } from './model';
import { LoadError } from './parts';

export default function AlertDetailPage() {
    const { alertId = '' } = useParams();
    const now = useNow();
    const toast = useToast();
    const q = useGetAlertQuery(alertId);
    const [act, acting] = useAlertActionMutation();
    const a = q.data?.alert;
    useDocumentTitle(a?.ruleName ?? 'Alert');
    usePageCrumb(a?.ruleName);
    if (q.isLoading) return <DetailSkeleton />;
    if (q.error || !a) return <LoadError error={q.error} what="this alert" onRetry={q.refetch} />;

    const run = async (action: 'acknowledge' | 'resolve', done: string) => {
        try {
            await act({ id: a.id, action }).unwrap();
            toast.success(`${done} ${a.ruleName}`);
        } catch (error) {
            toast.error(getErrorMessage(error, 'Could not change the alert.'));
        }
    };

    return (
        <DetailLayout
            title={a.ruleName}
            subtitle={`Fired ${formatAgo(a.firedAt, now)}`}
            status={
                <StatusPill tone={ALERT_TONE[a.status]} size="md">
                    {a.status}
                </StatusPill>
            }
            actions={
                a.status !== 'resolved' && (
                    <>
                        {a.status === 'firing' && (
                            <GatedButton
                                permission="observability.manage"
                                variant="outlined"
                                startIcon={<ApproveIcon />}
                                disabled={acting.isLoading}
                                onClick={() => run('acknowledge', 'Acknowledged')}
                            >
                                Acknowledge
                            </GatedButton>
                        )}
                        <GatedButton
                            permission="observability.manage"
                            variant="contained"
                            startIcon={<SuccessIcon />}
                            disabled={acting.isLoading}
                            onClick={() => run('resolve', 'Resolved')}
                        >
                            Resolve
                        </GatedButton>
                    </>
                )
            }
            aside={
                <Panel title="Alert">
                    <KeyValue
                        variant="rows"
                        items={[
                            { label: 'Severity', value: a.severity },
                            { label: 'Value when fired', value: a.value ?? '' },
                            { label: 'Latest value', value: a.lastValue ?? '' },
                            { label: 'Threshold', value: a.threshold },
                            {
                                label: 'Emails',
                                value: a.notified
                                    ? `${a.notified.sent} of ${a.notified.recipients} sent`
                                    : 'No recipients',
                            },
                            {
                                label: 'Rule',
                                value: q.data?.rule ? (
                                    <Link
                                        component={RouterLink}
                                        to={`/observability/alerts/rules/${a.ruleId}`}
                                    >
                                        Open rule
                                    </Link>
                                ) : (
                                    'Deleted'
                                ),
                            },
                        ]}
                    />
                </Panel>
            }
        >
            <Stack spacing={2.5}>
                <Panel title="Why it fired">
                    <Typography variant="body1">{a.summary}</Typography>
                    {a.status !== 'resolved' && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            It resolves by itself when the condition clears. Acknowledging tells
                            other admins someone is on it.
                        </Typography>
                    )}
                </Panel>
                <Panel title="History">
                    <Timeline
                        items={(a.history ?? []).map((h, i) => ({
                            id: String(i),
                            title: `${h.status[0].toUpperCase()}${h.status.slice(1)}${h.by ? ` by ${h.by}` : ''}`,
                            description: h.note ?? undefined,
                            time: formatDateTime(h.at),
                            dateTime: h.at,
                            tone:
                                h.status === 'firing'
                                    ? ('red' as const)
                                    : h.status === 'acknowledged'
                                      ? ('amber' as const)
                                      : ('green' as const),
                        }))}
                    />
                </Panel>
            </Stack>
        </DetailLayout>
    );
}
