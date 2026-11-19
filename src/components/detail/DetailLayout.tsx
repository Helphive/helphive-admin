import type { ReactNode } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import { PageHeader, Count } from '@/components/ui';
import { useUrlState } from '@/lib/hooks';
import { hairline } from '@/theme/tokens';

export interface DetailTab {
    id: string;
    label: string;
    count?: number;
    content: ReactNode;
}

export interface DetailLayoutProps {
    title: ReactNode;
    subtitle?: ReactNode;
    /** Status pill next to the title. */
    status?: ReactNode;
    /** Avatar or icon before the title. */
    media?: ReactNode;
    /** Header actions (buttons). */
    actions?: ReactNode;
    /** Tabs over the main column; the active tab is kept in the URL (?tab=). */
    tabs?: DetailTab[];
    /** Main column content when there are no tabs, or above the tabs when there are. */
    children?: ReactNode;
    /** Side panel: decisions, key facts. Sticky on wide screens, below the main column on narrow. */
    aside?: ReactNode;
    /** Put the side panel first on narrow screens (when it holds the main action). */
    asideFirstOnNarrow?: boolean;
}

/** Record page frame: header with status and actions, tabs, and a side panel. */
export default function DetailLayout({
    title,
    subtitle,
    status,
    media,
    actions,
    tabs,
    children,
    aside,
    asideFirstOnNarrow,
}: DetailLayoutProps) {
    const [{ tab }, setUrl] = useUrlState({ tab: tabs?.[0]?.id ?? '' });
    const active = tabs?.find((t) => t.id === tab) ?? tabs?.[0];

    return (
        <>
            <PageHeader
                title={title}
                subtitle={subtitle}
                badge={status}
                media={media}
                actions={actions}
            />
            <Box
                sx={{
                    display: 'grid',
                    gap: 2.5,
                    gridTemplateColumns: aside
                        ? { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 340px' }
                        : '1fr',
                    alignItems: 'start',
                }}
            >
                <Box sx={{ display: 'grid', gap: 2.5, minWidth: 0 }}>
                    {children}
                    {tabs && active && (
                        <Box sx={{ minWidth: 0 }}>
                            <Tabs
                                value={active.id}
                                onChange={(_, v: string) => setUrl({ tab: v })}
                                variant="scrollable"
                                scrollButtons={false}
                                aria-label="Record sections"
                                sx={{ borderBottom: hairline, mb: 2 }}
                            >
                                {tabs.map((t) => (
                                    <Tab
                                        key={t.id}
                                        value={t.id}
                                        id={`tab-${t.id}`}
                                        aria-controls={`tabpanel-${t.id}`}
                                        label={
                                            <Box
                                                component="span"
                                                sx={{
                                                    display: 'inline-flex',
                                                    gap: 0.75,
                                                    alignItems: 'center',
                                                }}
                                            >
                                                {t.label}
                                                {t.count !== undefined && <Count value={t.count} />}
                                            </Box>
                                        }
                                    />
                                ))}
                            </Tabs>
                            <Box
                                role="tabpanel"
                                id={`tabpanel-${active.id}`}
                                aria-labelledby={`tab-${active.id}`}
                            >
                                {active.content}
                            </Box>
                        </Box>
                    )}
                </Box>
                {aside && (
                    <Box
                        component="aside"
                        sx={{
                            display: 'grid',
                            gap: 2.5,
                            position: { lg: 'sticky' },
                            top: { lg: 72 },
                            order: asideFirstOnNarrow ? { xs: -1, lg: 0 } : 0,
                            minWidth: 0,
                        }}
                    >
                        {aside}
                    </Box>
                )}
            </Box>
        </>
    );
}
