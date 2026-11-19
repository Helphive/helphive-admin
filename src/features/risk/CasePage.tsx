import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Link, MenuItem, TextField } from '@mui/material';
import { DetailLayout, Timeline, type TimelineItem } from '@/components/detail';
import { DetailSkeleton, ErrorState, KeyValue, Panel, StatusPill } from '@/components/ui';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons';
import { useToast } from '@/components/feedback/toastContext';
import GatedButton from '@/features/auth/GatedButton';
import ReasonDialog from '@/components/ui/ReasonDialog';
import { usePageCrumb } from '@/features/shell/crumbContext';
import { getErrorMessage } from '@/lib/api';
import { formatAgo, formatDate, formatDateTime } from '@/lib/format';
import { useDocumentTitle } from '@/lib/hooks';
import { color, font, hairline } from '@/theme/tokens';
import {
    useAddCaseNoteMutation,
    useAssignCaseMutation,
    useCaseActionMutation,
    useDecideCaseMutation,
    useGetCaseQuery,
    useSetCaseStatusMutation,
} from './api';
import LinkedAccounts from './LinkedAccounts';
import {
    HOLD_EFFECT,
    LIST_KIND_HINT,
    LIST_KIND_LABEL,
    QUEUE_KEY,
    SUBJECT_LABEL,
    money,
    recordPath,
    type CaseDetail,
    type ListKind,
} from './model';
import {
    ActionList,
    CaseStatusPill,
    ConditionLine,
    ScoreFigure,
    ScoreLedger,
    SeverityPill,
} from './parts';

const EVENT_TITLES: Record<string, string> = {
    'user.signed_up': 'Signed up',
    'auth.sign_in_succeeded': 'Signed in',
    'auth.sign_in_failed': 'Sign-in failed',
    'booking.created': 'Booking created',
    'booking.paid': 'Booking paid',
    'booking.accepted': 'Booking accepted',
    'booking.start_requested': 'Start requested',
    'booking.started': 'Job started',
    'booking.completed': 'Job completed',
    'booking.cancelled': 'Booking cancelled',
    'payment.succeeded': 'Payment succeeded',
    'payment.failed': 'Payment failed',
    'refund.created': 'Refund started',
    'refund.succeeded': 'Refund paid',
    'earning.created': 'Earning recorded',
    'earning.released': 'Earning released',
    'earning.held': 'Earning held back',
    'payout.requested': 'Payout requested',
    'payout.held': 'Payout refused (hold)',
    'payout.paid': 'Payout paid',
    'payout.failed': 'Payout failed',
    'risk.rule_fired': 'Risk rule fired',
    'risk.hold_placed': 'Payout hold placed',
    'risk.hold_released': 'Payout hold released',
    'user.suspended': 'Account suspended',
    'user.reinstated': 'Account reinstated',
};

type Dialog =
    | { kind: 'decide'; outcome: 'cleared' | 'confirmed' }
    | { kind: 'hold'; hold: 'hold' | 'review_before_payout' }
    | { kind: 'release-holds' | 'suspend' | 'reinstate' | 'refund' | 'block' | 'status' }
    | null;

