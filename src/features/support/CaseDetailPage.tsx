import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, MenuItem, TextField, Typography } from '@mui/material';
import {
    ConfirmDialog,
    DetailSkeleton,
    ErrorState,
    KeyValue,
    PageHeader,
    Panel,
    StatusPill,
} from '@/components/ui';
import { useToast } from '@/components/feedback/toastContext';
import GatedButton from '@/features/auth/GatedButton';
import { useActionGate } from '@/features/auth/useSession';
import RequirePermission from '@/features/auth/RequirePermission';
import AuditTrail from '@/features/audit/AuditTrail';
import { usePageCrumb } from '@/features/shell/crumbContext';
import { PersonBlock, RecordLink } from '@/features/finance/parts';
import { formatMoney } from '@/features/finance/model';
import { getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useDocumentTitle } from '@/lib/hooks';
import { color, font } from '@/theme/tokens';
import {
    useAddCaseNoteMutation,
    useGetCaseQuery,
    useLinkCaseActionMutation,
    useListAssigneesQuery,
    useResolveCaseMutation,
    useSendCaseMessageMutation,
    useUpdateCaseMutation,
} from './api';
import {
    ACTION_KINDS,
    CATEGORIES,
    OUTCOMES,
    PRIORITIES,
    PRIORITY_TONE,
    STATUSES,
    STATUS_TONE,
    labelOf,
} from './model';

const SKIP_REASONS: Record<string, string> = {
    demo_account: 'a shared demo account',
    invalid_address: 'an invalid address',
    reserved_domain: 'a test domain',
    disposable_domain: 'a disposable address',
    blocked_domain: 'a blocked domain',
    domain_not_found: 'a domain that does not exist',
    no_mail_server: 'a domain that takes no mail',
};

