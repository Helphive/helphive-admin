import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Link,
} from '@mui/material';
import { Panel, ReasonDialog } from '@/components/ui';
import {
    DisableIcon,
    EmailIcon,
    LogoutIcon,
    OfflineIcon,
    ReinstateIcon,
    VerifiedIcon,
} from '@/components/ui/icons';
import { useToast } from '@/components/feedback/toastContext';
import GatedButton from '@/features/auth/GatedButton';
import { DISPLAY_STATUS, metaFor } from '@/features/ops/model';
import { formatDateTime } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { color, font, hairline } from '@/theme/tokens';
import { useUserActionMutation, type OpenBooking, type UserAction, type UserDetail } from './api';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Open bookings with links, so the operator can cancel or release each from its page. */
export function OpenBookingList({ bookings }: { bookings: OpenBooking[] }) {
    if (!bookings.length) return null;
    return (
        <Box
            component="ul"
            sx={{ listStyle: 'none', m: 0, p: 0, border: hairline, borderRadius: '8px' }}
        >
            {bookings.map((b, i) => (
                <Box
                    component="li"
                    key={b._id}
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: 'minmax(0, 1fr)',
                            sm: 'auto minmax(0, 1fr) auto',
                        },
                        gap: 1.5,
                        alignItems: 'baseline',
                        px: 1.5,
                        py: 1,
                        borderTop: i ? hairline : 0,
                        fontSize: font.size.sm,
                    }}
                >
                    <Link component={RouterLink} to={`/bookings/${b._id}`} sx={{ fontWeight: 700 }}>
                        {b.reference}
                    </Link>
                    <Box sx={{ color: color.ink600, minWidth: 0 }}>
                        {b.service?.name}, {formatDateTime(b.startDate)}, as{' '}
                        {b.role === 'provider' ? 'provider' : 'customer'}
                    </Box>
                    <Box sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {metaFor(DISPLAY_STATUS, b.displayStatus).label}, {formatMoney(b.amount)}
                    </Box>
                </Box>
            ))}
        </Box>
    );
}

const SKIPPED: Record<string, string> = {
    disposable_domain: 'the address is on a disposable email domain',
    reserved_domain: 'the address is on a reserved or test domain',
    demo_account: 'this is a shared demo account',
    blocked_domain: 'the domain is blocked',
    domain_not_found: 'the domain does not exist',
    no_mail_server: 'the domain has no mail server',
    invalid_address: 'the address is not valid',
};

function ActionDialog({
    detail,
    action,
    onClose,
    onSuspended,
}: {
    detail: UserDetail;
    action: UserAction;
    onClose: () => void;
    onSuspended: (open: OpenBooking[]) => void;
}) {
    const toast = useToast();
    const [run] = useUserActionMutation();
    const u = detail.user;
    const name = `${u.firstName} ${u.lastName}`.trim();
    const email = u.email ?? 'this address';
    const id = u._id;
    const open = detail.openBookings.length;

    if (action === 'suspend') {
        return (
            <ReasonDialog
                title={`Suspend ${name}?`}
                effect={
                    <>
                        They are signed out everywhere and cannot sign in or use the app until
                        reinstated. {plural(open, 'open booking')} {open === 1 ? 'is' : 'are'} not
                        cancelled — handle them next.
                        {u.role === 'provider' && ' Their availability is turned off too.'}
                    </>
                }
                reason="required"
                destructive
                confirmLabel="Suspend account"
                busyLabel="Suspending"
                onConfirm={async (reason) => {
                    const res = await run({ id, action, reason }).unwrap();
                    toast.success(`Suspended ${name}`);
                    onSuspended(res.openBookings ?? []);
                    onClose();
                }}
                onClose={onClose}
            >
                {open > 0 && <OpenBookingList bookings={detail.openBookings} />}
            </ReasonDialog>
        );
    }
    if (action === 'reinstate') {
        return (
            <ReasonDialog
                title={`Reinstate ${name}?`}
                effect={`They can sign in again. Their sessions stay ended${u.role === 'provider' ? ' and their availability stays off until they go online themselves' : ''}.`}
                reason="required"
                confirmLabel="Reinstate account"
                busyLabel="Reinstating"
                onConfirm={async (reason) => {
                    await run({ id, action, reason }).unwrap();
                    toast.success(`Reinstated ${name}`);
                    onClose();
                }}
                onClose={onClose}
            />
        );
    }
    if (action === 'end-sessions') {
        return (
            <ReasonDialog
                title={`Sign ${name} out on every device?`}
                effect="They can sign in again straight away. To keep them out, suspend the account instead."
                reason="required"
                destructive
                confirmLabel="End all sessions"
                busyLabel="Ending sessions"
                onConfirm={async (reason) => {
                    const res = await run({ id, action, reason }).unwrap();
                    toast.success(`Ended ${plural(res.sessionsEnded ?? 0, 'session')} for ${name}`);
                    onClose();
                }}
                onClose={onClose}
            />
        );
    }
    if (action === 'verify-email') {
        return (
            <ReasonDialog
                title={`Mark ${email} as verified without the person clicking the link?`}
                effect="Only do this when you have confirmed they own the address. Any verification links already sent stop working."
                reason="required"
                confirmLabel="Mark email verified"
                busyLabel="Marking verified"
                onConfirm={async (reason) => {
                    await run({ id, action, reason }).unwrap();
                    toast.success(`Marked ${email} as verified`);
                    onClose();
                }}
                onClose={onClose}
            />
        );
    }
    if (action === 'resend-verification') {
        return (
            <ReasonDialog
                title={`Send a new verification link to ${email}?`}
                effect="The email policy still applies: nothing is sent to disposable, reserved or unreachable addresses."
                reason="optional"
                confirmLabel="Send verification link"
                busyLabel="Sending"
                onConfirm={async (reason) => {
                    const res = await run({ id, action, reason: reason || undefined }).unwrap();
                    if (res.result === 'skipped') {
                        toast.show(
                            `Nothing was sent: ${SKIPPED[res.skippedBecause ?? ''] ?? res.message ?? 'the email policy stopped it'}.`,
                            { tone: 'warning' }
                        );
                    } else {
                        toast.success(`Sent a verification link to ${email}`);
                    }
                    onClose();
                }}
                onClose={onClose}
            />
        );
    }
    return (
        <ReasonDialog
            title={`Set ${name} offline?`}
            effect="They stop getting new-job alerts. If their app is open and online it will go back online; suspend the account to keep them off."
            reason="required"
            confirmLabel="Set offline"
            busyLabel="Setting offline"
            onConfirm={async (reason) => {
                await run({ id, action, reason }).unwrap();
                toast.success(`Set ${name} offline`);
                onClose();
            }}
            onClose={onClose}
        />
    );
}

