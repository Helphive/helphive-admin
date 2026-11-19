import { useState } from 'react';
import dayjs from 'dayjs';
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
import { useRunReconciliationMutation } from './api';

const MAX_DAYS = 31;

/** Choose a period (up to 31 days) and run a reconciliation. Stripe is only read. */
export default function RunDialog({
    onClose,
    onDone,
}: {
    onClose: () => void;
    onDone: (runId: string, mismatches: number) => void;
}) {
    const [from, setFrom] = useState(dayjs().subtract(7, 'day').format('YYYY-MM-DD'));
    const [to, setTo] = useState(dayjs().format('YYYY-MM-DD'));
    const [run, state] = useRunReconciliationMutation();
    const [error, setError] = useState<string | null>(null);
    const days = dayjs(to).diff(dayjs(from), 'day') + 1;
    const problem =
        !from || !to
            ? 'Choose both dates.'
            : days < 1
              ? 'The start must be on or before the end.'
              : days > MAX_DAYS
                ? `A run covers at most ${MAX_DAYS} days.`
                : null;

    const confirm = async () => {
        setError(null);
        try {
            const result = await run({ from, to }).unwrap();
            onDone(result.run._id, result.run.counts.total ?? 0);
        } catch (err) {
            setError(getErrorMessage(err, 'The run did not finish. Try again.'));
        }
    };

    return (
        <Dialog
            open
            onClose={state.isLoading ? undefined : onClose}
            fullWidth
            maxWidth="sm"
            aria-labelledby="run-title"
        >
            <DialogTitle id="run-title">Run a reconciliation?</DialogTitle>
            <DialogContent>
                <DialogContentText sx={{ mb: 2 }}>
                    Reads every payment, refund, transfer and payout Stripe has for these days and
                    compares them with our records. Nothing in Stripe or the database changes. A
                    week takes under a minute.
                </DialogContentText>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <TextField
                        type="date"
                        label="From"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        inputProps={{ max: to }}
                    />
                    <TextField
                        type="date"
                        label="To (included)"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        inputProps={{ max: dayjs().format('YYYY-MM-DD') }}
                    />
                </Box>
                {problem && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                        {problem}
                    </Alert>
                )}
                {error && (
                    <Alert severity="error" role="alert" sx={{ mt: 2 }}>
                        {error}
                    </Alert>
                )}
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" onClick={onClose} disabled={state.isLoading}>
                    Go back
                </Button>
                <Button
                    variant="contained"
                    onClick={confirm}
                    disabled={state.isLoading || Boolean(problem)}
                    startIcon={state.isLoading ? <CircularProgress size={16} /> : undefined}
                >
                    {state.isLoading
                        ? 'Reading Stripe'
                        : `Run for ${days} day${days === 1 ? '' : 's'}`}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
