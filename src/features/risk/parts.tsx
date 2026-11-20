import { useId, useState } from 'react';
import { Box, ButtonBase, Collapse, Tooltip } from '@mui/material';
import { StatusPill } from '@/components/ui';
import { color, font, hairline, hoverRow, radius } from '@/theme/tokens';
import {
    ACTION_LABEL,
    MODE_LABEL,
    MODE_TONE,
    OPERATOR_LABEL,
    SEVERITY_FILL,
    SEVERITY_LABEL,
    SEVERITY_TONE,
    STATUS_LABEL,
    STATUS_TONE,
    type CaseStatus,
    type ConditionEvidence,
    type Contribution,
    type RuleAction,
    type RuleMode,
    type Severity,
} from './model';

export function SeverityPill({ severity }: { severity: Severity }) {
    return <StatusPill tone={SEVERITY_TONE[severity]}>{SEVERITY_LABEL[severity]}</StatusPill>;
}

export function ModePill({ mode }: { mode: RuleMode }) {
    return <StatusPill tone={MODE_TONE[mode]}>{MODE_LABEL[mode]}</StatusPill>;
}

export function CaseStatusPill({ status }: { status: CaseStatus }) {
    return <StatusPill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusPill>;
}

/** The score as a number out of 100 with its band colour as a left rule. */
export function ScoreFigure({
    score,
    band,
    size = 'md',
}: {
    score: number;
    band: Severity;
    size?: 'sm' | 'md';
}) {
    return (
        <Box
            component="span"
            sx={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 0.5,
                pl: 1,
                borderLeft: `3px solid ${SEVERITY_FILL[band]}`,
                fontVariantNumeric: 'tabular-nums',
            }}
        >
            <Box
                component="span"
                sx={{
                    fontSize: size === 'sm' ? font.size.lg : font.size['3xl'],
                    fontWeight: 800,
                    letterSpacing: font.tracking.head,
                    color: color.ink900,
                    lineHeight: 1,
                }}
            >
                {score}
            </Box>
            <Box
                component="span"
                sx={{ fontSize: font.size.xs, color: color.ink500, fontWeight: 600 }}
            >
                / 100
            </Box>
        </Box>
    );
}

const fmtValue = (v: number | null) => (v === null ? 'no data' : String(v));

/** One condition: the signal, the threshold, what it measured and why. */
export function ConditionLine({ c }: { c: ConditionEvidence }) {
    const values = Object.entries(c.values ?? {}).filter(([, list]) => list && list.length);
    return (
        <Box sx={{ py: 1, '& + &': { borderTop: hairline } }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'baseline' }}>
                <Box component="span" sx={{ fontWeight: 700, color: color.ink900 }}>
                    {c.label}
                </Box>
                <Box
                    component="span"
                    sx={{ color: c.met ? color.red700 : color.ink500, fontWeight: 700 }}
                >
                    {fmtValue(c.value)}
                </Box>
                <Box component="span" sx={{ color: color.ink500, fontSize: font.size.sm }}>
                    rule: {OPERATOR_LABEL[c.op]} {c.threshold}
                    {c.met ? '' : ' (not met)'}
                </Box>
            </Box>
            <Box sx={{ color: color.ink600, fontSize: font.size.sm, mt: 0.25 }}>
                {c.explanation}
            </Box>
            {values.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
                    {values.flatMap(([kind, list]) =>
                        (list as string[]).slice(0, 6).map((v, i) => (
                            <Box
                                key={`${kind}-${i}`}
                                component="span"
                                title={kind}
                                sx={{
                                    px: 0.75,
                                    py: 0.25,
                                    border: hairline,
                                    borderRadius: `${radius.sm}px`,
                                    bgcolor: color.subtle,
                                    fontSize: font.size.xs,
                                    fontWeight: 600,
                                    color: color.ink700,
                                    maxWidth: 260,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {kindLabel(kind)}: {v}
                            </Box>
                        ))
                    )}
                </Box>
            )}
        </Box>
    );
}

const kindLabel = (kind: string) =>
    ({ deviceId: 'Device', ip: 'Address', phone: 'Phone', address: 'Booked at', last4: 'Bank ••' })[
        kind
    ] ?? kind;

