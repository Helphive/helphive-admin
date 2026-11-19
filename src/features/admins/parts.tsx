import { Box } from '@mui/material';
import { StatusPill } from '@/components/ui';
import { TwoStepIcon, TwoStepOffIcon } from '@/components/ui/icons';
import { useRoleLabel } from '@/features/auth/useSession';
import { color, font } from '@/theme/tokens';
import { adminStatus, ROLE_TONE, STATUS_META, type AdminRecord } from './model';

export function RolePill({ role, label }: { role: string; label?: string }) {
    const fallback = useRoleLabel(role);
    return <StatusPill tone={ROLE_TONE[role] ?? 'grey'}>{label || fallback}</StatusPill>;
}

export function AdminStatusPill({ admin, size }: { admin: AdminRecord; size?: 'sm' | 'md' }) {
    const meta = STATUS_META[adminStatus(admin)];
    return (
        <StatusPill tone={meta.tone} size={size}>
            {meta.label}
        </StatusPill>
    );
}

/** Two-step state in a table cell: a filled shield when on, a muted "Off" when not. */
export function TwoStepState({ on }: { on: boolean }) {
    return (
        <Box
            component="span"
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                fontSize: font.size.sm,
                fontWeight: 700,
                color: on ? color.green700 : color.amber700,
                whiteSpace: 'nowrap',
                '& svg': { fontSize: 16 },
            }}
        >
            {on ? <TwoStepIcon weight="fill" /> : <TwoStepOffIcon />}
            {on ? 'On' : 'Off'}
        </Box>
    );
}
