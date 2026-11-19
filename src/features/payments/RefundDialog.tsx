import { useState } from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    InputAdornment,
    Radio,
    RadioGroup,
    TextField,
    Typography,
} from '@mui/material';
import { KeyValue } from '@/components/ui';
import { useToast } from '@/components/feedback/toastContext';
import { errorCode, getErrorMessage } from '@/lib/api';
import { cents, formatMoney, parseMoney } from '@/lib/money';
import { color, font } from '@/theme/tokens';
import { useRefundPaymentMutation, type PaymentRecord } from './api';

/** A new idempotency key: one per opening of the dialog, reused for every retry inside it. */
function newKey() {
    try {
        return crypto.randomUUID();
    } catch {
        return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    }
}

type Failure = {
    code: string | undefined;
    message: string;
    /** What the operator can do next. */
    next: 'retry-same' | 'new-key' | 'reload' | 'close' | 'fix';
};

function classify(err: unknown): Failure {
    const code = errorCode(err);
    const message = getErrorMessage(err, 'The refund was not made. Try again.');
    switch (code) {
        case 'refund_conflict':
            return {
                code,
                message:
                    'This payment changed meanwhile: another refund was made at the same moment. Nothing was refunded by this request. Reload the payment, check what is left, then try again.',
                next: 'reload',
            };
        case 'nothing_left':
            return {
                code,
                message:
                    'This payment has already been refunded in full. Nothing more can be refunded.',
                next: 'close',
            };
        case 'not_paid':
            return { code, message, next: 'close' };
        case 'too_much':
            return { code, message, next: 'fix' };
        case 'refund_in_progress':
            return {
                code,
                message:
                    'This refund is already being processed. Send it again in a moment to see its result; it cannot refund twice.',
                next: 'retry-same',
            };
        case 'stripe_unavailable':
            return {
                code,
                message:
                    'Stripe did not answer, so the outcome is unknown. Send the same refund again to finish it; Stripe will not refund twice.',
                next: 'retry-same',
            };
        case 'refund_failed':
        case 'stripe_refused':
            return {
                code,
                message: `${message} Nothing was refunded. Start a new refund to try again.`,
                next: 'new-key',
            };
        default:
            return { code, message, next: 'fix' };
    }
}