/** A small form dialog with its own busy and error state. */
function FormDialog({
    title,
    description,
    confirmLabel,
    onSubmit,
    onClose,
    children,
}: {
    title: string;
    description: string;
    confirmLabel: string;
    onSubmit: () => Promise<string | null | void>;
    onClose: () => void;
    children: ReactNode;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    return (
        <ConfirmDialog
            open
            title={title}
            description={description}
            confirmLabel={confirmLabel}
            loading={busy}
            onClose={onClose}
            onConfirm={async () => {
                setBusy(true);
                setError(null);
                try {
                    const problem = await onSubmit();
                    if (problem) setError(problem);
                } catch (err) {
                    setError(getErrorMessage(err, 'Nothing changed. Try again.'));
                }
                setBusy(false);
            }}
        >
            <Box sx={{ display: 'grid', gap: 2 }}>
                {children}
                {error && (
                    <Alert severity="error" role="alert">
                        {error}
                    </Alert>
                )}
            </Box>
        </ConfirmDialog>
    );
}

type Dialog = 'message' | 'action' | 'resolve' | null;

function Entry({ head, body, tone }: { head: ReactNode; body: ReactNode; tone?: string }) {
    return (
        <Box sx={{ py: 1.5, '& + &': { borderTop: `1px solid ${color.line}` } }}>
            <Box sx={{ fontSize: font.size.xs, color: tone ?? color.ink500, fontWeight: 700 }}>
                {head}
            </Box>
            <Box
                sx={{
                    mt: 0.5,
                    whiteSpace: 'pre-line',
                    color: color.ink900,
                    overflowWrap: 'anywhere',
                }}
            >
                {body}
            </Box>
        </Box>
    );
}

export default function CaseDetailPage() {
    const { caseId = '' } = useParams();
    const toast = useToast();
    const q = useGetCaseQuery(caseId);
    const assignees = useListAssigneesQuery();
    const [update] = useUpdateCaseMutation();
    const [addNote, noteState] = useAddCaseNoteMutation();
    const [sendMessage] = useSendCaseMessageMutation();
    const [linkAction] = useLinkCaseActionMutation();
    const [resolve] = useResolveCaseMutation();
    const manage = useActionGate('support.manage');
    const [dialog, setDialog] = useState<Dialog>(null);
    const [note, setNote] = useState('');
    const [msg, setMsg] = useState({ to: 'customer', subject: '', body: '', key: '' });
    const [act, setAct] = useState({
        kind: 'refund',
        targetType: 'payment',
        targetId: '',
        summary: '',
    });
    const [res, setRes] = useState({ outcome: 'resolved', summary: '' });

    const data = q.data;
    useDocumentTitle(data ? `${data.case.reference} ${data.case.subject}` : 'Case');
    usePageCrumb(data?.case.reference);

    if (q.isLoading) return <DetailSkeleton />;
    if (q.error || !data)
        return (
            <ErrorState
                title="Could not load this case"
                message={getErrorMessage(q.error, 'Try again.')}
                onRetry={q.refetch}
            />
        );
    const c = data.case;
    const done = c.status === 'resolved' || c.status === 'closed';

    const change = async (patch: Record<string, unknown>, what: string) => {
        try {
            await update({ id: c._id, expectedVersion: c.version, ...patch }).unwrap();
            toast.success(what);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Nothing changed.'));
        }
    };

    const parties = data.people.filter((p) => p.person);

    return (
        <>
            <PageHeader
                title={c.subject}
                badge={
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <StatusPill tone={STATUS_TONE[c.status] ?? 'grey'}>
                            {labelOf(c.status)}
                        </StatusPill>
                        <StatusPill tone={PRIORITY_TONE[c.priority] ?? 'grey'}>
                            {labelOf(c.priority)} priority
                        </StatusPill>
                    </Box>
                }
                subtitle={`${c.reference}, ${labelOf(c.category).toLowerCase()}. Opened ${formatDateTime(c.createdAt)}${c.openedBy?.email ? ` by ${c.openedBy.email}` : ''}.`}
                actions={
                    !done && (
                        <GatedButton
                            permission="support.manage"
                            variant="contained"
                            onClick={() => setDialog('resolve')}
                        >
                            Resolve case
                        </GatedButton>
                    )
                }
            />
            {c.resolution && (
                <Alert severity="success" sx={{ mb: 2.5 }}>
                    {labelOf(c.resolution.outcome)} on {formatDateTime(c.resolution.at)} by{' '}
                    {c.resolution.by?.email}: {c.resolution.summary}
                </Alert>
            )}
            <Box
                sx={{
                    display: 'grid',
                    gap: 2.5,
                    gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(0, 1fr)' },
                    alignItems: 'start',
                }}
            >
                <Box sx={{ display: 'grid', gap: 2.5, minWidth: 0 }}>
                    <Panel title="What happened">
                        <Typography sx={{ whiteSpace: 'pre-line', maxWidth: '75ch' }}>
                            {c.description}
                        </Typography>
                    </Panel>
                    <Panel
                        title="Emails to the people involved"
                        subtitle="Sent through the outbound email policy; skipped addresses are shown"
                        actions={
                            <GatedButton
                                permission="support.manage"
                                size="small"
                                variant="outlined"
                                blockedBecause={
                                    parties.length ? null : 'This case has nobody to email.'
                                }
                                onClick={() => {
                                    setMsg({
                                        to: parties[0]?.role ?? 'customer',
                                        subject: `About your case ${c.reference}`,
                                        body: '',
                                        key: crypto.randomUUID(),
                                    });
                                    setDialog('message');
                                }}
                            >
                                Email a party
                            </GatedButton>
                        }
                    >
                        {c.messages.length ? (
                            c.messages.map((m) => (
                                <Entry
                                    key={m._id}
                                    tone={m.result === 'sent' ? color.ink500 : color.red700}
                                    head={`To the ${m.to}, ${formatDateTime(m.at)}, by ${m.by?.email}: ${
                                        m.result === 'sent'
                                            ? 'sent'
                                            : m.result === 'skipped'
                                              ? `not sent, ${SKIP_REASONS[m.skippedBecause ?? ''] ?? 'refused by the email policy'}`
                                              : 'failed'
                                    }`}
                                    body={
                                        <>
                                            <strong>{m.subject}</strong>
                                            {'\n'}
                                            {m.body}
                                        </>
                                    }
                                />
                            ))
                        ) : (
                            <Typography sx={{ color: color.ink500 }}>No emails yet.</Typography>
                        )}
                    </Panel>
                    <Panel title="Internal notes" subtitle="Never shown to customers or providers">
                        {c.notes.map((n) => (
                            <Entry
                                key={n._id}
                                head={`${n.author?.email}, ${formatDateTime(n.at)}`}
                                body={n.body}
                            />
                        ))}
                        <Box sx={{ display: 'grid', gap: 1, mt: c.notes.length ? 1.5 : 0 }}>
                            <TextField
                                label="Add a note"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                multiline
                                minRows={2}
                                disabled={!manage.allowed}
                                inputProps={{ maxLength: 5000 }}
                            />
                            <Box>
                                <GatedButton
                                    permission="support.manage"
                                    variant="outlined"
                                    size="small"
                                    disabled={!note.trim() || noteState.isLoading}
                                    onClick={async () => {
                                        try {
                                            await addNote({ id: c._id, body: note }).unwrap();
                                            setNote('');
                                            toast.success('Added note');
                                        } catch (err) {
                                            toast.error(
                                                getErrorMessage(err, 'The note was not added.')
                                            );
                                        }
                                    }}
                                >
                                    Add note
                                </GatedButton>
                            </Box>
                        </Box>
                    </Panel>
                    <Panel
                        title="Actions taken"
                        subtitle="Refunds and other changes made for this case, with links to them"
                        actions={
                            <GatedButton
                                permission="support.manage"
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                    setAct({
                                        kind: 'refund',
                                        targetType: c.paymentId ? 'payment' : 'booking',
                                        targetId: c.paymentId ?? c.bookingId ?? '',
                                        summary: '',
                                    });
                                    setDialog('action');
                                }}
                            >
                                Link an action
                            </GatedButton>
                        }
                    >
                        {c.actions.length ? (
                            c.actions.map((a) => (
                                <Entry
                                    key={a._id}
                                    head={`${labelOf(a.kind)}, ${formatDateTime(a.at)}, by ${a.by?.email}`}
                                    body={
                                        <>
                                            {a.summary}{' '}
                                            <RecordLink
                                                link={{ type: a.targetType, id: a.targetId }}
                                            >
                                                Open {a.targetType}
                                            </RecordLink>
                                        </>
                                    }
                                />
                            ))
                        ) : (
                            <Typography sx={{ color: color.ink500 }}>
                                Nothing linked. After refunding or changing a booking from its page,
                                link it here.
                            </Typography>
                        )}
                    </Panel>
                    <RequirePermission permission="audit.read" fallback={null}>
                        <AuditTrail targetType="supportCase" targetId={c._id} title="Audit trail" />
                    </RequirePermission>
                </Box>
                <Box sx={{ display: 'grid', gap: 2.5, minWidth: 0 }}>
                    <Panel title="Case">
                        <Box sx={{ display: 'grid', gap: 2 }}>
                            <TextField
                                select
                                size="small"
                                label="Status"
                                value={c.status}
                                disabled={!manage.allowed}
                                onChange={(e) =>
                                    change(
                                        { status: e.target.value },
                                        `Moved to ${labelOf(e.target.value).toLowerCase()}`
                                    )
                                }
                                helperText={
                                    manage.allowed
                                        ? 'Resolve with the button above; a resolved case can be closed or reopened.'
                                        : manage.reason
                                }
                            >
                                {STATUSES.map((s) => (
                                    <MenuItem
                                        key={s.value}
                                        value={s.value}
                                        disabled={s.value === 'resolved'}
                                    >
                                        {s.label}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                size="small"
                                label="Priority"
                                value={c.priority}
                                disabled={!manage.allowed}
                                onChange={(e) =>
                                    change({ priority: e.target.value }, 'Changed priority')
                                }
                            >
                                {PRIORITIES.map((s) => (
                                    <MenuItem key={s.value} value={s.value}>
                                        {s.label}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                size="small"
                                label="Category"
                                value={c.category}
                                disabled={!manage.allowed}
                                onChange={(e) =>
                                    change({ category: e.target.value }, 'Changed category')
                                }
                            >
                                {CATEGORIES.map((s) => (
                                    <MenuItem key={s.value} value={s.value}>
                                        {s.label}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                size="small"
                                label="Assignee"
                                value={c.assignee?.id ?? ''}
                                disabled={!manage.allowed}
                                onChange={(e) =>
                                    change(
                                        { assigneeId: e.target.value || null },
                                        e.target.value ? 'Assigned' : 'Unassigned'
                                    )
                                }
                            >
                                <MenuItem value="">Nobody</MenuItem>
                                {c.assignee &&
                                    !assignees.data?.items.some(
                                        (a) => a._id === c.assignee!.id
                                    ) && (
                                        <MenuItem value={c.assignee.id}>
                                            {c.assignee.email}
                                        </MenuItem>
                                    )}
                                {assignees.data?.items.map((a) => (
                                    <MenuItem key={a._id} value={a._id}>
                                        {a.name || a.email}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Box>
                    </Panel>
                    {data.people.map((p) => (
                        <Panel
                            key={`${p.role}-${p.person?._id}`}
                            title={p.role === 'customer' ? 'Customer' : 'Provider'}
                        >
                            <PersonBlock person={p.person} role={p.role} />
                        </Panel>
                    ))}
                    {(data.booking || data.payment) && (
                        <Panel title="Linked records">
                            <KeyValue
                                variant="rows"
                                items={[
                                    ...(data.booking
                                        ? [
                                              {
                                                  label: 'Booking',
                                                  value: (
                                                      <RecordLink
                                                          link={{
                                                              type: 'booking',
                                                              id: data.booking._id,
                                                          }}
                                                      >
                                                          {data.booking.reference}
                                                      </RecordLink>
                                                  ),
                                              },
                                              {
                                                  label: 'Service',
                                                  value: data.booking.service?.name,
                                              },
                                              {
                                                  label: 'Starts',
                                                  value: formatDateTime(data.booking.startDate),
                                              },
                                              {
                                                  label: 'Booking status',
                                                  value: data.booking.status,
                                              },
                                          ]
                                        : []),
                                    ...(data.payment
                                        ? [
                                              {
                                                  label: 'Payment',
                                                  value: (
                                                      <RecordLink
                                                          link={{
                                                              type: 'payment',
                                                              id: data.payment._id,
                                                          }}
                                                      >
                                                          {formatMoney(data.payment.amount)}
                                                      </RecordLink>
                                                  ),
                                              },
                                              {
                                                  label: 'Refunded',
                                                  value: data.payment.refundAmount
                                                      ? `${formatMoney(data.payment.refundAmount)} (${data.payment.refundStatus})`
                                                      : 'Nothing',
                                              },
                                          ]
                                        : []),
                                ]}
                            />
                        </Panel>
                    )}
                </Box>
            </Box>

            {dialog === 'message' && (
                <FormDialog
                    title="Email this party?"
                    description="Sent from the support address. Addresses the email policy refuses (demo, disposable, unreachable) are skipped and recorded as such."
                    confirmLabel="Send email"
                    onClose={() => setDialog(null)}
                    onSubmit={async () => {
                        if (msg.subject.trim().length < 3 || !msg.body.trim())
                            return 'Write a subject and a message.';
                        const r = await sendMessage({
                            id: c._id,
                            to: msg.to as 'customer' | 'provider',
                            subject: msg.subject,
                            body: msg.body,
                            idempotencyKey: msg.key,
                        }).unwrap();
                        if (r.result === 'skipped')
                            toast.show(
                                `Not sent: ${SKIP_REASONS[r.skippedBecause ?? ''] ?? 'the email policy refused the address'}`,
                                { tone: 'warning' }
                            );
                        else toast.success(`Emailed the ${msg.to}`);
                        setDialog(null);
                    }}
                >
                    <TextField
                        select
                        label="To"
                        value={msg.to}
                        onChange={(e) => setMsg({ ...msg, to: e.target.value })}
                    >
                        {parties.map((p) => (
                            <MenuItem key={p.role} value={p.role}>
                                {p.person!.name} ({p.role})
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        label="Subject"
                        value={msg.subject}
                        onChange={(e) => setMsg({ ...msg, subject: e.target.value })}
                        inputProps={{ maxLength: 150 }}
                    />
                    <TextField
                        label="Message"
                        value={msg.body}
                        onChange={(e) => setMsg({ ...msg, body: e.target.value })}
                        multiline
                        minRows={5}
                        inputProps={{ maxLength: 5000 }}
                    />
                </FormDialog>
            )}
            {dialog === 'action' && (
                <FormDialog
                    title="Link an action to this case?"
                    description="Records what was done and where. It does not refund or change anything itself: do that from the record's page first."
                    confirmLabel="Link action"
                    onClose={() => setDialog(null)}
                    onSubmit={async () => {
                        if (!/^[a-f\d]{24}$/i.test(act.targetId.trim()))
                            return 'Paste the 24-character id of the record.';
                        if (act.summary.trim().length < 3) return 'Summarise what was done.';
                        await linkAction({
                            id: c._id,
                            ...act,
                            targetId: act.targetId.trim(),
                        }).unwrap();
                        toast.success('Linked action');
                        setDialog(null);
                    }}
                >
                    <TextField
                        select
                        label="What was done"
                        value={act.kind}
                        onChange={(e) => setAct({ ...act, kind: e.target.value })}
                    >
                        {ACTION_KINDS.map((k) => (
                            <MenuItem key={k.value} value={k.value}>
                                {k.label}
                            </MenuItem>
                        ))}
                    </TextField>
                    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 2fr' }}>
                        <TextField
                            select
                            label="On a"
                            value={act.targetType}
                            onChange={(e) => setAct({ ...act, targetType: e.target.value })}
                        >
                            <MenuItem value="payment">Payment</MenuItem>
                            <MenuItem value="booking">Booking</MenuItem>
                            <MenuItem value="user">Person</MenuItem>
                        </TextField>
                        <TextField
                            label="Its id"
                            value={act.targetId}
                            onChange={(e) => setAct({ ...act, targetId: e.target.value })}
                        />
                    </Box>
                    <TextField
                        label="Summary"
                        value={act.summary}
                        onChange={(e) => setAct({ ...act, summary: e.target.value })}
                        multiline
                        minRows={2}
                        inputProps={{ maxLength: 1000 }}
                    />
                </FormDialog>
            )}
            {dialog === 'resolve' && (
                <FormDialog
                    title="Resolve this case?"
                    description="The case leaves the open list. It can be reopened later; nobody is emailed."
                    confirmLabel="Resolve case"
                    onClose={() => setDialog(null)}
                    onSubmit={async () => {
                        if (res.summary.trim().length < 3) return 'Summarise how it ended.';
                        await resolve({ id: c._id, ...res }).unwrap();
                        toast.success(`Resolved ${c.reference}`);
                        setDialog(null);
                    }}
                >
                    <TextField
                        select
                        label="Outcome"
                        value={res.outcome}
                        onChange={(e) => setRes({ ...res, outcome: e.target.value })}
                    >
                        {OUTCOMES.map((o) => (
                            <MenuItem key={o.value} value={o.value}>
                                {o.label}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        label="Summary"
                        value={res.summary}
                        onChange={(e) => setRes({ ...res, summary: e.target.value })}
                        multiline
                        minRows={3}
                        inputProps={{ maxLength: 2000 }}
                    />
                </FormDialog>
            )}
        </>
    );
}
