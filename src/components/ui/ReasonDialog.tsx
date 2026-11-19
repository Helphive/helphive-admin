import { useState, type ReactNode } from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    TextField,
} from '@mui/material';
import { getErrorMessage } from '@/lib/api';

export interface ReasonDialogProps {
    /** A question naming the action ("Disable Jane Doe?"). */
    title: string;
    /** What happens, in plain words. */
    effect: ReactNode;
    /** Extra content above the reason (a role picker, a DiffView). */
    children?: ReactNode;
    reason: 'required' | 'optional' | 'none';
    /** Line under the reason field. */
    reasonHelp?: string;
    /** Keeps the confirm button off (e.g. while a preview loads). */
    confirmDisabled?: boolean;
    maxWidth?: 'xs' | 'sm' | 'md';
    confirmLabel: string;
    busyLabel: string;
    destructive?: boolean;
    /** Runs the action; throw (an RTK Query error) to keep the dialog open with the message. */
    onConfirm: (reason: string) => Promise<void>;
    onClose: () => void;
    /** Extra check before sending (e.g. "choose a different role"); return the message or null. */
    validate?: () => string | null;
}

/**
 * Confirmation for an admin-management action. States the effect, asks for a reason (recorded in
 * the audit log), shows the API's refusal (last super admin, own account, demo) where it happened
 * and keeps what was typed.
 */
export default function ReasonDialog({
    title,
    effect,
    children,
    reason: reasonMode,
    confirmLabel,
    busyLabel,
    destructive,
    onConfirm,
    onClose,
    validate,
    reasonHelp = 'Recorded in the audit log with your name.',
    confirmDisabled,
    maxWidth = 'sm',
}: ReasonDialogProps) {
    const [reason, setReason] = useState('');
    const [tried, setTried] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const required = reasonMode === 'required';
    const reasonError =
        required && reason.trim().length < 3 ? 'Give a reason of at least 3 characters' : '';
    // Optional reasons still follow the API's rule when given (3 to 1000 characters).
    const optionalError =
        reasonMode === 'optional' && reason.trim() && reason.trim().length < 3
            ? 'Leave it empty or give at least 3 characters'
            : '';
    const extraError = validate?.() ?? null;

    const confirm = async () => {
        setTried(true);
        setError(null);
        if (reasonError || optionalError || extraError) return;
        setBusy(true);
        try {
            await onConfirm(reason.trim());
        } catch (err) {
            setError(getErrorMessage(err, 'Nothing changed. Try again.'));
            setBusy(false);
        }
    };

    return (
        <Dialog
            open
            onClose={busy ? undefined : onClose}
            fullWidth
            maxWidth={maxWidth}
            aria-labelledby="reason-dialog-title"
            aria-describedby="reason-dialog-effect"
        >
            <DialogTitle id="reason-dialog-title">{title}</DialogTitle>
            <DialogContent>
                <DialogContentText id="reason-dialog-effect" component="div" sx={{ mb: 2 }}>
                    {effect}
                </DialogContentText>
                {children && <Box sx={{ mb: 2 }}>{children}</Box>}
                {tried && extraError && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        {extraError}
                    </Alert>
                )}
                {reasonMode !== 'none' && (
                    <TextField
                        label={required ? 'Reason' : 'Reason (optional)'}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        multiline
                        minRows={2}
                        fullWidth
                        required={required}
                        inputProps={{ maxLength: 1000 }}
                        error={tried && Boolean(reasonError || optionalError)}
                        helperText={
                            tried && (reasonError || optionalError)
                                ? reasonError || optionalError
                                : reasonHelp
                        }
                    />
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
                <Button
                    variant="contained"
                    color={destructive ? 'error' : 'primary'}
                    onClick={confirm}
                    disabled={busy || confirmDisabled}
                    aria-busy={busy || undefined}
                    startIcon={busy ? <CircularProgress size={16} /> : undefined}
                >
                    {busy ? busyLabel : confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