export default function CasePage() {
    const { caseId = '' } = useParams();
    const navigate = useNavigate();
    const q = useGetCaseQuery(caseId);
    const title = q.data?.case.title;
    useDocumentTitle(title ? `Case: ${title}` : 'Case');
    usePageCrumb(q.data?.person?.name ?? undefined);

    // Previous and next in the queue as it was opened ([ and ] keys).
    const queue = useMemo<string[]>(() => {
        try {
            return JSON.parse(sessionStorage.getItem(QUEUE_KEY) ?? '[]');
        } catch {
            return [];
        }
    }, []);
    const at = queue.indexOf(caseId);
    const prev = at > 0 ? queue[at - 1] : null;
    const next = at >= 0 && at < queue.length - 1 ? queue[at + 1] : null;
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('input, textarea, [role="dialog"]')) return;
            if (e.key === '[' && prev) navigate(`/risk/cases/${prev}`);
            if (e.key === ']' && next) navigate(`/risk/cases/${next}`);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [prev, next, navigate]);

    if (q.isLoading) return <DetailSkeleton />;
    if (q.error || !q.data) {
        return (
            <ErrorState
                title="Could not load this case"
                message={getErrorMessage(q.error, 'Try again.')}
                onRetry={q.refetch}
            />
        );
    }
    const d = q.data;
    const c = d.case;

    return (
        <DetailLayout
            title={c.title}
            status={
                <Box sx={{ display: 'flex', gap: 0.75 }}>
                    <SeverityPill severity={c.severity} />
                    <CaseStatusPill status={c.status} />
                </Box>
            }
            subtitle={
                <>
                    {SUBJECT_LABEL[c.subject.type]} case
                    {d.person ? (
                        <>
                            {' about '}
                            <Link component={RouterLink} to={recordPath.user(d.person._id)}>
                                {d.person.name}
                            </Link>{' '}
                            ({d.person.role})
                        </>
                    ) : null}
                    , opened {formatAgo(c.createdAt)} {c.rules.length ? 'by a rule' : 'by an admin'}
                </>
            }
            actions={
                queue.length > 1 && at >= 0 ? (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<ChevronLeftIcon />}
                            disabled={!prev}
                            onClick={() => prev && navigate(`/risk/cases/${prev}`)}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            endIcon={<ChevronRightIcon />}
                            disabled={!next}
                            onClick={() => next && navigate(`/risk/cases/${next}`)}
                        >
                            Next case
                        </Button>
                    </Box>
                ) : undefined
            }
            tabs={[
                { id: 'story', label: 'What happened', content: <Story d={d} /> },
                {
                    id: 'timeline',
                    label: 'Timeline',
                    count: d.timeline.length,
                    content: <CaseTimeline d={d} />,
                },
                ...(d.person
                    ? [
                          {
                              id: 'linked',
                              label: 'Linked accounts',
                              content: (
                                  <Panel>
                                      <LinkedAccounts userId={d.person._id} />
                                  </Panel>
                              ),
                          },
                      ]
                    : []),
                {
                    id: 'records',
                    label: 'Bookings and money',
                    count: d.bookings.length,
                    content: <Records d={d} />,
                },
                {
                    id: 'notes',
                    label: 'Notes and history',
                    count: c.notes.length,
                    content: <Notes d={d} />,
                },
            ]}
            aside={<Decision d={d} />}
            asideFirstOnNarrow={false}
        />
    );
}

function Story({ d }: { d: CaseDetail }) {
    const c = d.case;
    const firstSeen = d.person ? d.timeline.find((e) => e.type === 'user.signed_up')?.at : null;
    return (
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'minmax(0, 1fr)' }}>
            {d.risk && (
                <Panel title="Risk score now" subtitle={d.risk.explanation}>
                    <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'center', mb: 1 }}>
                        <ScoreFigure score={d.risk.score} band={d.risk.band} />
                        <Box sx={{ flex: 1, fontSize: font.size.sm, color: color.ink600 }}>
                            Each segment is a rule that fires for this person now, sized by the
                            points it adds. Striped segments are rules in observe mode. Open a row
                            for its evidence.
                        </Box>
                    </Box>
                    <ScoreLedger contributions={d.risk.contributions} />
                </Panel>
            )}
            <Panel title="Why this case was opened">
                {c.evidence.length === 0 ? (
                    <Box sx={{ color: color.ink500 }}>
                        An admin opened this case by hand; the reason is the first note. The current
                        score above shows what the rules see.
                    </Box>
                ) : (
                    <Box
                        component="ol"
                        sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 2 }}
                    >
                        {c.evidence.map((e, i) => (
                            <Box
                                component="li"
                                key={`${e.ruleKey}-${i}`}
                                sx={{ pl: 2, borderLeft: `3px solid ${color.ink200}` }}
                            >
                                <Box sx={{ fontWeight: 700, color: color.ink900 }}>{e.title}</Box>
                                <Box
                                    sx={{
                                        fontSize: font.size.xs,
                                        color: color.ink500,
                                        fontWeight: 600,
                                    }}
                                >
                                    Fired {formatDateTime(e.at)}
                                </Box>
                                {e.conditions.map((cond) => (
                                    <ConditionLine key={cond.signal} c={cond} />
                                ))}
                            </Box>
                        ))}
                    </Box>
                )}
            </Panel>
            {d.person && (
                <Panel title="The person">
                    <KeyValue
                        variant="grid"
                        columns={3}
                        items={[
                            {
                                label: 'Name',
                                value: (
                                    <Link component={RouterLink} to={recordPath.user(d.person._id)}>
                                        {d.person.name}
                                    </Link>
                                ),
                            },
                            { label: 'Role', value: d.person.role },
                            {
                                label: 'Account',
                                value: d.person.suspended ? (
                                    <StatusPill tone="red">Suspended</StatusPill>
                                ) : (
                                    <StatusPill tone="green">Active</StatusPill>
                                ),
                            },
                            { label: 'Email', value: d.person.email },
                            {
                                label: 'Signed up',
                                value: firstSeen
                                    ? formatDate(firstSeen)
                                    : 'Before the event history',
                            },
                            {
                                label: 'Payout holds',
                                value: d.holds.filter((h) => h.active).length || 'None',
                            },
                        ]}
                    />
                    {d.linkedPeople.length > 0 && (
                        <Box sx={{ mt: 2, fontSize: font.size.sm, color: color.ink600 }}>
                            Also named in the evidence:{' '}
                            {d.linkedPeople.map((p, i) => (
                                <span key={p._id}>
                                    {i > 0 && ', '}
                                    <Link component={RouterLink} to={recordPath.user(p._id)}>
                                        {p.name}
                                    </Link>
                                </span>
                            ))}
                        </Box>
                    )}
                </Panel>
            )}
        </Box>
    );
}

