import { Box } from '@mui/material';
import { KeyValue, PageHeader, Panel, StatusPill } from '@/components/ui';
import { useGetAccountQuery } from '@/features/auth/authApi';
import { useSession } from '@/features/auth/useSession';
import { formatDateTime } from '@/lib/format';
import { useDocumentTitle } from '@/lib/hooks';
import ChangePasswordForm from './ChangePasswordForm';
import SessionsPanel from './SessionsPanel';
import TwoStepPanel from './TwoStepPanel';

/** Your account: two-step sign-in, password, and the sessions signed in as you. */
export default function AccountPage() {
    useDocumentTitle('Your account');
    const { admin, name, roleLabel, demo } = useSession();
    const account = useGetAccountQuery();
    const user = account.data?.user ?? admin;

    return (
        <>
            <PageHeader
                title="Your account"
                subtitle="Sign-in security for your admin account."
                badge={
                    roleLabel ? (
                        <StatusPill tone={demo ? 'amber' : 'grey'} size="md">
                            {roleLabel}
                        </StatusPill>
                    ) : undefined
                }
            />
            <Box
                sx={{
                    display: 'grid',
                    gap: 2.5,
                    gridTemplateColumns: {
                        xs: 'minmax(0, 1fr)',
                        lg: 'minmax(0, 1fr) minmax(0, 1fr)',
                    },
                    alignItems: 'start',
                }}
            >
                <Box sx={{ display: 'grid', gap: 2.5, minWidth: 0 }}>
                    <TwoStepPanel />
                    <Panel title="Profile">
                        <KeyValue
                            variant="rows"
                            items={[
                                { label: 'Name', value: name },
                                { label: 'Email', value: user?.email },
                                { label: 'Role', value: roleLabel },
                                {
                                    label: 'Last sign-in',
                                    value: user?.lastLoginAt
                                        ? formatDateTime(user.lastLoginAt)
                                        : '',
                                },
                            ]}
                        />
                    </Panel>
                </Box>
                <Panel
                    title="Password"
                    subtitle="At least 8 characters with upper and lower case, a number and a symbol"
                >
                    <ChangePasswordForm />
                </Panel>
                <Box sx={{ gridColumn: { lg: '1 / -1' }, minWidth: 0 }}>
                    <SessionsPanel />
                </Box>
            </Box>
        </>
    );
}
