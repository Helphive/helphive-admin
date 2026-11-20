import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Box, MenuItem, Select, TextField } from '@mui/material';
import { color, font, hairline, radius } from '@/theme/tokens';
import {
    ANALYSIS_DEFAULTS,
    analysisSearch,
    INTERVAL_OPTIONS,
    RANGE_OPTIONS,
    TIME_ZONE,
    useAnalysis,
} from './model';
import { ANALYTICS_PAGES } from './pages';

const STORE_KEY = 'hh.analytics.state';

/** An inline choice inside the sentence: reads as part of the text, works as a select. */
function Choice({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: readonly { value: string; label: string }[];
    onChange: (v: string) => void;
}) {
    return (
        <Select
            variant="standard"
            disableUnderline
            value={value}
            onChange={(e) => onChange(String(e.target.value))}
            inputProps={{ 'aria-label': label }}
            sx={{
                fontSize: 'inherit',
                fontWeight: 800,
                color: color.ink900,
                letterSpacing: font.tracking.title,
                '& .MuiSelect-select': {
                    py: 0,
                    pr: '22px !important',
                    pl: 0,
                    borderBottom: `2px solid ${color.coral500}`,
                    borderRadius: 0,
                    minHeight: 0,
                },
                '& .MuiSelect-select:focus': { bgcolor: 'transparent' },
                '& svg': { right: 0, fontSize: 16 },
            }}
        >
            {options.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                    {o.label}
                </MenuItem>
            ))}
        </Select>
    );
}

/**
 * The one control every analytics page shares: the period, the bucket size and the comparison,
 * written as a sentence. It lives in the URL (and is remembered for the tab), and the page links
 * under it carry it from page to page.
 */
export default function AnalysisBar() {
    const { state, set } = useAnalysis();
    const location = useLocation();
    const restored = useRef(false);

    // Coming from the sidebar (no state in the URL): pick up where this tab left off.
    useEffect(() => {
        if (restored.current) return;
        restored.current = true;
        const params = new URLSearchParams(location.search);
        if (Object.keys(ANALYSIS_DEFAULTS).some((k) => params.has(k))) return;
        try {
            const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) ?? 'null');
            if (saved && typeof saved === 'object') set(saved);
        } catch {
            // Nothing saved or storage blocked: the defaults stand.
        }
    }, [location.search, set]);

    useEffect(() => {
        try {
            sessionStorage.setItem(STORE_KEY, JSON.stringify(state));
        } catch {
            // Storage blocked: the URL still carries the state.
        }
    }, [state]);

    const previous =
        RANGE_OPTIONS.find((o) => o.value === state.range)?.previous ?? 'the period before';
    const search = analysisSearch(state);

    return (
        <Box
            sx={{
                position: 'sticky',
                top: 56,
                zIndex: 3,
                bgcolor: color.canvas,
                mx: { xs: -2, sm: -2.5, md: -3.5 },
                px: { xs: 2, sm: 2.5, md: 3.5 },
                pt: 1,
                pb: 1.5,
                mb: 2.5,
                borderBottom: hairline,
            }}
        >
            <Box
                component="div"
                sx={{
                    m: 0,
                    fontSize: { xs: font.size.lg, sm: font.size.xl },
                    fontWeight: 600,
                    color: color.ink600,
                    lineHeight: 1.9,
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'baseline',
                    columnGap: 0.75,
                }}
            >
                <span>Showing</span>
                <Choice
                    label="Period"
                    value={state.range}
                    options={RANGE_OPTIONS}
                    onChange={(range) =>
                        set({ range, ...(range === 'custom' ? {} : { from: '', to: '' }) })
                    }
                />
                {state.range === 'custom' && (
                    <Box
                        component="span"
                        sx={{ display: 'inline-flex', gap: 1, alignItems: 'center' }}
                    >
                        <TextField
                            type="date"
                            size="small"
                            value={state.from}
                            onChange={(e) => set({ from: e.target.value })}
                            inputProps={{ 'aria-label': 'From', max: state.to || undefined }}
                            sx={{ width: 150 }}
                        />
                        <span>to</span>
                        <TextField
                            type="date"
                            size="small"
                            value={state.to}
                            onChange={(e) => set({ to: e.target.value })}
                            inputProps={{ 'aria-label': 'To', min: state.from || undefined }}
                            sx={{ width: 150 }}
                        />
                    </Box>
                )}
                <span>by</span>
                <Choice
                    label="Interval"
                    value={state.interval}
                    options={INTERVAL_OPTIONS}
                    onChange={(interval) => set({ interval })}
                />
                <span>and compared with</span>
                <Choice
                    label="Comparison"
                    value={state.compare}
                    options={[
                        { value: 'previous', label: previous },
                        { value: 'none', label: 'nothing' },
                    ]}
                    onChange={(compare) => set({ compare })}
                />
                <Box
                    component="span"
                    sx={{ fontSize: font.size.xs, color: color.ink500, fontWeight: 600 }}
                >
                    Days in {TIME_ZONE}
                </Box>
            </Box>
            <Box
                component="nav"
                aria-label="Analytics pages"
                sx={{
                    display: 'flex',
                    gap: 0.5,
                    mt: 1,
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    '& a': {
                        flexShrink: 0,
                        px: 1.25,
                        py: 0.5,
                        borderRadius: `${radius.sm}px`,
                        fontSize: font.size.sm,
                        fontWeight: 600,
                        color: color.ink600,
                        textDecoration: 'none',
                        '&:hover': { bgcolor: color.surface, color: color.ink900 },
                        '&.active': { bgcolor: color.inkFill, color: color.onInk },
                    },
                }}
            >
                {ANALYTICS_PAGES.map((p) => (
                    <NavLink key={p.path} to={`${p.path}${search}`} end>
                        {p.short}
                    </NavLink>
                ))}
            </Box>
        </Box>
    );
}
