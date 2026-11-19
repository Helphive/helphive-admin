import { Alert, Box, Link, Typography } from '@mui/material';
import { useDocumentTitle } from '@/lib/hooks';
import ChangePasswordForm from '@/features/account/ChangePasswordForm';
import AuthFrame from './AuthFrame';
import { useSession } from './useSession';

/**
 * Shown instead of the console while the admin is on a one-time password: the API refuses
 * everything else (403 PASSWORD_CHANGE_REQUIRED) until it is changed.
 */
export default function ForcedPasswordChange() {
    useDocumentTitle('Choose a password');
    const { admin, signOut } = useSession();
    return (
        <AuthFrame width={460}>
            <Typography variant="h4" component="h1">
                Choose your password
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                {admin?.email
                    ? `You signed in as ${admin.email} with a one-time password.`
                    : 'You signed in with a one-time password.'}{' '}
                Choose your own before using the console.
            </Typography>
            <Alert severity="info" sx={{ mb: 2.5 }}>
                The one-time password stops working once you change it.
            </Alert>
            <ChangePasswordForm oneTime />
            <Box sx={{ mt: 2.5 }}>
                <Link component="button" type="button" onClick={() => void signOut()}>
                    Sign out instead
                </Link>
            </Box>
        </AuthFrame>
    );
}
