import { Tooltip } from '@mui/material';
import { StatusPill } from '@/components/ui';
import { useEnvironment } from './environment';

export default function EnvironmentBadge() {
    const env = useEnvironment();
    return (
        <Tooltip title={env.detail}>
            <span tabIndex={0} aria-label={`Environment: ${env.label}. ${env.detail}`}>
                <StatusPill tone={env.tone}>{env.label}</StatusPill>
            </span>
        </Tooltip>
    );
}
