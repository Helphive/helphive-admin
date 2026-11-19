import { useState, type ReactNode } from 'react';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Radio,
    RadioGroup,
    TextField,
    Typography,
} from '@mui/material';
import { KeyValue, Panel, ReasonDialog } from '@/components/ui';
import { DisableIcon, ReleaseIcon, ResolveIcon } from '@/components/ui/icons';
import { useToast } from '@/components/feedback/toastContext';
import GatedButton from '@/features/auth/GatedButton';
import { getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { color, font } from '@/theme/tokens';
import {
    resolvePreviewFrom,
    useCancelBookingMutation,
    useReleaseBookingMutation,
    useResolveBookingMutation,
    type BookingDetail,
    type ResolvePreview,
} from './api';

type Action = 'cancel-customer' | 'cancel-provider' | 'release' | 'resolve';

/** What a cancellation refunds, worded from the API's rules (section 4, cancel). */
function cancelRefundSentence(d: BookingDetail): string {
    const paid = d.payments.find((p) => p.status === 'completed');
    if (!paid) return 'Not paid: nothing to refund.';
    if (paid.refund?.status)
        return `Already refunded: nothing more is refunded by the cancellation.${paid.remainingRefundable > 0 ? ` ${formatMoney(paid.remainingRefundable)} is still refundable from the payment.` : ''}`;
    return `Paid: the customer is refunded ${formatMoney(paid.amount)} in full.`;
}

/** Bold every dollar amount in a sentence from the API. */
function boldMoney(text: string): ReactNode {
    return text
        .split(/(\$[\d,]+(?:\.\d{2})?)/g)
        .map((part, i) =>
            /^\$/.test(part) ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
        );
}

function ResolveDialog({ d, onClose }: { d: BookingDetail; onClose: () => void }) {
    const toast = useToast();
    const b = d.booking;
    const [outcome, setOutcome] = useState<'completed' | 'cancelled'>('completed');
    const [refund, setRefund] = useState<'full' | 'none'>('full');
    const [reason, setReason] = useState('');
    const [preview, setPreview] = useState<ResolvePreview | null>(null);
    const [understood, setUnderstood] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tried, setTried] = useState(false);
    const [resolve, state] = useResolveBookingMutation();
    const busy = state.isLoading;
    const reasonError = reason.trim().length < 3 ? 'Give a reason of at least 3 characters' : '';

    const body = {
        id: b._id,
        outcome,
        refund: outcome === 'cancelled' ? refund : undefined,
        reason: reason.trim(),
    };

    const reset = () => {
        setPreview(null);
        setUnderstood(false);
        setError(null);
    };

    const loadPreview = async () => {
        setTried(true);
        setError(null);
        if (reasonError) return;
        try {
            // Without confirm the API changes nothing and answers 409 with the preview.
            await resolve({ ...body, confirm: false }).unwrap();
            setError('The API resolved nothing and sent no preview. Reload the booking.');
        } catch (err) {
            const p = resolvePreviewFrom(err);
            if (p) setPreview(p);
            else setError(getErrorMessage(err, 'Could not get the preview. Try again.'));
        }
    };

    const confirm = async () => {
        if (!preview || !understood) return;
        setError(null);
        try {
            await resolve({ ...body, confirm: true }).unwrap();
            toast.success(
                outcome === 'completed'
                    ? `Resolved ${b.reference} as completed`
                    : `Resolved ${b.reference} as cancelled`
            );
            onClose();
        } catch (err) {
            const p = resolvePreviewFrom(err);
            if (p) {
                setPreview(p);
                setUnderstood(false);
                setError('The figures changed. Read the new preview, then confirm again.');
            } else setError(getErrorMessage(err, 'Nothing changed. Try again.'));
        }
    };

    return (
        <Dialog
            open
            onClose={busy ? undefined : onClose}
            fullWidth
            maxWidth="sm"
            aria-labelledby="resolve-title"
        >
            <DialogTitle id="resolve-title">Resolve {b.reference}?</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    This booking is stuck in progress. Choose how it ended; the console first asks
                    the API what that does to the money, and nothing changes until you confirm.
                </Typography>
                <RadioGroup
                    value={outcome}
                    onChange={(e) => {
                        setOutcome(e.target.value as 'completed' | 'cancelled');
                        reset();
                    }}
                    aria-label="How the booking ended"
                >
                    <FormControlLabel
                        value="completed"
                        control={<Radio size="small" />}
                        label="The shift was worked: mark it completed and pay the provider"
                        disabled={busy}
                    />
                    <FormControlLabel
                        value="cancelled"
                        control={<Radio size="small" />}
                        label="The shift did not happen: cancel it"
                        disabled={busy}
                    />
                </RadioGroup>
                {outcome === 'cancelled' && (
                    <RadioGroup
                        value={refund}
                        onChange={(e) => {
                            setRefund(e.target.value as 'full' | 'none');
                            reset();
                        }}
                        aria-label="Refund"
                        sx={{ ml: 3.5, mb: 1 }}
                    >
                        <FormControlLabel
                            value="full"
                            control={<Radio size="small" />}
                            label="Refund the customer in full"
                            disabled={busy}
                        />
                        <FormControlLabel
                            value="none"
                            control={<Radio size="small" />}
                            label="No refund (refund part of it from the payment afterwards if needed)"
                            disabled={busy}
                        />
                    </RadioGroup>
                )}
                <TextField
                    label="Reason"
                    value={reason}
                    onChange={(e) => {
                        setReason(e.target.value);
                        if (preview) reset();
                    }}
                    multiline
                    minRows={2}
                    fullWidth
                    required
                    disabled={busy}
                    inputProps={{ maxLength: 1000 }}
                    error={tried && Boolean(reasonError)}
                    helperText={
                        tried && reasonError
                            ? reasonError
                            : 'Recorded in the audit log with your name.'
                    }
                    sx={{ mt: 1.5 }}
                />
                {preview && (
                    <Box
                        role="region"
                        aria-label="What resolving does"
                        sx={{
                            mt: 2.5,
                            p: 2,
                            borderRadius: '8px',
                            border: `1px solid ${color.amber200}`,
                            bgcolor: color.amber50,
                        }}
                    >
                        <Typography
                            sx={{
                                fontSize: font.size.md,
                                lineHeight: 1.55,
                                color: color.ink900,
                                mb: 1.5,
                            }}
                        >
                            {boldMoney(preview.explanation)}
                        </Typography>
                        <KeyValue
                            columns={4}
                            items={[
                                { label: 'Customer paid', value: formatMoney(preview.paid) },
                                {
                                    label: 'Provider earns',
                                    value: formatMoney(preview.providerEarning),
                                },
                                { label: 'Platform fee', value: formatMoney(preview.platformFee) },
                                {
                                    label: 'Customer refund',
                                    value: formatMoney(preview.customerRefund),
                                },
                                {
                                    label: 'Scheduled end',
                                    value: preview.scheduledEnd
                                        ? formatDateTime(preview.scheduledEnd)
                                        : '',
                                },
                                { label: 'Overdue by', value: preview.overdue ?? '' },
                            ]}
                        />
                        <FormControlLabel
                            sx={{ mt: 1.5 }}
                            control={
                                <Checkbox
                                    checked={understood}
                                    onChange={(e) => setUnderstood(e.target.checked)}
                                    disabled={busy}
                                />
                            }
                            label="I have read what this does to the money"
                        />
                    </Box>
                )}
                {error && (
                    <Alert severity="error" role="alert" sx={{ mt: 2 }}>
                        {error}
                    </Alert>
                )}
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" onClick={onClose} disabled={busy}>
                    Go back
                </Button>
                {preview ? (
                    <Button
                        variant="contained"
                        color="error"
                        onClick={confirm}
                        disabled={busy || !understood}
                        startIcon={busy ? <CircularProgress size={16} /> : undefined}
                    >
                        {outcome === 'completed' ? 'Resolve as completed' : 'Resolve as cancelled'}
                    </Button>
                ) : (
                    <Button
                        variant="contained"
                        onClick={loadPreview}
                        disabled={busy}
                        startIcon={busy ? <CircularProgress size={16} /> : undefined}
                    >
                        Show what this does
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}

function Dialogs({
    d,
    action,
    onClose,
}: {
    d: BookingDetail;
    action: Action;
    onClose: () => void;
}) {
    const toast = useToast();
    const [cancel] = useCancelBookingMutation();
    const [release] = useReleaseBookingMutation();
    const b = d.booking;
    if (action === 'resolve') return <ResolveDialog d={d} onClose={onClose} />;
    if (action === 'release') {
        const provider = d.provider?.name ?? 'the provider';
        return (
            <ReasonDialog
                title={`Remove ${provider} from ${b.reference} and offer it to other providers?`}
                effect={`Both are notified. If nobody accepts before ${formatDateTime(b.startDate)}, it expires and the customer is refunded. No money moves now and ${provider} is not penalised.`}
                reason="required"
                confirmLabel="Release booking"
                busyLabel="Releasing"
                onConfirm={async (reason) => {
                    const res = await release({ id: b._id, reason }).unwrap();
                    toast.success(
                        `Released ${b.reference}; ${res.providersAlerted} ${res.providersAlerted === 1 ? 'provider' : 'providers'} alerted`
                    );
                    onClose();
                }}
                onClose={onClose}
            />
        );
    }
    const party = action === 'cancel-customer' ? 'customer' : 'provider';
    return (
        <ReasonDialog
            title={`Cancel booking ${b.reference} for the ${party}?`}
            effect={
                <>
                    Both are notified, as when they cancel themselves. {cancelRefundSentence(d)}{' '}
                    Your reason is not shown to the customer.
                </>
            }
            reason="required"
            destructive
            confirmLabel="Cancel booking"
            busyLabel="Cancelling"
            onConfirm={async (reason) => {
                const res = await cancel({ id: b._id, onBehalfOf: party, reason }).unwrap();
                const r = res.refund;
                if (r.outcome === 'error')
                    toast.error(`Cancelled ${b.reference}. ${r.explanation}`);
                else toast.success(`Cancelled ${b.reference}. ${r.explanation}`);
                onClose();
            }}
            onClose={onClose}
        />
    );
}

/** Booking actions; each states what it does to people and money before it runs. */
export default function BookingActions({ d, now }: { d: BookingDetail; now: number }) {
    const [open, setOpen] = useState<Action | null>(null);
    const b = d.booking;
    const pending = b.status === 'pending';
    const startAhead = new Date(b.startDate).getTime() > now;
    const notPending = pending
        ? null
        : `Only a booking that has not started can be cancelled; this one is ${b.status}.`;

    return (
        <Panel
            title="Actions"
            subtitle={
                pending
                    ? 'Before the shift starts'
                    : b.status === 'in progress'
                      ? 'The shift is under way'
                      : `This booking is ${b.status}; refunds are made from its payment`
            }
        >
            <Box sx={{ display: 'grid', gap: 1 }}>
                <GatedButton
                    permission="bookings.manage"
                    variant="outlined"
                    color="error"
                    fullWidth
                    startIcon={<DisableIcon />}
                    onClick={() => setOpen('cancel-customer')}
                    blockedBecause={notPending}
                    sx={{ borderColor: color.red200, color: color.red700 }}
                >
                    Cancel for the customer
                </GatedButton>
                <GatedButton
                    permission="bookings.manage"
                    variant="outlined"
                    color="error"
                    fullWidth
                    startIcon={<DisableIcon />}
                    onClick={() => setOpen('cancel-provider')}
                    blockedBecause={
                        notPending ??
                        (!b.providerId ? 'No provider has accepted this booking.' : null)
                    }
                    sx={{ borderColor: color.red200, color: color.red700 }}
                >
                    Cancel for the provider
                </GatedButton>
                <GatedButton
                    permission="bookings.manage"
                    variant="outlined"
                    fullWidth
                    startIcon={<ReleaseIcon />}
                    onClick={() => setOpen('release')}
                    blockedBecause={
                        !pending
                            ? `Only an accepted booking that has not started can be released; this one is ${b.status}.`
                            : !b.providerId
                              ? 'No provider has accepted this booking.'
                              : !startAhead
                                ? 'The start time has passed; cancel it instead.'
                                : null
                    }
                >
                    Release to other providers
                </GatedButton>
                <GatedButton
                    permission="bookings.manage"
                    variant="outlined"
                    fullWidth
                    startIcon={<ResolveIcon />}
                    onClick={() => setOpen('resolve')}
                    blockedBecause={
                        b.status !== 'in progress'
                            ? 'Only a booking stuck in progress can be resolved.'
                            : null
                    }
                    showReason={b.status === 'in progress'}
                >
                    Resolve stuck booking
                </GatedButton>
            </Box>
            {open && <Dialogs d={d} action={open} onClose={() => setOpen(null)} />}
        </Panel>
    );
}