function CaseTimeline({ d }: { d: CaseDetail }) {
    const items: TimelineItem[] = [
        ...d.timeline.map((e) => ({
            id: e._id,
            title: EVENT_TITLES[e.type] ?? e.type,
            time: formatDateTime(e.at),
            dateTime: e.at,
            at: e.at,
            tone: (e.type.includes('failed') ||
            e.type.includes('held') ||
            e.type.includes('cancelled')
                ? 'amber'
                : e.type.startsWith('risk.')
                  ? 'red'
                  : 'grey') as TimelineItem['tone'],
            description: describeEvent(e),
        })),
        ...d.hits.map((h) => ({
            id: `hit-${h._id}`,
            title: `Rule fired: ${d.rules.find((r) => r.key === h.ruleKey)?.title ?? h.ruleKey}`,
            time: formatDateTime(h.at),
            dateTime: h.at,
            at: h.at,
            tone: 'red' as const,
            description: h.actionsTaken.length ? (
                <>
                    Did: <ActionList actions={h.actionsTaken} />
                </>
            ) : h.actionsWouldTake.length ? (
                <>
                    Observe mode, would have: <ActionList actions={h.actionsWouldTake} muted />
                </>
            ) : undefined,
        })),
    ].sort((a, b) => a.at.localeCompare(b.at));
    return (
        <Panel title="Timeline" subtitle="Events of the last 90 days and rule hits, oldest first">
            {items.length ? (
                <Timeline items={items} label="Case timeline" />
            ) : (
                <Box sx={{ color: color.ink500 }}>No events recorded.</Box>
            )}
        </Panel>
    );
}

function describeEvent(e: CaseDetail['timeline'][number]): ReactNode {
    const p = e.properties ?? {};
    const parts: ReactNode[] = [];
    if (typeof p.amount === 'number') parts.push(money(p.amount));
    if (typeof p.reason === 'string') parts.push(p.reason);
    if (typeof p.ruleKey === 'string') parts.push(p.ruleKey);
    if (e.bookingId)
        parts.push(
            <Link key="b" component={RouterLink} to={recordPath.booking(e.bookingId)}>
                booking
            </Link>
        );
    if (e.paymentId)
        parts.push(
            <Link key="p" component={RouterLink} to={recordPath.payment(e.paymentId)}>
                payment
            </Link>
        );
    if (e.payoutId)
        parts.push(
            <Link key="o" component={RouterLink} to={recordPath.payout(e.payoutId)}>
                payout
            </Link>
        );
    if (!parts.length) return undefined;
    return parts.map((part, i) => (
        <span key={i}>
            {i > 0 && ', '}
            {part}
        </span>
    ));
}

const tableSx = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: font.size.sm,
    '& td, & th': { px: 1.5, py: 1, borderTop: hairline, textAlign: 'left', whiteSpace: 'nowrap' },
    '& th': { color: color.ink500, fontWeight: 700, bgcolor: color.subtle },
} as const;

