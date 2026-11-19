import { useState, type FormEvent } from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { CopyTextIcon } from '@/components/ui/icons';
import { useToast } from '@/components/feedback/toastContext';
import { getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { color, font, hairline, radius } from '@/theme/tokens';
import { useCreateAdminMutation, type CreatedAdmin } from './api';
import RolePicker from './RolePicker';

const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The one-time password, shown once with a copy button. */
function OneTimePassword({ created, onDone }: { created: CreatedAdmin; onDone: () => void }) {
    const toast = useToast();
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(created.temporaryPassword);
            toast.success('Copied the one-time password');
        } catch {
            toast.error('The browser blocked the clipboard. Select the password and copy it.');
        }
    };
    return (
        <>
            <DialogContent>
                <Typography variant="body2" sx={{ mb: 2 }}>
                    Give {created.admin.firstName} this one-time password through a channel only
                    they can read. They choose their own password when they first sign in.
                </Typography>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 1.5,
                        pl: 2,
                        bgcolor: color.subtle,
                        border: hairline,
                        borderRadius: `${radius.md}px`,
                    }}
                >
                    <Box
                        component="code"
                        aria-label="One-time password"
                        sx={{
                            flex: 1,
                            fontFamily: mono,
                            fontSize: font.size.xl,
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                            overflowWrap: 'anywhere',
                            userSelect: 'all',
                            color: color.ink900,
                        }}
                    >
                        {created.temporaryPassword}
                    </Box>
                    <Tooltip title="Copy password">
                        <IconButton aria-label="Copy the one-time password" onClick={copy}>
                            <CopyTextIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
                <Alert severity="warning" sx={{ mt: 2 }}>
                    This is the only time the password is shown. It stops working at{' '}
                    {formatDateTime(created.temporaryPasswordExpiresAt)} if it has not been changed;
                    after that, create the admin again or ask engineering.
                </Alert>
            </DialogContent>
            <DialogActions>
                <Button variant="contained" onClick={onDone}>
                    Done
                </Button>
            </DialogActions>
        </>
    );
}

/** Add an admin: name, email, role; the API creates a one-time password that is shown once. */
export default function CreateAdminDialog({ onClose }: { onClose: () => void }) {
    const toast = useToast();
    const [create, { isLoading, error, reset }] = useCreateAdminMutation();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('');
    const [tried, setTried] = useState(false);
    const [created, setCreated] = useState<CreatedAdmin | null>(null);

    const errors = {
        firstName: firstName.trim().length < 2 ? 'Enter the first name (2 to 50 characters)' : '',
        lastName: lastName.trim().length < 2 ? 'Enter the last name (2 to 50 characters)' : '',
        email: !EMAIL_RE.test(email.trim()) ? 'Enter an email address like name@example.com' : '',
        role: role ? '' : 'Choose a role',
    };
    const invalid = Object.values(errors).some(Boolean);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setTried(true);
        reset();
        if (invalid) return;
        try {
            const res = await create({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim(),
                role,
            }).unwrap();
            setCreated(res);
            toast.success(`Added ${res.admin.name}`);
        } catch {
            // Shown in the dialog; what was typed stays.
        }
    };

    return (
        <Dialog
            open
            onClose={isLoading || created ? undefined : onClose}
            fullWidth
            maxWidth="sm"
            aria-labelledby="create-admin-title"
        >
            <DialogTitle id="create-admin-title">
                {created ? `${created.admin.name} was added` : 'Add an admin'}
            </DialogTitle>
            {created ? (
                <OneTimePassword created={created} onDone={onClose} />
            ) : (
                <Box component="form" noValidate onSubmit={submit}>
                    <DialogContent>
                        <Stack spacing={2}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField
                                    label="First name"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    autoFocus
                                    fullWidth
                                    required
                                    inputProps={{ maxLength: 50 }}
                                    error={tried && Boolean(errors.firstName)}
                                    helperText={tried ? errors.firstName : undefined}
                                />
                                <TextField
                                    label="Last name"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    fullWidth
                                    required
                                    inputProps={{ maxLength: 50 }}
                                    error={tried && Boolean(errors.lastName)}
                                    helperText={tried ? errors.lastName : undefined}
                                />
                            </Stack>
                            <TextField
                                label="Work email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                fullWidth
                                required
                                autoComplete="off"
                                error={tried && Boolean(errors.email)}
                                helperText={
                                    tried ? errors.email : 'They sign in with this address.'
                                }
                            />
                            <RolePicker
                                value={role}
                                onChange={setRole}
                                error={tried ? errors.role : undefined}
                            />
                            {error && (
                                <Alert severity="error" role="alert">
                                    {getErrorMessage(error, 'The admin was not added. Try again.')}
                                </Alert>
                            )}
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button variant="outlined" onClick={onClose} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={isLoading}
                            aria-busy={isLoading || undefined}
                            startIcon={isLoading ? <CircularProgress size={16} /> : undefined}
                        >
                            {isLoading ? 'Adding admin' : 'Add admin'}
                        </Button>
                    </DialogActions>
                </Box>
            )}
        </Dialog>
    );
}
