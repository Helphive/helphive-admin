import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Link, Skeleton } from '@mui/material';
import { ErrorState, Panel, StatusPill } from '@/components/ui';
import GatedButton from '@/features/auth/GatedButton';
import RequirePermission from '@/features/auth/RequirePermission';
import ReasonDialog from '@/components/ui/ReasonDialog';
import { useToast } from '@/components/feedback/toastContext';
import { getErrorMessage } from '@/lib/api';
import { formatAgo } from '@/lib/format';
import { color, font, hairline } from '@/theme/tokens';
import { useGetUserRiskQuery, useOpenCaseMutation } from './api';
import { HOLD_LABEL } from './model';
import { CaseStatusPill, ScoreFigure, ScoreLedger, SeverityPill } from './parts';

/**
 * A person's risk, for any page about a customer or provider: score with its ledger, the top
 * reasons, open cases and payout hold state, with links into the Risk section. Self-contained:
 * fetches GET /admin/risk/users/:id and renders nothing for admins without risk.read.
 *
 *     <RiskPanel userId={user._id} />
 */
export default function RiskPanel({
    userId,
    title = 'Fraud risk',
}: {
    userId: string;
    title?: string;
}) {
    return (
        <RequirePermission permission="risk.read" fallback={null}>
            <RiskPanelBody userId={userId} title={title} />
        </RequirePermission>
    );
}

function RiskPanelBody({ userId, title }: { userId: string; title: string }) {
    const q = useGetUserRiskQuery(userId);
    const [openCase] = useOpenCaseMutation();
    const [opening, setOpening] = useState(false);
    const toast = useToast();

    if (q.isLoading) {
        return (
            <Panel title={title}>
                <Skeleton variant="rounded" height={88} />
            </Panel>
        );
    }
    if (q.error || !q.data) {
        return (
            <Panel title={title}>
                <ErrorState
                    bare
                    title="Risk could not load"
                    message={getErrorMessage(q.error, 'Try again.')}
                    onRetry={q.refetch}
                />
            </Panel>
        );
    }
    const { risk, holds, cases, user, stored } = q.data;
    const active = cases.filter((c) => c.status === 'open' || c.status === 'in_review');
    const top = (risk?.contributions ?? []).filter((c) => c.points > 0).slice(0, 3);

    return (
        <Panel
            title={title}
            subtitle={
                stored?.exempt ?? (risk ? `Worked out ${formatAgo(risk.evaluatedAt)}` : undefined)
            }
            actions={
                active.length === 0 ? (
                    <GatedButton
                        permission="risk.manage"
                        size="small"
                        variant="outlined"
                        onClick={() => setOpening(true)}
                    >
                        Open a case
                    </GatedButton>
                ) : undefined
            }
        >
            {risk && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                    <ScoreFigure score={risk.score} band={risk.band} />
                    <Box sx={{ flex: 1 }}>
                        <ScoreLedger contributions={risk.contributions} compact />
                    </Box>
                </Box>
            )}
            {top.length > 0 ? (
                <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                    {top.map((c) => (
                        <Box
                            component="li"
                            key={c.ruleKey}
                            sx={{ display: 'flex', gap: 1, py: 0.5, fontSize: font.size.sm }}
                        >
                            <Box sx={{ flex: 1, color: color.ink700, fontWeight: 600 }}>
                                {c.title}
                            </Box>
                            <Box sx={{ fontWeight: 800, color: color.ink900 }}>+{c.points}</Box>
                        </Box>
                    ))}
                </Box>
            ) : (
                <Box sx={{ color: color.ink500, fontSize: font.size.sm }}>
                    No rule fires for this person.
                </Box>
            )}
            {(holds.length > 0 || active.length > 0) && (
                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: hairline, display: 'grid', gap: 1 }}>
                    {holds.map((h) => (
                        <Box
                            key={h._id}
                            sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}
                        >
                            <StatusPill tone="red">{HOLD_LABEL[h.kind]}</StatusPill>
                            <Link
                                component={RouterLink}
                                to="/risk/holds"
                                sx={{ fontSize: font.size.sm }}
                            >
                                since {formatAgo(h.createdAt)}
                            </Link>
                        </Box>
                    ))}
                    {active.map((c) => (
                        <Box
                            key={c._id}
                            sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}
                        >
                            <SeverityPill severity={c.severity} />
                            <CaseStatusPill status={c.status} />
                            <Link
                                component={RouterLink}
                                to={`/risk/cases/${c._id}`}
                                sx={{ fontSize: font.size.sm, fontWeight: 700 }}
                            >
                                {c.title}
                            </Link>
                        </Box>
                    ))}
                </Box>
            )}
            {opening && (
                <ReasonDialog
                    title={`Open a review case about ${user.name}?`}
                    effect="The case appears in the review queue with this person's current score and evidence. Nothing else changes."
                    reason="required"
                    confirmLabel="Open case"
                    busyLabel="Opening"
                    onClose={() => setOpening(false)}
                    onConfirm={async (reason) => {
                        await openCase({ subjectType: 'user', subjectId: userId, reason }).unwrap();
                        setOpening(false);
                        toast.success(`Opened a case about ${user.name}`);
                    }}
                />
            )}
        </Panel>
    );
}