function Records({ d }: { d: CaseDetail }) {
    const duration = (b: CaseDetail['bookings'][number]) =>
        b.startedAt && b.completedAt
            ? `${Math.round((Date.parse(b.completedAt) - Date.parse(b.startedAt)) / 60000)} min of ${b.hours} h`
            : '';
    return (
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <Panel title="Bookings" flush>
                <Box sx={{ overflowX: 'auto' }}>
                    <Box component="table" sx={tableSx}>
                        <thead>
                            <tr>
                                <th>Booking</th>
                                <th>As</th>
                                <th>Status</th>
                                <th>Amount</th>
                                <th>Start</th>
                                <th>Worked</th>
                            </tr>
                        </thead>
                        <tbody>
                            {d.bookings.map((b) => (
                                <tr key={b._id}>
                                    <td>
                                        <Link
                                            component={RouterLink}
                                            to={recordPath.booking(b._id)}
                                            sx={{ fontWeight: 700 }}
                                        >
                                            {b.reference}
                                        </Link>
                                    </td>
                                    <td>{b.role}</td>
                                    <td>{b.status}</td>
                                    <td>{money(b.amount)}</td>
                                    <td>{formatDateTime(b.startDate)}</td>
                                    <td>{duration(b)}</td>
                                </tr>
                            ))}
                            {!d.bookings.length && (
                                <tr>
                                    <td colSpan={6} style={{ color: color.ink500 }}>
                                        No bookings.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </Box>
                </Box>
            </Panel>
            <Box
                sx={{
                    display: 'grid',
                    gap: 2.5,
                    gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                }}
            >
                <Panel title="Payments" flush>
                    <Box sx={{ overflowX: 'auto' }}>
                        <Box component="table" sx={tableSx}>
                            <thead>
                                <tr>
                                    <th>Payment</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Refund</th>
                                </tr>
                            </thead>
                            <tbody>
                                {d.payments.map((p) => (
                                    <tr key={p._id}>
                                        <td>
                                            <Link
                                                component={RouterLink}
                                                to={recordPath.payment(p._id)}
                                            >
                                                {formatDate(p.createdAt)}
                                            </Link>
                                        </td>
                                        <td>{money(p.amount)}</td>
                                        <td>{p.status}</td>
                                        <td>
                                            {p.refundStatus
                                                ? `${money(p.refundAmount)} ${p.refundStatus}`
                                                : ''}
                                        </td>
                                    </tr>
                                ))}
                                {!d.payments.length && (
                                    <tr>
                                        <td colSpan={4} style={{ color: color.ink500 }}>
                                            No payments.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </Box>
                    </Box>
                </Panel>
                <Panel title="Payouts" flush>
                    <Box sx={{ overflowX: 'auto' }}>
                        <Box component="table" sx={tableSx}>
                            <thead>
                                <tr>
                                    <th>Payout</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>To</th>
                                </tr>
                            </thead>
                            <tbody>
                                {d.payouts.map((p) => (
                                    <tr key={p._id}>
                                        <td>
                                            <Link
                                                component={RouterLink}
                                                to={recordPath.payout(p._id)}
                                            >
                                                {formatDate(p.createdAt)}
                                            </Link>
                                        </td>
                                        <td>{money(p.amount)}</td>
                                        <td>{p.status}</td>
                                        <td>
                                            {p.destination.last4
                                                ? `${p.destination.type === 'card' ? 'Card' : 'Bank'} ••${p.destination.last4}`
                                                : ''}
                                        </td>
                                    </tr>
                                ))}
                                {!d.payouts.length && (
                                    <tr>
                                        <td colSpan={4} style={{ color: color.ink500 }}>
                                            No payouts.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </Box>
                    </Box>
                </Panel>
            </Box>
        </Box>
    );
}

function Notes({ d }: { d: CaseDetail }) {
    const [body, setBody] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [addNote, { isLoading }] = useAddCaseNoteMutation();
    const c = d.case;
    return (
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <Panel title="Notes" subtitle="Only admins see these.">
                <Box sx={{ display: 'grid', gap: 1, mb: 2 }}>
                    <TextField
                        label="Add a note"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        multiline
                        minRows={2}
                        inputProps={{ maxLength: 2000 }}
                        error={!!error}
                        helperText={error ?? ' '}
                    />
                    <Box>
                        <GatedButton
                            permission="risk.manage"
                            variant="outlined"
                            disabled={!body.trim() || isLoading}
                            onClick={async () => {
                                setError(null);
                                try {
                                    await addNote({ id: c._id, body: body.trim() }).unwrap();
                                    setBody('');
                                } catch (err) {
                                    setError(
                                        getErrorMessage(err, 'The note was not saved. Try again.')
                                    );
                                }
                            }}
                        >
                            Add note
                        </GatedButton>
                    </Box>
                </Box>
                {c.notes.map((n) => (
                    <Box key={n._id} sx={{ py: 1.25, borderTop: hairline }}>
                        <Box sx={{ whiteSpace: 'pre-wrap', color: color.ink900 }}>{n.body}</Box>
                        <Box sx={{ fontSize: font.size.xs, color: color.ink500, fontWeight: 600 }}>
                            {n.author.email ?? 'Admin'}, {formatDateTime(n.createdAt)}
                        </Box>
                    </Box>
                ))}
            </Panel>
            <Panel title="Case history">
                <Timeline
                    label="Case history"
                    items={c.history.map((h, i) => ({
                        id: String(i),
                        title: historyTitle(h.action),
                        time: formatDateTime(h.at),
                        dateTime: h.at,
                        description: h.by.type === 'system' ? 'By the risk engine' : h.by.email,
                    }))}
                />
            </Panel>
        </Box>
    );
}

const historyTitle = (action: string) =>
    ({
        opened: 'Case opened',
        rules_added: 'More rules fired',
        assigned: 'Assignment changed',
        status: 'Status changed',
        note: 'Note added',
        decided: 'Decided',
        hold_placed: 'Payout hold placed',
        holds_released: 'Payout holds released',
        suspended: 'Account suspended',
        reinstated: 'Account reinstated',
        refunded: 'Refund issued',
        blocked: 'Added to the block list',
    })[action] ?? action;

function Decision({ d }: { d: CaseDetail }) {
    const c = d.case;
    const toast = useToast();
    const [dialog, setDialog] = useState<Dialog>(null);
    const [assign, assignState] = useAssignCaseMutation();
    const [setStatus] = useSetCaseStatusMutation();
    const [decide] = useDecideCaseMutation();
    const [act] = useCaseActionMutation();
    const closed = c.status === 'cleared' || c.status === 'confirmed';
    const person = d.person;
    const isProvider = person?.role === 'provider';
    const activeHolds = d.holds.filter((h) => h.active);
    const name = person?.name ?? 'this person';
    const done = (message: string) => {
        setDialog(null);
        toast.success(message);
    };

    return (
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <Panel title="Decision">
                {c.decision ? (
                    <Box>
                        <CaseStatusPill status={c.decision.outcome} />
                        <Box sx={{ mt: 1, color: color.ink900 }}>{c.decision.reason}</Box>
                        <Box sx={{ fontSize: font.size.xs, color: color.ink500, fontWeight: 600 }}>
                            {c.decision.by.email}, {formatDateTime(c.decision.at)}
                        </Box>
                    </Box>
                ) : (
                    <Box sx={{ display: 'grid', gap: 1 }}>
                        <GatedButton
                            permission="risk.manage"
                            variant="contained"
                            color="error"
                            onClick={() => setDialog({ kind: 'decide', outcome: 'confirmed' })}
                        >
                            Confirm fraud
                        </GatedButton>
                        <GatedButton
                            permission="risk.manage"
                            variant="outlined"
                            onClick={() => setDialog({ kind: 'decide', outcome: 'cleared' })}
                        >
                            Clear case
                        </GatedButton>
                        {c.status === 'open' && (
                            <GatedButton
                                permission="risk.manage"
                                variant="text"
                                onClick={() => setDialog({ kind: 'status' })}
                            >
                                Mark in review
                            </GatedButton>
                        )}
                    </Box>
                )}
                <Box sx={{ mt: 2, pt: 1.5, borderTop: hairline, fontSize: font.size.sm }}>
                    <Box sx={{ color: color.ink500, fontWeight: 600 }}>Assignee</Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Box sx={{ flex: 1 }}>{c.assignee?.email ?? 'Nobody'}</Box>
                        {!closed && (
                            <GatedButton
                                permission="risk.manage"
                                size="small"
                                disabled={assignState.isLoading}
                                onClick={async () => {
                                    try {
                                        await assign({
                                            id: c._id,
                                            assignee: c.assignee ? null : 'me',
                                        }).unwrap();
                                        toast.success(
                                            c.assignee ? 'Unassigned' : 'Assigned to you'
                                        );
                                    } catch (err) {
                                        toast.error(
                                            getErrorMessage(err, 'The assignment did not change.')
                                        );
                                    }
                                }}
                            >
                                {c.assignee ? 'Unassign' : 'Assign to me'}
                            </GatedButton>
                        )}
                    </Box>
                </Box>
            </Panel>

            {person && (
                <Panel
                    title="Actions"
                    subtitle="Each asks you to confirm and is recorded in the audit log."
                >
                    <Box sx={{ display: 'grid', gap: 1 }}>
                        {isProvider && !activeHolds.some((h) => h.kind === 'hold') && (
                            <GatedButton
                                permission="risk.manage"
                                variant="outlined"
                                onClick={() => setDialog({ kind: 'hold', hold: 'hold' })}
                            >
                                Hold payouts
                            </GatedButton>
                        )}
                        {isProvider &&
                            !activeHolds.some((h) => h.kind === 'review_before_payout') && (
                                <GatedButton
                                    permission="risk.manage"
                                    variant="outlined"
                                    onClick={() =>
                                        setDialog({ kind: 'hold', hold: 'review_before_payout' })
                                    }
                                >
                                    Review before next payout
                                </GatedButton>
                            )}
                        {activeHolds.length > 0 && (
                            <GatedButton
                                permission="risk.manage"
                                variant="outlined"
                                onClick={() => setDialog({ kind: 'release-holds' })}
                            >
                                Release payout holds ({activeHolds.length})
                            </GatedButton>
                        )}
                        {person.suspended ? (
                            <GatedButton
                                permission="users.manage"
                                variant="outlined"
                                onClick={() => setDialog({ kind: 'reinstate' })}
                            >
                                Reinstate account
                            </GatedButton>
                        ) : (
                            <GatedButton
                                permission="users.manage"
                                variant="outlined"
                                color="error"
                                onClick={() => setDialog({ kind: 'suspend' })}
                            >
                                Suspend account
                            </GatedButton>
                        )}
                        <GatedButton
                            permission="payments.refund"
                            variant="outlined"
                            blockedBecause={
                                d.payments.some((p) => p.status === 'completed')
                                    ? null
                                    : 'No paid payment in this case.'
                            }
                            onClick={() => setDialog({ kind: 'refund' })}
                        >
                            Refund a payment
                        </GatedButton>
                        <GatedButton
                            permission="risk.manage"
                            variant="outlined"
                            onClick={() => setDialog({ kind: 'block' })}
                        >
                            Add to the block list
                        </GatedButton>
                    </Box>
                </Panel>
            )}

            {dialog?.kind === 'decide' && (
                <ReasonDialog
                    title={
                        dialog.outcome === 'confirmed'
                            ? `Confirm fraud by ${name}?`
                            : `Clear this case about ${name}?`
                    }
                    effect={
                        dialog.outcome === 'confirmed'
                            ? 'The case closes as confirmed fraud. Holds, suspensions and block entries stay as they are; take those actions separately.'
                            : 'The case closes as cleared. Holds and suspensions are not lifted automatically, and rules will not act on this person again for 30 days (they still score).'
                    }
                    reason="required"
                    destructive={dialog.outcome === 'confirmed'}
                    confirmLabel={dialog.outcome === 'confirmed' ? 'Confirm fraud' : 'Clear case'}
                    busyLabel="Saving"
                    onClose={() => setDialog(null)}
                    onConfirm={async (reason) => {
                        await decide({ id: c._id, outcome: dialog.outcome, reason }).unwrap();
                        done(
                            dialog.outcome === 'confirmed' ? 'Confirmed fraud' : 'Cleared the case'
                        );
                    }}
                />
            )}
            {dialog?.kind === 'status' && (
                <ReasonDialog
                    title="Mark this case in review?"
                    effect="Shows the team someone is working on it. Nothing else changes."
                    reason="optional"
                    confirmLabel="Mark in review"
                    busyLabel="Saving"
                    onClose={() => setDialog(null)}
                    onConfirm={async () => {
                        await setStatus({ id: c._id, status: 'in_review' }).unwrap();
                        done('Marked in review');
                    }}
                />
            )}
            {dialog?.kind === 'hold' && (
                <ReasonDialog
                    title={`${dialog.hold === 'hold' ? 'Hold payouts for' : 'Require a review before the next payout of'} ${name}?`}
                    effect={`${HOLD_EFFECT[dialog.hold]} The provider is told their payouts are paused for review. Release the hold from this case or the holds page.`}
                    reason="required"
                    destructive
                    confirmLabel={dialog.hold === 'hold' ? 'Hold payouts' : 'Require review'}
                    busyLabel="Placing hold"
                    onClose={() => setDialog(null)}
                    onConfirm={async (reason) => {
                        await act({
                            id: c._id,
                            action: 'hold',
                            body: { kind: dialog.hold, reason },
                        }).unwrap();
                        done(`Payouts on hold for ${name}`);
                    }}
                />
            )}
            {dialog?.kind === 'release-holds' && (
                <ReasonDialog
                    title={`Release every payout hold on ${name}?`}
                    effect={`${activeHolds.length} hold${activeHolds.length === 1 ? '' : 's'} end. Payout requests work again, and earnings kept back are scheduled for release in a few seconds.`}
                    reason="required"
                    confirmLabel="Release holds"
                    busyLabel="Releasing"
                    onClose={() => setDialog(null)}
                    onConfirm={async (reason) => {
                        await act({
                            id: c._id,
                            action: 'release-holds',
                            body: { reason },
                        }).unwrap();
                        done(`Released the payout holds on ${name}`);
                    }}
                />
            )}
            {dialog?.kind === 'suspend' && (
                <ReasonDialog
                    title={`Suspend ${name}?`}
                    effect="They are signed out everywhere and cannot sign in or use the app until reinstated. Open bookings are not cancelled; handle them from each booking."
                    reason="required"
                    destructive
                    confirmLabel="Suspend"
                    busyLabel="Suspending"
                    onClose={() => setDialog(null)}
                    onConfirm={async (reason) => {
                        await act({ id: c._id, action: 'suspend', body: { reason } }).unwrap();
                        done(`Suspended ${name}`);
                    }}
                />
            )}
            {dialog?.kind === 'reinstate' && (
                <ReasonDialog
                    title={`Reinstate ${name}?`}
                    effect="They can sign in again. Payout holds stay until released."
                    reason="required"
                    confirmLabel="Reinstate"
                    busyLabel="Reinstating"
                    onClose={() => setDialog(null)}
                    onConfirm={async (reason) => {
                        await act({ id: c._id, action: 'reinstate', body: { reason } }).unwrap();
                        done(`Reinstated ${name}`);
                    }}
                />
            )}
            {dialog?.kind === 'refund' && (
                <RefundDialog d={d} onClose={() => setDialog(null)} onDone={done} />
            )}
            {dialog?.kind === 'block' && (
                <BlockDialog d={d} onClose={() => setDialog(null)} onDone={done} />
            )}
        </Box>
    );
}

function RefundDialog({
    d,
    onClose,
    onDone,
}: {
    d: CaseDetail;
    onClose: () => void;
    onDone: (m: string) => void;
}) {
    const [act] = useCaseActionMutation();
    const paid = d.payments.filter((p) => p.status === 'completed');
    const [paymentId, setPaymentId] = useState(paid[0]?._id ?? '');
    const [amount, setAmount] = useState('');
    // One key per dialog, reused for every retry, so a double submission cannot refund twice.
    const [key] = useState(() => crypto.randomUUID());
    const payment = paid.find((p) => p._id === paymentId);
    const value = amount.trim() ? Number(amount) : null;
    return (
        <ReasonDialog
            title={`Refund ${value ? money(value) : 'the rest'} of ${payment ? money(payment.amount) : 'this payment'}?`}
            effect="The money goes back to the customer's card through Stripe. The provider's earning is not changed. This cannot be undone."
            reason="required"
            destructive
            confirmLabel="Refund"
            busyLabel="Refunding"
            validate={() =>
                !payment
                    ? 'Choose a payment.'
                    : value !== null && (!(value > 0) || value > payment.amount)
                      ? 'Enter an amount above zero and at most the payment.'
                      : null
            }
            onClose={onClose}
            onConfirm={async (reason) => {
                await act({
                    id: d.case._id,
                    action: 'refund',
                    body: { paymentId, amount: value ?? undefined, reason, idempotencyKey: key },
                }).unwrap();
                onDone('Refund started');
            }}
        >
            <Box
                sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' } }}
            >
                <TextField
                    select
                    label="Payment"
                    value={paymentId}
                    onChange={(e) => setPaymentId(e.target.value)}
                >
                    {paid.map((p) => (
                        <MenuItem key={p._id} value={p._id}>
                            {money(p.amount)}, {formatDate(p.createdAt)}
                            {p.refundStatus ? `, ${money(p.refundAmount)} refunded` : ''}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    label="Amount (blank for the rest)"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputProps={{ inputMode: 'decimal' }}
                />
            </Box>
        </ReasonDialog>
    );
}

function BlockDialog({
    d,
    onClose,
    onDone,
}: {
    d: CaseDetail;
    onClose: () => void;
    onDone: (m: string) => void;
}) {
    const [act] = useCaseActionMutation();
    const suggestions = useMemo(() => {
        const out: { kind: ListKind; value: string }[] = [];
        if (d.person?.email) out.push({ kind: 'email', value: d.person.email });
        if (d.person?.phone) out.push({ kind: 'phone', value: d.person.phone });
        for (const e of d.case.evidence) {
            for (const cond of e.conditions) {
                for (const v of cond.values?.deviceId ?? []) out.push({ kind: 'device', value: v });
                for (const v of cond.values?.ip ?? []) out.push({ kind: 'ip', value: v });
            }
        }
        return out
            .filter((s, i) => out.findIndex((o) => o.kind === s.kind && o.value === s.value) === i)
            .slice(0, 12);
    }, [d]);
    const [kind, setKind] = useState<ListKind>(suggestions[0]?.kind ?? 'email');
    const [value, setValue] = useState(suggestions[0]?.value ?? '');
    const [days, setDays] = useState('0');
    return (
        <ReasonDialog
            title={`Block this ${LIST_KIND_LABEL[kind].toLowerCase()}?`}
            effect="Sign-ups, sign-ins and new bookings that present it are refused with a general message. It does not sign anyone out or cancel anything already booked."
            reason="required"
            destructive
            confirmLabel="Block"
            busyLabel="Blocking"
            validate={() => (value.trim() ? null : 'Enter what to block.')}
            onClose={onClose}
            onConfirm={async (reason) => {
                await act({
                    id: d.case._id,
                    action: 'block',
                    body: {
                        kind,
                        value: value.trim(),
                        reason,
                        expiresAt:
                            days === '0'
                                ? null
                                : new Date(Date.now() + Number(days) * 86400000).toISOString(),
                    },
                }).unwrap();
                onDone(`Blocked the ${LIST_KIND_LABEL[kind].toLowerCase()}`);
            }}
        >
            <Box sx={{ display: 'grid', gap: 2 }}>
                {suggestions.length > 0 && (
                    <TextField
                        select
                        label="From this case"
                        value={`${kind}|${value}`}
                        onChange={(e) => {
                            const [k, ...rest] = e.target.value.split('|');
                            setKind(k as ListKind);
                            setValue(rest.join('|'));
                        }}
                    >
                        {suggestions.map((s) => (
                            <MenuItem key={`${s.kind}|${s.value}`} value={`${s.kind}|${s.value}`}>
                                {LIST_KIND_LABEL[s.kind]}: {s.value}
                            </MenuItem>
                        ))}
                        {!suggestions.some((s) => s.kind === kind && s.value === value) && (
                            <MenuItem value={`${kind}|${value}`}>Something else</MenuItem>
                        )}
                    </TextField>
                )}
                <Box
                    sx={{
                        display: 'grid',
                        gap: 2,
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' },
                    }}
                >
                    <TextField
                        select
                        label="Kind"
                        value={kind}
                        onChange={(e) => setKind(e.target.value as ListKind)}
                    >
                        {(Object.keys(LIST_KIND_LABEL) as ListKind[]).map((k) => (
                            <MenuItem key={k} value={k}>
                                {LIST_KIND_LABEL[k]}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        label="Value"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        helperText={LIST_KIND_HINT[kind]}
                    />
                </Box>
                <TextField
                    select
                    label="Expires"
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                >
                    <MenuItem value="0">Never</MenuItem>
                    <MenuItem value="7">In 7 days</MenuItem>
                    <MenuItem value="30">In 30 days</MenuItem>
                    <MenuItem value="90">In 90 days</MenuItem>
                </TextField>
            </Box>
        </ReasonDialog>
    );
}