export default function RefundDialog({
    payment,
    customerName,
    onClose,
    onReload,
}: {
    payment: PaymentRecord;
    customerName: string;
    onClose: () => void;
    onReload: () => void;
}) {
    const toast = useToast();
    const [key, setKey] = useState(newKey);
    const [mode, setMode] = useState<'full' | 'partial'>('full');
    const [amountText, setAmountText] = useState('');
    const [reason, setReason] = useState('');
    const [tried, setTried] = useState(false);
    const [failure, setFailure] = useState<Failure | null>(null);
    const [refund, state] = useRefundPaymentMutation();
    const busy = state.isLoading;

    const paid = payment.amount;
    const refunded = payment.refund?.totalRefunded ?? 0;
    const left = payment.remainingRefundable;
    const partial = mode === 'partial' ? parseMoney(amountText) : null;
    const amount = mode === 'full' ? left : (partial ?? 0);
    const after = cents(left - amount);

    const amountError =
        mode !== 'partial'
            ? ''
            : partial === null
              ? 'Give an amount in dollars, with at most two decimals'
              : partial > left
                ? `At most ${formatMoney(left)} is left to refund`
                : '';
    const reasonError = reason.trim().length < 3 ? 'Give a reason of at least 3 characters' : '';
    const locked = failure?.next === 'close' || left <= 0;

    const submit = async () => {
        setTried(true);
        if (amountError || reasonError || locked) return;
        setFailure(null);
        try {
            const res = await refund({
                id: payment._id,
                amount: mode === 'full' ? undefined : amount,
                reason: reason.trim(),
                idempotencyKey: key,
            }).unwrap();
            const status = res.refund.status;
            toast.success(
                res.replayed
                    ? `This refund was already made: ${formatMoney(res.refund.amount)} to ${customerName}`
                    : status === 'succeeded'
                      ? `Refunded ${formatMoney(res.refund.amount)} to ${customerName}`
                      : `Refund of ${formatMoney(res.refund.amount)} requested; Stripe confirms it shortly`
            );
            onClose();
        } catch (err) {
            setFailure(classify(err));
        }
    };

    const startOver = () => {
        setKey(newKey());
        setFailure(null);
    };

    return (
        <Dialog
            open
            onClose={busy ? undefined : onClose}
            fullWidth
            maxWidth="sm"
            aria-labelledby="refund-title"
        >
            <DialogTitle id="refund-title">
                Refund {payment.bookingReference ?? 'this payment'}
            </DialogTitle>
            <DialogContent>
                <KeyValue
                    columns={3}
                    sx={{ mb: 2.5 }}
                    items={[
                        { label: 'Paid', value: formatMoney(paid) },
                        { label: 'Already refunded', value: formatMoney(refunded) },
                        {
                            label: 'Left to refund',
                            value: (
                                <Box component="span" sx={{ fontWeight: 800 }}>
                                    {formatMoney(left)}
                                </Box>
                            ),
                        },
                    ]}
                />
                <RadioGroup
                    value={mode}
                    onChange={(e) => setMode(e.target.value as 'full' | 'partial')}
                    aria-label="How much to refund"
                    sx={{ mb: 1 }}
                >
                    <FormControlLabel
                        value="full"
                        control={<Radio size="small" />}
                        label={`Everything left, ${formatMoney(left)}`}
                        disabled={busy || locked}
                    />
                    <FormControlLabel
                        value="partial"
                        control={<Radio size="small" />}
                        label="Part of it"
                        disabled={busy || locked}
                    />
                </RadioGroup>
                {mode === 'partial' && (
                    <TextField
                        label="Amount to refund"
                        value={amountText}
                        onChange={(e) => setAmountText(e.target.value)}
                        disabled={busy || locked}
                        autoFocus
                        error={tried && Boolean(amountError)}
                        helperText={
                            tried && amountError ? amountError : `Up to ${formatMoney(left)}`
                        }
                        slotProps={{
                            htmlInput: { inputMode: 'decimal' },
                            input: {
                                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                            },
                        }}
                        sx={{ mb: 2, maxWidth: 220 }}
                    />
                )}
                <TextField
                    label="Reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
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
                            : 'Recorded in the audit log with your name. The customer does not see it.'
                    }
                />
                {!locked && amount > 0 && !amountError && (
                    <Box
                        role="status"
                        sx={{
                            mt: 2.5,
                            p: 1.75,
                            borderRadius: '8px',
                            bgcolor: color.amber50,
                            border: `1px solid ${color.amber200}`,
                            fontSize: font.size.md,
                            color: color.ink900,
                            lineHeight: 1.55,
                        }}
                    >
                        Refund <strong>{formatMoney(amount)}</strong> of {formatMoney(paid)} to{' '}
                        {customerName}'s original payment method?{' '}
                        {after > 0 && (
                            <>
                                <strong>{formatMoney(after)}</strong> will remain refundable.{' '}
                            </>
                        )}
                        The provider's earning is not changed. This cannot be undone.
                    </Box>
                )}
                {failure && (
                    <Alert
                        severity={failure.next === 'close' ? 'info' : 'error'}
                        role="alert"
                        sx={{ mt: 2 }}
                        action={
                            failure.next === 'reload' ? (
                                <Button
                                    color="inherit"
                                    size="small"
                                    onClick={() => {
                                        onReload();
                                        setFailure(null);
                                    }}
                                >
                                    Reload payment
                                </Button>
                            ) : failure.next === 'new-key' ? (
                                <Button color="inherit" size="small" onClick={startOver}>
                                    Start a new refund
                                </Button>
                            ) : undefined
                        }
                    >
                        {failure.message}
                    </Alert>
                )}
                <Typography variant="caption" component="p" sx={{ mt: 2, color: color.ink500 }}>
                    Retrying from this dialog reuses the same request key, so a refund is never made
                    twice.
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" onClick={onClose} disabled={busy}>
                    {locked ? 'Close' : 'Go back'}
                </Button>
                {!locked && (
                    <Button
                        variant="contained"
                        color="error"
                        onClick={submit}
                        disabled={busy || failure?.next === 'new-key'}
                        startIcon={busy ? <CircularProgress size={16} /> : undefined}
                    >
                        {busy
                            ? 'Refunding'
                            : failure?.next === 'retry-same'
                              ? 'Send again'
                              : amount > 0 && !amountError
                                ? `Refund ${formatMoney(amount)}`
                                : 'Refund'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