/** The side panel of a person's page: every account action, each with its confirmation. */
export default function UserActions({ detail }: { detail: UserDetail }) {
    const [open, setOpen] = useState<UserAction | null>(null);
    const [afterSuspend, setAfterSuspend] = useState<OpenBooking[] | null>(null);
    const { account, user, provider } = detail;
    const isProvider = user.role === 'provider';

    return (
        <Panel title="Actions">
            {account.suspended && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    Suspended
                    {account.suspendedAt ? ` on ${formatDateTime(account.suspendedAt)}` : ''}.
                    {account.suspendedReason ? ` Reason: ${account.suspendedReason}` : ''}
                </Alert>
            )}
            <Box sx={{ display: 'grid', gap: 1 }}>
                {account.suspended ? (
                    <GatedButton
                        permission="users.manage"
                        variant="contained"
                        fullWidth
                        startIcon={<ReinstateIcon />}
                        onClick={() => setOpen('reinstate')}
                        showReason
                    >
                        Reinstate account
                    </GatedButton>
                ) : (
                    <GatedButton
                        permission="users.manage"
                        variant="outlined"
                        color="error"
                        fullWidth
                        startIcon={<DisableIcon />}
                        onClick={() => setOpen('suspend')}
                        showReason
                        sx={{ borderColor: color.red200, color: color.red700 }}
                    >
                        Suspend account
                    </GatedButton>
                )}
                <GatedButton
                    permission="users.manage"
                    variant="outlined"
                    fullWidth
                    startIcon={<LogoutIcon />}
                    onClick={() => setOpen('end-sessions')}
                    blockedBecause={
                        account.activeSessions === 0 ? 'They have no active sessions.' : null
                    }
                >
                    End all sessions
                </GatedButton>
                <GatedButton
                    permission="users.manage"
                    variant="outlined"
                    fullWidth
                    startIcon={<VerifiedIcon />}
                    onClick={() => setOpen('verify-email')}
                    blockedBecause={account.emailVerified ? 'The email is already verified.' : null}
                >
                    Mark email verified
                </GatedButton>
                <GatedButton
                    permission="users.manage"
                    variant="outlined"
                    fullWidth
                    startIcon={<EmailIcon />}
                    onClick={() => setOpen('resend-verification')}
                    blockedBecause={
                        account.emailVerified
                            ? 'The email is already verified.'
                            : account.suspended
                              ? 'Reinstate the account first.'
                              : null
                    }
                >
                    Resend verification email
                </GatedButton>
                {isProvider && (
                    <GatedButton
                        permission="users.manage"
                        variant="outlined"
                        fullWidth
                        startIcon={<OfflineIcon />}
                        onClick={() => setOpen('availability-off')}
                        blockedBecause={!provider?.available ? 'They are already offline.' : null}
                    >
                        Set offline
                    </GatedButton>
                )}
            </Box>
            {open && (
                <ActionDialog
                    detail={detail}
                    action={open}
                    onClose={() => setOpen(null)}
                    onSuspended={setAfterSuspend}
                />
            )}
            <Dialog
                open={afterSuspend !== null}
                onClose={() => setAfterSuspend(null)}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>
                    {afterSuspend?.length
                        ? `Handle ${plural(afterSuspend.length, 'open booking')} next`
                        : 'No open bookings to handle'}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: afterSuspend?.length ? 2 : 0 }}>
                        {afterSuspend?.length
                            ? 'Suspending does not cancel, reassign or refund anything. Open each booking to cancel it or release it to another provider.'
                            : 'They were not part of any pending or in-progress booking.'}
                    </DialogContentText>
                    <OpenBookingList bookings={afterSuspend ?? []} />
                </DialogContent>
                <DialogActions>
                    <Button variant="contained" onClick={() => setAfterSuspend(null)}>
                        Done
                    </Button>
                </DialogActions>
            </Dialog>
        </Panel>
    );
}
