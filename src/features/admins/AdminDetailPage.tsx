import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Alert, Avatar, Box, Button, Typography } from '@mui/material';
import { DetailSkeleton, EmptyState, ErrorState, KeyValue, Panel } from '@/components/ui';
import { DetailLayout, DiffView, JsonView } from '@/components/detail';
import { AdminsIcon, DisableIcon, LogoutIcon, TwoStepOffIcon } from '@/components/ui/icons';
import { useToast } from '@/components/feedback/toastContext';
import GatedButton from '@/features/auth/GatedButton';
import RequirePermission from '@/features/auth/RequirePermission';
import { useRoleLabel, useSession } from '@/features/auth/useSession';
import AuditTrail from '@/features/audit/AuditTrail';
import { usePageCrumb } from '@/features/shell/crumbContext';
import { errorStatus, getErrorMessage } from '@/lib/api';
import { formatAgo, formatDateTime } from '@/lib/format';
import { useDocumentTitle, useNow } from '@/lib/hooks';
import { color } from '@/theme/tokens';
import {
    useActiveSuperAdminCount,
    useChangeAdminRoleMutation,
    useDisableAdminMutation,
    useEnableAdminMutation,
    useGetAdminQuery,
    useResetAdminMfaMutation,
    useSignOutAdminMutation,
} from './api';
import type { AdminRecord } from './model';
import { AdminStatusPill, RolePill, TwoStepState } from './parts';
import { ReasonDialog } from '@/components/ui';
import RolePicker from './RolePicker';

type Action = 'role' | 'disable' | 'enable' | 'sign-out' | 'reset-mfa';

const LAST_SUPER = 'This is the last active super admin. Make another admin a super admin first.';

function ActionDialogs({
    admin,
    action,
    onClose,
}: {
    admin: AdminRecord;
    action: Action;
    onClose: () => void;
}) {
    const toast = useToast();
    const [role, setRole] = useState(admin.role);
    const newRoleLabel = useRoleLabel(role);
    const [changeRole] = useChangeAdminRoleMutation();
    const [disable] = useDisableAdminMutation();
    const [enable] = useEnableAdminMutation();
    const [signOut] = useSignOutAdminMutation();
    const [resetMfa] = useResetAdminMfaMutation();
    const done = (message: string) => {
        toast.success(message);
        onClose();
    };
    const first = admin.firstName || admin.name;

    if (action === 'role') {
        return (
            <ReasonDialog
                title={`Change ${admin.name}'s role?`}
                effect={`${first} gets exactly what the new role allows from their next request. Their sessions stay signed in.`}
                reason="optional"
                confirmLabel="Change role"
                busyLabel="Changing role"
                validate={() => (role === admin.role ? 'Choose a different role.' : null)}
                onConfirm={async (reason) => {
                    await changeRole({ id: admin.id, role, reason: reason || undefined }).unwrap();
                    done(`Changed ${admin.name}'s role to ${newRoleLabel}`);
                }}
                onClose={onClose}
            >
                <RolePicker value={role} onChange={setRole} current={admin.role} />
                {role !== admin.role && (
                    <Box sx={{ mt: 1.5 }}>
                        <DiffView
                            before={{ role: admin.roleLabel }}
                            after={{ role: newRoleLabel }}
                            labels={{ role: 'Role' }}
                        />
                    </Box>
                )}
            </ReasonDialog>
        );
    }
    if (action === 'disable') {
        return (
            <ReasonDialog
                title={`Disable ${admin.name}?`}
                effect={`${first} is signed out of every session at once and cannot sign in until an admin enables the account again. Nothing they did is undone.`}
                reason="required"
                destructive
                confirmLabel="Disable admin"
                busyLabel="Disabling"
                onConfirm={async (reason) => {
                    await disable({ id: admin.id, reason }).unwrap();
                    done(`Disabled ${admin.name}`);
                }}
                onClose={onClose}
            />
        );
    }
    if (action === 'enable') {
        return (
            <ReasonDialog
                title={`Enable ${admin.name}?`}
                effect={`${first} can sign in again with their password${admin.mfaEnabled ? ' and two-step code' : ''}, with the ${admin.roleLabel} role.`}
                reason="optional"
                confirmLabel="Enable admin"
                busyLabel="Enabling"
                onConfirm={async (reason) => {
                    await enable({ id: admin.id, reason: reason || undefined }).unwrap();
                    done(`Enabled ${admin.name}`);
                }}
                onClose={onClose}
            />
        );
    }
    if (action === 'sign-out') {
        return (
            <ReasonDialog
                title={`Sign ${admin.name} out everywhere?`}
                effect={`Every session ${first} has, on every device, ends at its next request. They can sign in again straight away; to stop that, disable the admin instead.`}
                reason="optional"
                destructive
                confirmLabel="Sign out everywhere"
                busyLabel="Signing out"
                onConfirm={async (reason) => {
                    const res = await signOut({
                        id: admin.id,
                        reason: reason || undefined,
                    }).unwrap();
                    done(
                        `Signed ${admin.name} out of ${res.sessionsEnded} ${res.sessionsEnded === 1 ? 'session' : 'sessions'}`
                    );
                }}
                onClose={onClose}
            />
        );
    }
    return (
        <ReasonDialog
            title={`Reset ${admin.name}'s two-step sign-in?`}
            effect={`Two-step sign-in turns off for ${first} and their recovery codes stop working. They sign in with their password alone and can set two-step up again. Use this when they have lost their phone and their recovery codes.`}
            reason="required"
            destructive
            confirmLabel="Reset two-step sign-in"
            busyLabel="Resetting"
            onConfirm={async (reason) => {
                await resetMfa({ id: admin.id, reason }).unwrap();
                done(`Reset two-step sign-in for ${admin.name}`);
            }}
            onClose={onClose}
        />
    );
}

