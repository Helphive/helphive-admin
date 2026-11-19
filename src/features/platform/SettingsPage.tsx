import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { ErrorState, PageHeader, Panel, PageSkeleton, StatusPill } from '@/components/ui';
import GatedButton from '@/features/auth/GatedButton';
import { TestModeNotice } from '@/features/finance/parts';
import { getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useDocumentTitle } from '@/lib/hooks';
import { color, font } from '@/theme/tokens';
import { useGetSettingsQuery } from './api';
import { formatSettingValue, type Setting } from './model';
import SettingDialog from './SettingDialog';

function SettingRow({
    setting,
    onEdit,
}: {
    setting: Setting;
    onEdit: (s: Setting, initial?: unknown) => void;
}) {
    return (
        <Box
            sx={{
                display: 'grid',
                gap: { xs: 1.5, md: 3 },
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.4fr) minmax(0, 1fr) 230px' },
                alignItems: 'start',
                py: 2,
                '& + &': { borderTop: `1px solid ${color.line}` },
            }}
        >
            <Box sx={{ minWidth: 0 }}>
                <Typography
                    component="h3"
                    sx={{ fontWeight: 700, fontSize: font.size.lg, color: color.ink900 }}
                >
                    {setting.label}
                </Typography>
                <Typography
                    sx={{ mt: 0.5, fontSize: font.size.sm, color: color.ink600, maxWidth: '68ch' }}
                >
                    {setting.affects}
                </Typography>
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Box
                        sx={{
                            fontWeight: 800,
                            fontSize: font.size.xl,
                            color: color.ink900,
                            overflowWrap: 'anywhere',
                        }}
                    >
                        {formatSettingValue(setting, setting.value)}
                    </Box>
                    {setting.isDefault ? (
                        <StatusPill tone="grey">Default</StatusPill>
                    ) : (
                        <StatusPill tone="blue">Changed</StatusPill>
                    )}
                </Box>
                {!setting.isDefault && (
                    <Typography sx={{ mt: 0.5, fontSize: font.size.sm, color: color.ink600 }}>
                        Default {formatSettingValue(setting, setting.default)}
                    </Typography>
                )}
                {setting.updatedAt && (
                    <Typography
                        sx={{
                            mt: 0.25,
                            fontSize: font.size.xs,
                            color: color.ink500,
                            fontWeight: 600,
                        }}
                    >
                        Changed {formatDateTime(setting.updatedAt)}
                        {setting.updatedBy ? ` by ${setting.updatedBy.email}` : ''}
                    </Typography>
                )}
            </Box>
            <Box
                sx={{
                    display: 'flex',
                    gap: 1,
                    flexWrap: 'wrap',
                    justifyContent: { md: 'flex-end' },
                }}
            >
                <GatedButton
                    permission="settings.manage"
                    variant="outlined"
                    size="small"
                    onClick={() => onEdit(setting)}
                >
                    Change
                </GatedButton>
                {!setting.isDefault && (
                    <GatedButton
                        permission="settings.manage"
                        variant="text"
                        size="small"
                        onClick={() => onEdit(setting, setting.default)}
                    >
                        Restore default
                    </GatedButton>
                )}
            </Box>
        </Box>
    );
}

export default function SettingsPage() {
    useDocumentTitle('Settings');
    const q = useGetSettingsQuery();
    const [editing, setEditing] = useState<{ setting: Setting; initial?: unknown } | null>(null);

    if (q.isLoading) return <PageSkeleton />;
    if (q.error || !q.data)
        return (
            <ErrorState
                title="Could not load the settings"
                message={getErrorMessage(q.error, 'Try again.')}
                onRetry={q.refetch}
            />
        );
    const { groups, settings } = q.data;

    return (
        <>
            <PageHeader
                title="Settings"
                subtitle="Values the platform runs on. Each starts at the value the code had before; changes apply within 30 seconds and are recorded in the audit log."
            />
            <TestModeNotice />
            <Box sx={{ display: 'grid', gap: 2.5 }}>
                {groups
                    .filter((g) => g.id !== 'announcements')
                    .map((group) => (
                        <Panel key={group.id} title={group.label} id={`group-${group.id}`}>
                            {settings
                                .filter((s) => s.group === group.id)
                                .map((s) => (
                                    <SettingRow
                                        key={s.key}
                                        setting={s}
                                        onEdit={(setting, initial) =>
                                            setEditing({ setting, initial })
                                        }
                                    />
                                ))}
                        </Panel>
                    ))}
            </Box>
            {editing && (
                <SettingDialog
                    setting={editing.setting}
                    initial={editing.initial}
                    onClose={() => setEditing(null)}
                />
            )}
        </>
    );
}
