import { useId } from 'react';
import { Box, Button, Tooltip, Typography, type ButtonProps } from '@mui/material';
import { srOnly } from '@/components/ui';
import type { Permission } from './permissions';
import { useActionGate } from './useSession';

export interface GatedButtonProps extends ButtonProps {
    /** The permission the action needs. */
    permission: Permission;
    /** A reason the caller knows the action is unavailable (own account, last super admin). */
    blockedBecause?: string | null;
    /** Also print the reason under the button (tooltips do not show on touch screens). */
    showReason?: boolean;
}

/**
 * A write action that stays visible when unavailable: disabled, with the reason as a tooltip and
 * as the button's description for screen readers. See `useActionGate` for the order of reasons.
 */
export default function GatedButton({
    permission,
    blockedBecause,
    showReason,
    disabled,
    children,
    fullWidth,
    ...props
}: GatedButtonProps) {
    const { allowed, reason } = useActionGate(permission, blockedBecause);
    const reasonId = useId();
    if (allowed) {
        return (
            <Button {...props} fullWidth={fullWidth} disabled={disabled}>
                {children}
            </Button>
        );
    }
    return (
        <Box
            sx={{
                display: fullWidth ? 'block' : 'inline-block',
                width: fullWidth ? '100%' : 'auto',
            }}
        >
            <Tooltip title={reason}>
                <Box component="span" sx={{ display: fullWidth ? 'block' : 'inline-block' }}>
                    <Button {...props} fullWidth={fullWidth} disabled aria-describedby={reasonId}>
                        {children}
                    </Button>
                </Box>
            </Tooltip>
            <Typography
                id={reasonId}
                variant="caption"
                component="p"
                sx={showReason ? { mt: 0.75, lineHeight: 1.4 } : srOnly}
            >
                {reason}
            </Typography>
        </Box>
    );
}