function ActionsPanel({ admin }: { admin: AdminRecord }) {
    const { admin: me } = useSession();
    const superCount = useActiveSuperAdminCount();
    const [open, setOpen] = useState<Action | null>(null);
    const self = me?._id === admin.id;
    const lastSuper = admin.role === 'superAdmin' && !admin.disabled && superCount === 1;

    return (
        <Panel title="Actions">
            {lastSuper && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    {admin.firstName || admin.name} is the only active super admin, so they cannot
                    be disabled or given another role.
                </Alert>
            )}
            <Box sx={{ display: 'grid', gap: 1 }}>
                <GatedButton
                    permission="admins.manage"
                    variant="outlined"
                    fullWidth
                    onClick={() => setOpen('role')}
                    blockedBecause={
                        self
                            ? 'You cannot change your own role.'
                            : lastSuper
                              ? LAST_SUPER
                              : admin.role === 'demo'
                                ? 'The demo admin is always read-only: its role follows its email address.'
                                : null
                    }
                    showReason
                >
                    Change role
                </GatedButton>
                <GatedButton
                    permission="admins.manage"
                    variant="outlined"
                    fullWidth
                    startIcon={<LogoutIcon />}
                    onClick={() => setOpen('sign-out')}
                    blockedBecause={
                        self ? 'To sign yourself out everywhere, use your account page.' : null
                    }
                    showReason
                >
                    Sign out everywhere
                </GatedButton>
                <GatedButton
                    permission="admins.manage"
                    variant="outlined"
                    fullWidth
                    startIcon={<TwoStepOffIcon />}
                    onClick={() => setOpen('reset-mfa')}
                    blockedBecause={
                        self
                            ? 'Turn your own two-step sign-in off on your account page.'
                            : !admin.mfaEnabled
                              ? 'Two-step sign-in is already off for this admin.'
                              : null
                    }
                    showReason
                >
                    Reset two-step sign-in
                </GatedButton>
                {admin.disabled ? (
                    <GatedButton
                        permission="admins.manage"
                        variant="contained"
                        fullWidth
                        onClick={() => setOpen('enable')}
                        showReason
                    >
                        Enable admin
                    </GatedButton>
                ) : (
                    <GatedButton
                        permission="admins.manage"
                        variant="outlined"
                        color="error"
                        fullWidth
                        startIcon={<DisableIcon />}
                        onClick={() => setOpen('disable')}
                        blockedBecause={
                            self
                                ? 'You cannot disable your own account.'
                                : lastSuper
                                  ? LAST_SUPER
                                  : null
                        }
                        showReason
                        sx={{ borderColor: color.red200, color: color.red700 }}
                    >
                        Disable admin
                    </GatedButton>
                )}
            </Box>
            {open && <ActionDialogs admin={admin} action={open} onClose={() => setOpen(null)} />}
        </Panel>
    );
}

