import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { ErrorState, KeyValue, PageHeader, Panel, PageSkeleton, StatusPill } from '@/components/ui';
import GatedButton from '@/features/auth/GatedButton';
import { getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useDocumentTitle, useNow } from '@/lib/hooks';
import { API_URL } from '@/lib/env';
import { color, font, radius } from '@/theme/tokens';
import { useGetSettingsQuery } from './api';
import type { AnnouncementSetting } from './model';
import SettingDialog from './SettingDialog';

const AUDIENCE: Record<string, string> = {
    all: 'Everyone',
    customers: 'Customers',
    providers: 'Providers',
};

/** Whether the banner is showing now, scheduled, or over. */
function bannerState(b: AnnouncementSetting, now: number) {
    if (b.startsAt && Date.parse(b.startsAt) > now)
        return { label: 'Scheduled', tone: 'blue' as const };
    if (b.endsAt && Date.parse(b.endsAt) <= now) return { label: 'Ended', tone: 'grey' as const };
    return { label: 'Showing now', tone: 'green' as const };
}

export default function AnnouncementPage() {
    useDocumentTitle('Announcement banner');
    const now = useNow(60_000);
    const q = useGetSettingsQuery();
    const [editing, setEditing] = useState(false);

    if (q.isLoading) return <PageSkeleton />;
    if (q.error || !q.data)
        return (
            <ErrorState
                title="Could not load the banner"
                message={getErrorMessage(q.error, 'Try again.')}
                onRetry={q.refetch}
            />
        );
    const setting = q.data.settings.find((s) => s.key === 'announcements.banner')!;
    const banner = setting.value as AnnouncementSetting | null;
    const state = banner ? bannerState(banner, now) : null;
    const warning = banner?.tone === 'warning';

    return (
        <>
            <PageHeader
                title="Announcement banner"
                subtitle="One short message the web and mobile apps show at the top of their screens."
                badge={state && <StatusPill tone={state.tone}>{state.label}</StatusPill>}
                actions={
                    <GatedButton
                        permission="settings.manage"
                        variant="contained"
                        onClick={() => setEditing(true)}
                    >
                        {banner ? 'Change banner' : 'Write a banner'}
                    </GatedButton>
                }
            />
            <Box
                sx={{
                    display: 'grid',
                    gap: 2.5,
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 3fr) minmax(0, 2fr)' },
                }}
            >
                <Panel title="As the apps show it">
                    {banner ? (
                        <Box
                            sx={{
                                p: 2,
                                borderRadius: `${radius.md}px`,
                                bgcolor: warning ? color.amber50 : color.blue50,
                                border: `1px solid ${warning ? color.amber200 : color.blue200}`,
                                color: warning ? color.amber700 : color.blue700,
                                fontWeight: 600,
                                fontSize: font.size.lg,
                                lineHeight: font.lineHeight.body,
                                whiteSpace: 'pre-line',
                            }}
                        >
                            {banner.text}
                        </Box>
                    ) : (
                        <Typography sx={{ color: color.ink500 }}>
                            No banner. The apps show nothing until you write one.
                        </Typography>
                    )}
                </Panel>
                <Panel title="Details">
                    <KeyValue
                        variant="rows"
                        items={[
                            { label: 'Shown to', value: banner ? AUDIENCE[banner.audience] : null },
                            {
                                label: 'Starts',
                                value: banner
                                    ? banner.startsAt
                                        ? formatDateTime(banner.startsAt)
                                        : 'When saved'
                                    : null,
                            },
                            {
                                label: 'Ends',
                                value: banner
                                    ? banner.endsAt
                                        ? formatDateTime(banner.endsAt)
                                        : 'When removed'
                                    : null,
                            },
                            {
                                label: 'Last changed',
                                value: setting.updatedAt
                                    ? `${formatDateTime(setting.updatedAt)}${setting.updatedBy ? ` by ${setting.updatedBy.email}` : ''}`
                                    : null,
                            },
                        ]}
                    />
                    <Typography
                        sx={{
                            mt: 2,
                            fontSize: font.size.sm,
                            color: color.ink600,
                            overflowWrap: 'anywhere',
                        }}
                    >
                        The apps read it from {API_URL}/public/announcement?audience=customers (or
                        providers), cached for a minute.
                    </Typography>
                </Panel>
            </Box>
            {editing && <SettingDialog setting={setting} onClose={() => setEditing(false)} />}
        </>
    );
}
