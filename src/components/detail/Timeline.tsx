import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { TONE_STYLES, type Tone } from '@/components/ui';
import { color, font } from '@/theme/tokens';

export interface TimelineItem {
    id: string;
    title: ReactNode;
    /** Display time. Pass null when the event happened but its time was not recorded. */
    time: ReactNode | null;
    /** Machine-readable time for <time dateTime>. */
    dateTime?: string;
    description?: ReactNode;
    tone?: Tone;
}

/** Events in order, oldest first, with a status-coloured dot per event. */
export default function Timeline({
    items,
    label = 'Activity',
}: {
    items: TimelineItem[];
    label?: string;
}) {
    return (
        <Box component="ol" aria-label={label} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {items.map((item, i) => {
                const tone = TONE_STYLES[item.tone ?? 'grey'];
                const last = i === items.length - 1;
                return (
                    <Box
                        component="li"
                        key={item.id}
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: '20px minmax(0, 1fr)',
                            gap: 1.25,
                        }}
                    >
                        <Box
                            sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}
                        >
                            <Box
                                aria-hidden="true"
                                sx={{
                                    mt: '5px',
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    bgcolor: tone.fg,
                                    boxShadow: `0 0 0 3px ${tone.bg}`,
                                    zIndex: 1,
                                }}
                            />
                            {!last && (
                                <Box
                                    aria-hidden="true"
                                    sx={{
                                        position: 'absolute',
                                        top: 18,
                                        bottom: -4,
                                        width: '1px',
                                        bgcolor: color.line,
                                    }}
                                />
                            )}
                        </Box>
                        <Box sx={{ pb: last ? 0 : 2, minWidth: 0 }}>
                            <Box
                                sx={{
                                    fontSize: font.size.md,
                                    fontWeight: 700,
                                    color: color.ink900,
                                }}
                            >
                                {item.title}
                            </Box>
                            <Box
                                sx={{
                                    fontSize: font.size.xs,
                                    fontWeight: 600,
                                    color: color.ink500,
                                }}
                            >
                                {item.time === null ? (
                                    'Time not recorded'
                                ) : (
                                    <time dateTime={item.dateTime}>{item.time}</time>
                                )}
                            </Box>
                            {item.description && (
                                <Box sx={{ mt: 0.5, fontSize: font.size.sm, color: color.ink600 }}>
                                    {item.description}
                                </Box>
                            )}
                        </Box>
                    </Box>
                );
            })}
        </Box>
    );
}
