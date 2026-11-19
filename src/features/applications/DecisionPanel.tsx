import { useState } from 'react';
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
    FormControlLabel,
    Radio,
    RadioGroup,
    TextField,
    Typography,
} from '@mui/material';
import { Panel } from '@/components/ui';
import { DiffView } from '@/components/detail';
import { ApproveIcon, RejectIcon } from '@/components/ui/icons';
import { useToast } from '@/components/feedback/toastContext';
import RequirePermission from '@/features/auth/RequirePermission';
import { getErrorMessage } from '@/lib/api';
import { color, font, hairline, radius } from '@/theme/tokens';
import { useDecideApplicationMutation } from './api';
import { REJECTION_REASONS, SERVICES, STATUS_META, type Application } from './model';
import { ApplicationStatusPill } from './parts';

type Decision = 'approved' | 'rejected';

const OTHER = 'other';

/** The text the backend sends to the applicant on rejection (see admin.controller.ts). */
const rejectionNotice = (reason: string) =>
    `Your provider application was not approved.${reason ? ` Reason: ${reason}` : ''}`;

function serviceSentence(a: Application) {
    const names = a.services.map((s) => SERVICES[s].label.toLowerCase());
    if (!names.length) return 'jobs';
    if (names.length === 1) return `${names[0]} jobs`;
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} jobs`;
}

function DecisionDialog({
    application,
    decision,
    onClose,
    onDone,
}: {
    application: Application;
    decision: Decision;
    onClose: () => void;
    onDone: (decision: Decision) => void;
}) {
    const toast = useToast();
    const [decide, { isLoading, error, reset }] = useDecideApplicationMutation();
    const [preset, setPreset] = useState<string>('');
    const [custom, setCustom] = useState('');
    const [details, setDetails] = useState('');
    const [tried, setTried] = useState(false);

    const approving = decision === 'approved';
    const base = preset === OTHER ? custom.trim() : preset;
    const message = approving ? '' : [base, details.trim()].filter(Boolean).join('. ');
    const missing = !approving && !base;
    const reviewed = application.status !== 'pending';

    const confirm = async () => {
        setTried(true);
        if (missing) return;
        try {
            await decide({ id: application.id, decision, message }).unwrap();
            toast.success(`${approving ? 'Approved' : 'Rejected'} ${application.name}`);
            onDone(decision);
        } catch {
            // The error shows inside the dialog; the dialog stays open so nothing typed is lost.
        }
    };

    return (
        <Dialog
            open
            onClose={isLoading ? undefined : onClose}
            fullWidth
            maxWidth="sm"
            aria-labelledby="decision-title"
            aria-describedby="decision-description"
        >
            <DialogTitle id="decision-title">
                {approving ? `Approve ${application.name}?` : `Reject ${application.name}?`}
            </DialogTitle>
            <DialogContent>
                <DialogContentText id="decision-description" sx={{ mb: 2 }}>
                    {approving
                        ? `${application.firstName} becomes a provider and can accept ${serviceSentence(application)} straight away. HelpHive copies their photo to their profile, saves their contact details and sends them a notification that they were approved.`
                        : `${application.firstName} cannot accept jobs. HelpHive sends them a notification with the reason below, so write it for the applicant.`}
                    {reviewed &&
                        ` This replaces the earlier decision (${STATUS_META[application.status].label.toLowerCase()}).`}
                </DialogContentText>

                {!approving && (
                    <Box sx={{ display: 'grid', gap: 1.5, mb: 2 }}>
                        <Box component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
                            <Typography component="legend" variant="subtitle2" sx={{ mb: 0.5 }}>
                                Reason
                            </Typography>
                            <RadioGroup
                                value={preset}
                                onChange={(e) => setPreset(e.target.value)}
                                name="reason"
                            >
                                {REJECTION_REASONS.map((r) => (
                                    <FormControlLabel
                                        key={r}
                                        value={r}
                                        control={<Radio size="small" />}
                                        label={r}
                                    />
                                ))}
                                <FormControlLabel
                                    value={OTHER}
                                    control={<Radio size="small" />}
                                    label="Another reason"
                                />
                            </RadioGroup>
                            {tried && missing && (
                                <Typography
                                    role="alert"
                                    sx={{
                                        color: color.red700,
                                        fontSize: font.size.sm,
                                        fontWeight: 600,
                                    }}
                                >
                                    {preset === OTHER
                                        ? 'Write the reason for the applicant'
                                        : 'Choose a reason'}
                                </Typography>
                            )}
                        </Box>
                        {preset === OTHER && (
                            <TextField
                                label="Reason"
                                value={custom}
                                onChange={(e) => setCustom(e.target.value)}
                                required
                                autoFocus
                                inputProps={{ maxLength: 200 }}
                            />
                        )}
                        <TextField
                            label="More detail for the applicant (optional)"
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            multiline
                            minRows={2}
                            inputProps={{ maxLength: 400 }}
                            helperText="For example, which document to send again."
                        />
                        <Box
                            sx={{
                                p: 1.5,
                                border: hairline,
                                borderRadius: `${radius.sm}px`,
                                bgcolor: color.subtle,
                                fontSize: font.size.sm,
                            }}
                        >
                            <Typography variant="caption" component="p" sx={{ mb: 0.5 }}>
                                Notification the applicant receives
                            </Typography>
                            {rejectionNotice(message)}
                        </Box>
                    </Box>
                )}

                <Typography variant="caption" component="p" sx={{ mb: 0.75 }}>
                    What changes on the application
                </Typography>
                <DiffView
                    before={{
                        status: STATUS_META[application.status].label,
                        rejectReason: application.rejectReason,
                    }}
                    after={{ status: STATUS_META[decision].label, rejectReason: message }}
                    labels={{ status: 'Status', rejectReason: 'Reason' }}
                />

                {error && (
                    <Alert severity="error" sx={{ mt: 2 }} onClose={reset}>
                        {getErrorMessage(error, 'The decision was not saved.')} Nothing changed; try
                        again.
                    </Alert>
                )}
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" onClick={onClose} disabled={isLoading}>
                    Go back
                </Button>
                <Button
                    variant="contained"
                    color={approving ? 'primary' : 'error'}
                    onClick={confirm}
                    disabled={isLoading}
                    aria-busy={isLoading || undefined}
                    startIcon={isLoading ? <CircularProgress size={16} /> : undefined}
                >
                    {isLoading
                        ? approving
                            ? 'Approving'
                            : 'Rejecting'
                        : approving
                          ? 'Approve application'
                          : 'Reject application'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

/**
 * Side panel on an application: approve or reject a waiting application, or see (and, if
 * needed, change) the decision on a reviewed one. Every decision goes through a confirmation.
 */
export default function DecisionPanel({
    application,
    onDecided,
}: {
    application: Application;
    onDecided: (decision: Decision) => void;
}) {
    const [open, setOpen] = useState<Decision | null>(null);
    const pending = application.status === 'pending';

    return (
        <Panel title="Decision">
            {pending ? (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Check the photo, ID, DBS certificate and CV before deciding. The applicant is
                    told either way.
                </Typography>
            ) : (
                <Box sx={{ mb: 2, display: 'grid', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ApplicationStatusPill status={application.status} size="md" />
                    </Box>
                    {application.status === 'rejected' && (
                        <Typography variant="body2">
                            Reason given: {application.rejectReason || 'none recorded'}
                        </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">
                        The API does not record when this decision was made or by whom.
                    </Typography>
                </Box>
            )}
            <RequirePermission permission="applications.decide" fallback={null}>
                {pending ? (
                    <Box sx={{ display: 'grid', gap: 1 }}>
                        <Button
                            variant="contained"
                            startIcon={<ApproveIcon />}
                            onClick={() => setOpen('approved')}
                        >
                            Approve
                        </Button>
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<RejectIcon />}
                            onClick={() => setOpen('rejected')}
                            sx={{ borderColor: color.red200, color: color.red700 }}
                        >
                            Reject
                        </Button>
                    </Box>
                ) : (
                    <Button
                        variant="outlined"
                        fullWidth
                        onClick={() =>
                            setOpen(application.status === 'approved' ? 'rejected' : 'approved')
                        }
                    >
                        {application.status === 'approved'
                            ? 'Change to rejected'
                            : 'Change to approved'}
                    </Button>
                )}
            </RequirePermission>
            {open && (
                <DecisionDialog
                    application={application}
                    decision={open}
                    onClose={() => setOpen(null)}
                    onDone={(d) => {
                        setOpen(null);
                        onDecided(d);
                    }}
                />
            )}
        </Panel>
    );
}
