import { Avatar, Box, Tooltip } from '@mui/material';
import { StatusPill, srOnly } from '@/components/ui';
import { formatDuration, MS } from '@/lib/format';
import { safeDocumentUrl } from '@/lib/safeUrl';
import { color, font } from '@/theme/tokens';
import { SERVICES, STATUS_META, type Application, type ServiceKey } from './model';
import { initials, WAITING, waitTone } from './waiting';

const TONE_FILL = { grey: color.ink600, amber: color.amber500, red: color.red700 };

/** Time waiting as a figure and a short bar that fills over a week. The queue's signature. */
export function WaitMeter({ since, now }: { since: string; now: number }) {
    const ms = Math.max(0, now - new Date(since).getTime());
    const tone = waitTone(ms);
    const share = Math.min(1, ms / (WAITING.fullDays * MS.DAY));
    return (
        <Tooltip
            title={`Waiting ${formatDuration(ms)}. The bar is full at ${WAITING.fullDays} days.`}
        >
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                <Box
                    component="span"
                    sx={{
                        minWidth: 40,
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        color:
                            tone === 'red'
                                ? color.red700
                                : tone === 'amber'
                                  ? color.amber700
                                  : color.ink900,
                    }}
                >
                    {formatDuration(ms)}
                </Box>
                <Box
                    aria-hidden="true"
                    sx={{
                        width: 56,
                        height: 6,
                        borderRadius: 3,
                        bgcolor: color.line,
                        overflow: 'hidden',
                    }}
                >
                    <Box
                        sx={{
                            width: `${Math.max(6, share * 100)}%`,
                            height: '100%',
                            bgcolor: TONE_FILL[tone],
                            borderRadius: 3,
                        }}
                    />
                </Box>
            </Box>
        </Tooltip>
    );
}

export function ApplicationStatusPill({
    status,
    size,
}: {
    status: Application['status'];
    size?: 'sm' | 'md';
}) {
    const meta = STATUS_META[status];
    return (
        <StatusPill tone={meta.tone} size={size}>
            {meta.label}
        </StatusPill>
    );
}

export function ApplicantAvatar({
    application,
    size = 32,
}: {
    application: Application;
    size?: number;
}) {
    return (
        <Avatar
            src={safeDocumentUrl(application.photoUrl) ?? undefined}
            slotProps={{ img: { referrerPolicy: 'no-referrer' } }}
            alt=""
            variant="rounded"
            sx={{ width: size, height: size, fontSize: size > 40 ? 16 : 12 }}
        >
            {initials(application)}
        </Avatar>
    );
}

/** Photo, name and email in one cell. */
export function ApplicantCell({ application }: { application: Application }) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
            <ApplicantAvatar application={application} />
            <Box sx={{ minWidth: 0 }}>
                <Box sx={{ fontWeight: 700, color: color.ink900, whiteSpace: 'nowrap' }}>
                    {application.name}
                </Box>
                <Box
                    sx={{
                        fontSize: font.size.xs,
                        color: color.ink500,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 240,
                    }}
                >
                    {application.email}
                </Box>
            </Box>
        </Box>
    );
}

/** Service icons with labels; `compact` shows icons only with tooltips. */
export function ServiceList({ services, compact }: { services: ServiceKey[]; compact?: boolean }) {
    if (!services.length) {
        return (
            <Box
                component="span"
                sx={{ color: color.ink500, fontWeight: 600, whiteSpace: 'nowrap' }}
            >
                None selected
            </Box>
        );
    }
    return (
        <Box
            sx={{ display: 'flex', gap: compact ? 0.5 : 1, flexWrap: compact ? 'nowrap' : 'wrap' }}
        >
            {services.map((s) => {
                const { label, Icon } = SERVICES[s];
                return compact ? (
                    <Tooltip key={s} title={label}>
                        <Box
                            component="span"
                            sx={{
                                display: 'inline-grid',
                                placeItems: 'center',
                                width: 24,
                                height: 24,
                                borderRadius: '6px',
                                bgcolor: color.canvas,
                                border: `1px solid ${color.line}`,
                                color: color.ink700,
                            }}
                        >
                            <Icon size={14} />
                            <Box component="span" sx={srOnly}>
                                {label}
                            </Box>
                        </Box>
                    </Tooltip>
                ) : (
                    <Box
                        key={s}
                        component="span"
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                            fontSize: font.size.sm,
                            fontWeight: 600,
                            color: color.ink700,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        <Icon size={16} />
                        {label}
                    </Box>
                );
            })}
        </Box>
    );
}