export default function AdminDetailPage() {
    const { adminId = '' } = useParams();
    const now = useNow();
    const { admin: me } = useSession();
    const res = useGetAdminQuery(adminId);
    const admin = res.data;
    useDocumentTitle(admin?.name ?? 'Admin');
    usePageCrumb(admin?.name);

    if (res.isLoading) return <DetailSkeleton label="Loading the admin" />;
    if (!admin) {
        const notFound = errorStatus(res.error) === 404 || errorStatus(res.error) === 400;
        return notFound ? (
            <EmptyState
                icon={<AdminsIcon />}
                title="This admin was not found"
                description="The link may be wrong, or the admin was removed."
                action={
                    <Button variant="contained" component={RouterLink} to="/admins">
                        Go to admins
                    </Button>
                }
            />
        ) : (
            <ErrorState
                title="Could not load this admin"
                message={getErrorMessage(res.error, 'The API did not answer.')}
                onRetry={res.refetch}
                retrying={res.isFetching}
            />
        );
    }

    const initials = `${admin.firstName?.[0] ?? ''}${admin.lastName?.[0] ?? ''}`.toUpperCase();

    return (
        <DetailLayout
            title={admin.name}
            subtitle={
                <>
                    {admin.email}
                    {me?._id === admin.id ? '. This is you.' : ''}
                </>
            }
            status={<AdminStatusPill admin={admin} size="md" />}
            media={
                <Avatar variant="rounded" sx={{ width: 48, height: 48, fontSize: 16 }} alt="">
                    {initials || '?'}
                </Avatar>
            }
            actions={
                <Button component={RouterLink} to="/admins" variant="outlined" size="small">
                    Back to admins
                </Button>
            }
            tabs={[
                {
                    id: 'summary',
                    label: 'Summary',
                    content: (
                        <Box sx={{ display: 'grid', gap: 2.5 }}>
                            <Panel title="Access">
                                <KeyValue
                                    columns={3}
                                    items={[
                                        {
                                            label: 'Role',
                                            value: (
                                                <RolePill
                                                    role={admin.role}
                                                    label={admin.roleLabel}
                                                />
                                            ),
                                        },
                                        {
                                            label: 'Status',
                                            value: <AdminStatusPill admin={admin} />,
                                        },
                                        {
                                            label: 'Two-step sign-in',
                                            value: <TwoStepState on={admin.mfaEnabled} />,
                                        },
                                        {
                                            label: 'Last sign-in',
                                            value: admin.lastLoginAt
                                                ? `${formatDateTime(admin.lastLoginAt)} (${formatAgo(admin.lastLoginAt, now)})`
                                                : 'Not since sign-ins were recorded',
                                        },
                                        {
                                            label: 'Added',
                                            value: admin.createdAt
                                                ? formatDateTime(admin.createdAt)
                                                : '',
                                        },
                                        {
                                            label: 'Disabled',
                                            value: admin.disabled
                                                ? admin.disabledAt
                                                    ? formatDateTime(admin.disabledAt)
                                                    : 'Yes'
                                                : 'No',
                                        },
                                    ]}
                                />
                                {admin.roleIsLegacy && (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ mt: 2 }}
                                    >
                                        This admin was created before roles existed, so the role is
                                        read from the older super admin flag. Changing it stores the
                                        role.
                                    </Typography>
                                )}
                                {admin.mustChangePassword && (
                                    <Alert severity="warning" sx={{ mt: 2 }}>
                                        {admin.firstName || admin.name} has not changed their
                                        one-time password yet, so they can only reach the
                                        change-password screen.
                                    </Alert>
                                )}
                            </Panel>
                            <RequirePermission permission="audit.read" fallback={null}>
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gap: 2.5,
                                        gridTemplateColumns: {
                                            xs: 'minmax(0, 1fr)',
                                            xl: '1fr 1fr',
                                        },
                                    }}
                                >
                                    <AuditTrail
                                        title="Changes to this admin"
                                        targetType="admin"
                                        targetId={admin.id}
                                    />
                                    <AuditTrail
                                        title={`What ${admin.firstName || 'they'} did`}
                                        actor={admin.id}
                                    />
                                </Box>
                            </RequirePermission>
                        </Box>
                    ),
                },
                {
                    id: 'raw',
                    label: 'Raw record',
                    content: <JsonView value={admin} label="Admin record as returned by the API" />,
                },
            ]}
            aside={<ActionsPanel admin={admin} />}
        />
    );
}