export function ActionList({ actions, muted }: { actions: RuleAction[]; muted?: boolean }) {
    const shown = actions.filter((a) => a !== 'score');
    if (!shown.length)
        return (
            <Box component="span" sx={{ color: color.ink500 }}>
                Score only
            </Box>
        );
    return (
        <Box component="span" sx={{ color: muted ? color.ink500 : color.ink700 }}>
            {shown.map((a) => ACTION_LABEL[a]).join(', ')}
        </Box>
    );
}

/**
 * The score ledger: one bar out of 100, one segment per rule that fired, sized by the points it
 * added and coloured by its severity. Each segment and each row below opens that rule's evidence.
 */
export function ScoreLedger({
    contributions,
    compact = false,
}: {
    contributions: Contribution[];
    compact?: boolean;
}) {
    const [open, setOpen] = useState<string | null>(null);
    const listId = useId();
    const counted = contributions.filter((c) => c.points > 0);
    const total = counted.reduce((s, c) => s + c.points, 0);
    return (
        <Box>
            <Box
                role="img"
                aria-label={`Score ${total} of 100: ${counted.map((c) => `${c.title} ${c.points}`).join(', ') || 'no rule fired'}`}
                sx={{
                    display: 'flex',
                    height: compact ? 8 : 14,
                    borderRadius: `${radius.sm}px`,
                    overflow: 'hidden',
                    bgcolor: color.canvas,
                    border: hairline,
                }}
            >
                {counted.map((c) => (
                    <Tooltip key={c.ruleKey} title={`${c.title}: +${c.points}`}>
                        <Box
                            onClick={
                                compact
                                    ? undefined
                                    : () => setOpen(open === c.ruleKey ? null : c.ruleKey)
                            }
                            sx={{
                                width: `${c.points}%`,
                                bgcolor: SEVERITY_FILL[c.severity],
                                opacity: c.mode === 'enforce' ? 1 : 0.72,
                                backgroundImage:
                                    c.mode === 'enforce'
                                        ? undefined
                                        : 'repeating-linear-gradient(135deg, transparent 0 4px, rgba(255,255,255,.35) 4px 6px)',
                                cursor: compact ? 'default' : 'pointer',
                                '& + &': { borderLeft: `2px solid ${color.surface}` },
                            }}
                        />
                    </Tooltip>
                ))}
            </Box>
            {!compact && (
                <Box
                    component="ul"
                    id={listId}
                    sx={{ listStyle: 'none', p: 0, m: 0, mt: 1.5, borderTop: hairline }}
                >
                    {contributions.length === 0 && (
                        <Box component="li" sx={{ py: 1.25, color: color.ink500 }}>
                            No rule fires for this person right now.
                        </Box>
                    )}
                    {contributions.map((c) => (
                        <Box component="li" key={c.ruleKey} sx={{ borderBottom: hairline }}>
                            <ButtonBase
                                onClick={() => setOpen(open === c.ruleKey ? null : c.ruleKey)}
                                aria-expanded={open === c.ruleKey}
                                sx={{
                                    width: '100%',
                                    justifyContent: 'flex-start',
                                    textAlign: 'left',
                                    font: 'inherit',
                                    gap: 1.25,
                                    py: 1,
                                    px: 0.5,
                                    borderRadius: `${radius.sm}px`,
                                    '&:hover': hoverRow,
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: '2px',
                                        flexShrink: 0,
                                        bgcolor: SEVERITY_FILL[c.severity],
                                    }}
                                />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Box sx={{ fontWeight: 700, color: color.ink900 }}>
                                        {c.title}
                                    </Box>
                                    <Box
                                        sx={{
                                            fontSize: font.size.xs,
                                            color: color.ink500,
                                            fontWeight: 600,
                                        }}
                                    >
                                        {SEVERITY_LABEL[c.severity]} severity,{' '}
                                        {MODE_LABEL[c.mode].toLowerCase()} mode.{' '}
                                        <ActionList actions={c.actions} muted />
                                    </Box>
                                </Box>
                                <Box
                                    sx={{
                                        fontWeight: 800,
                                        fontVariantNumeric: 'tabular-nums',
                                        color: c.points ? color.ink900 : color.ink500,
                                    }}
                                >
                                    +{c.points}
                                </Box>
                            </ButtonBase>
                            <Collapse in={open === c.ruleKey} unmountOnExit>
                                <Box sx={{ pl: 3.5, pb: 1 }}>
                                    {c.evidence.map((e) => (
                                        <ConditionLine key={e.signal} c={e} />
                                    ))}
                                </Box>
                            </Collapse>
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    );
}
