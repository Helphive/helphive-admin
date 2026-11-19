import { Suspense, useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    Avatar,
    Box,
    ButtonBase,
    Divider,
    Drawer,
    IconButton,
    ListItemIcon,
    Menu,
    MenuItem,
    Tooltip,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { NAV_ITEMS, navItemFor, SECTIONS, type NavItem } from '@/app/navigation';
import { ErrorBoundary, Logo, PageSkeleton, StatusPill } from '@/components/ui';
import {
    AccountIcon,
    CloseIcon,
    LogoutIcon,
    MenuIcon,
    SearchIcon,
    SidebarIcon,
} from '@/components/ui/icons';
import { DemoBanner } from '@/features/auth/demo';
import { useSession } from '@/features/auth/useSession';
import { BUILD } from '@/lib/env';
import { color, font, hairline, layout, radius } from '@/theme/tokens';
import Breadcrumbs from './Breadcrumbs';
import CommandPalette from './CommandPalette';
import { shortcutLabel } from './shortcut';
import { CrumbProvider } from './crumbs';
import EnvironmentBadge from './EnvironmentBadge';

const COLLAPSE_KEY = 'helphive-admin.nav-collapsed';

function readCollapsed(): boolean | null {
    try {
        const v = localStorage.getItem(COLLAPSE_KEY);
        return v === null ? null : v === '1';
    } catch {
        return null;
    }
}

function SkipLink() {
    return (
        <Box
            component="a"
            href="#main"
            sx={{
                position: 'absolute',
                left: 8,
                top: -48,
                zIndex: 2000,
                px: 2,
                py: 1,
                borderRadius: `${radius.sm}px`,
                bgcolor: color.ink900,
                color: color.surface,
                fontWeight: 700,
                textDecoration: 'none',
                '&:focus': { top: 8 },
            }}
        >
            Skip to content
        </Box>
    );
}

/* ---------- Navigation ---------- */

function NavRow({
    item,
    rail,
    onNavigate,
}: {
    item: NavItem;
    rail: boolean;
    onNavigate?: () => void;
}) {
    const { pathname } = useLocation();
    // The longest matching path wins, so /analytics/revenue lights Revenue, not the analytics overview.
    const active = navItemFor(pathname)?.id === item.id;
    const Icon = item.icon;
    const Badge = item.Badge;
    const row = (
        <Box
            component={NavLink}
            to={item.path}
            end={item.path === '/' || NAV_ITEMS.some((o) => o.path.startsWith(`${item.path}/`))}
            onClick={onNavigate}
            aria-label={rail ? item.label : undefined}
            sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                height: 36,
                px: rail ? 0 : 1.25,
                justifyContent: rail ? 'center' : 'flex-start',
                borderRadius: `${radius.sm}px`,
                textDecoration: 'none',
                fontSize: font.size.md,
                fontWeight: active ? 700 : 600,
                color: active ? color.ink900 : color.ink600,
                bgcolor: active ? color.surface : 'transparent',
                boxShadow: active ? `inset 0 0 0 1px ${color.line}` : 'none',
                '&:hover': { color: color.ink900, bgcolor: active ? color.surface : color.canvas },
                '&:focus-visible': { outlineOffset: -2 },
                '& svg': { fontSize: 18 },
            }}
        >
            <Icon weight={active ? 'fill' : 'regular'} />
            {!rail && (
                <Box component="span" sx={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap' }}>
                    {item.label}
                </Box>
            )}
            {!rail && Badge && <Badge />}
            {rail && Badge && (
                <Box sx={{ position: 'absolute', top: -4, right: -2, transform: 'scale(0.85)' }}>
                    <Badge />
                </Box>
            )}
        </Box>
    );
    return rail ? (
        <Tooltip title={item.label} placement="right">
            {row}
        </Tooltip>
    ) : (
        row
    );
}

function Navigation({ rail, onNavigate }: { rail: boolean; onNavigate?: () => void }) {
    const { can } = useSession();
    const visible = NAV_ITEMS.filter((i) => can(i.permission));
    return (
        <Box component="nav" aria-label="Console" sx={{ px: 1.25, py: 1, display: 'grid', gap: 2 }}>
            {SECTIONS.map((section) => {
                const items = visible.filter((i) => i.section === section.id);
                if (!items.length) return null;
                const headingId = `nav-${section.id}`;
                return (
                    <Box
                        key={section.id}
                        role="group"
                        aria-labelledby={section.label ? headingId : undefined}
                    >
                        {section.label &&
                            (rail ? (
                                <Divider sx={{ mx: 1, mb: 1 }} aria-hidden="true" />
                            ) : (
                                <Typography
                                    id={headingId}
                                    variant="caption"
                                    component="h2"
                                    sx={{ display: 'block', px: 1.25, mb: 0.5 }}
                                >
                                    {section.label}
                                </Typography>
                            ))}
                        {rail && section.label && (
                            <Box component="span" id={headingId} sx={{ display: 'none' }}>
                                {section.label}
                            </Box>
                        )}
                        <Box sx={{ display: 'grid', gap: 0.25 }}>
                            {items.map((item) => (
                                <NavRow
                                    key={item.id}
                                    item={item}
                                    rail={rail}
                                    onNavigate={onNavigate}
                                />
                            ))}
                        </Box>
                    </Box>
                );
            })}
        </Box>
    );
}

function Sidebar({ rail, onToggle }: { rail: boolean; onToggle: () => void }) {
    return (
        <Box
            component="aside"
            sx={{
                width: rail ? layout.sidebarRailWidth : layout.sidebarWidth,
                flexShrink: 0,
                bgcolor: color.subtle,
                borderRight: hairline,
                transition: 'width .18s ease',
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
        >
            <Box
                sx={{
                    position: 'sticky',
                    top: 0,
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                <Box
                    sx={{
                        height: layout.topBarHeight,
                        display: 'flex',
                        alignItems: 'center',
                        px: rail ? 0 : 2.25,
                        justifyContent: rail ? 'center' : 'flex-start',
                        flexShrink: 0,
                    }}
                >
                    <Logo compact={rail} />
                </Box>
                <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                    <Navigation rail={rail} />
                </Box>
                <Box sx={{ p: 1.25, borderTop: hairline }}>
                    <Tooltip title={rail ? 'Expand navigation' : ''} placement="right">
                        <ButtonBase
                            onClick={onToggle}
                            aria-label={rail ? 'Expand navigation' : 'Collapse navigation'}
                            aria-expanded={!rail}
                            sx={{
                                width: '100%',
                                height: 34,
                                gap: 1.25,
                                px: rail ? 0 : 1.25,
                                justifyContent: rail ? 'center' : 'flex-start',
                                borderRadius: `${radius.sm}px`,
                                fontSize: font.size.sm,
                                fontWeight: 600,
                                color: color.ink500,
                                '&:hover': { bgcolor: color.canvas, color: color.ink900 },
                                '& svg': { fontSize: 18 },
                            }}
                        >
                            <SidebarIcon />
                            {!rail && 'Collapse'}
                        </ButtonBase>
                    </Tooltip>
                </Box>
            </Box>
        </Box>
    );
}

/* ---------- Top bar ---------- */

function AccountMenu() {
    const { admin, name, roleLabel, demo, signOut } = useSession();
    const navigate = useNavigate();
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const initials =
        `${admin?.firstName?.[0] ?? ''}${admin?.lastName?.[0] ?? ''}`.toUpperCase() || 'A';
    return (
        <>
            <IconButton
                onClick={(e) => setAnchor(e.currentTarget)}
                aria-label={`Account menu for ${name || 'admin'}`}
                aria-haspopup="menu"
                aria-expanded={Boolean(anchor)}
                sx={{ borderRadius: '50%' }}
            >
                <Avatar alt="" sx={{ width: 30, height: 30 }}>
                    {initials}
                </Avatar>
            </IconButton>
            <Menu
                anchorEl={anchor}
                open={Boolean(anchor)}
                onClose={() => setAnchor(null)}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                slotProps={{ paper: { sx: { minWidth: 260 } } }}
            >
                <Box
                    component="li"
                    role="group"
                    aria-label={name}
                    sx={{ px: 1.5, pt: 1, pb: 1.25 }}
                >
                    <Typography variant="subtitle2" noWrap>
                        {name || 'Admin'}
                    </Typography>
                    <Typography variant="caption" component="p" noWrap>
                        {admin?.email}
                    </Typography>
                    {roleLabel && (
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                            <StatusPill tone={demo ? 'amber' : 'grey'}>{roleLabel}</StatusPill>
                        </Box>
                    )}
                </Box>
                <Divider sx={{ my: 0.5 }} />
                <MenuItem
                    onClick={() => {
                        setAnchor(null);
                        navigate('/account');
                    }}
                >
                    <ListItemIcon>
                        <AccountIcon />
                    </ListItemIcon>
                    Your account
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        setAnchor(null);
                        void signOut();
                    }}
                >
                    <ListItemIcon>
                        <LogoutIcon />
                    </ListItemIcon>
                    Sign out
                </MenuItem>
                <Divider sx={{ my: 0.5 }} />
                <Box component="li" role="none" sx={{ px: 1.5, py: 0.5 }}>
                    <Typography variant="caption">Build {BUILD}</Typography>
                </Box>
            </Menu>
        </>
    );
}

function SearchButton({ onOpen, compact }: { onOpen: () => void; compact: boolean }) {
    if (compact) {
        return (
            <IconButton
                onClick={onOpen}
                aria-label="Search pages and applicants"
                aria-keyshortcuts="Control+K Meta+K"
            >
                <SearchIcon />
            </IconButton>
        );
    }
    return (
        <ButtonBase
            onClick={onOpen}
            aria-keyshortcuts="Control+K Meta+K"
            sx={{
                height: 34,
                width: 280,
                px: 1.25,
                gap: 1,
                justifyContent: 'flex-start',
                border: `1px solid ${color.lineStrong}`,
                borderRadius: `${radius.sm}px`,
                bgcolor: color.surface,
                color: color.ink500,
                fontSize: font.size.md,
                fontWeight: 500,
                '&:hover': { borderColor: color.ink300 },
                '& svg': { fontSize: 16 },
            }}
        >
            <SearchIcon />
            <Box component="span" sx={{ flex: 1, textAlign: 'left' }}>
                Search or jump to
            </Box>
            <Box
                component="kbd"
                sx={{
                    fontFamily: 'inherit',
                    fontSize: 11,
                    fontWeight: 700,
                    color: color.ink600,
                    border: hairline,
                    borderRadius: '4px',
                    px: 0.6,
                }}
            >
                {shortcutLabel}
            </Box>
        </ButtonBase>
    );
}

/* ---------- Layout ---------- */

/**
 * The console frame: sidebar (rail or full) on md and up, a drawer on smaller screens, the top
 * bar with breadcrumbs, search, environment and account, and the routed page.
 */
export default function ConsoleLayout() {
    const theme = useTheme();
    const isDrawer = useMediaQuery(theme.breakpoints.down('md'));
    const isWide = useMediaQuery(theme.breakpoints.up('lg'));
    const compactBar = useMediaQuery(theme.breakpoints.down('sm'));
    const location = useLocation();

    const [collapsedPref, setCollapsedPref] = useState<boolean | null>(readCollapsed);
    const rail = collapsedPref ?? !isWide;
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);

    const toggleRail = useCallback(() => {
        const next = !rail;
        setCollapsedPref(next);
        try {
            localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
        } catch {
            // Preference lasts for this visit only.
        }
    }, [rail]);

    useEffect(() => {
        const onKey = (e: globalThis.KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setPaletteOpen((o) => !o);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // A new page starts at the top, with focus where a screen reader expects it.
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [location.pathname]);

    return (
        <CrumbProvider>
            <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
                <SkipLink />
                {!isDrawer && <Sidebar rail={rail} onToggle={toggleRail} />}
                {isDrawer && (
                    <Drawer
                        open={drawerOpen}
                        onClose={() => setDrawerOpen(false)}
                        slotProps={{ paper: { sx: { width: 280, bgcolor: color.subtle } } }}
                    >
                        <Box
                            sx={{
                                height: layout.topBarHeight,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                px: 2,
                            }}
                        >
                            <Logo />
                            <IconButton
                                aria-label="Close navigation"
                                onClick={() => setDrawerOpen(false)}
                            >
                                <CloseIcon />
                            </IconButton>
                        </Box>
                        <Navigation rail={false} onNavigate={() => setDrawerOpen(false)} />
                    </Drawer>
                )}

                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <Box
                        component="header"
                        sx={{
                            position: 'sticky',
                            top: 0,
                            zIndex: theme.zIndex.appBar,
                            height: layout.topBarHeight,
                            display: 'flex',
                            alignItems: 'center',
                            gap: { xs: 1, sm: 1.5 },
                            px: { xs: 1, sm: 2, md: 3 },
                            bgcolor: color.surface,
                            borderBottom: hairline,
                            fontSize: font.size.md,
                        }}
                    >
                        {isDrawer && (
                            <IconButton
                                aria-label="Open navigation"
                                aria-expanded={drawerOpen}
                                onClick={() => setDrawerOpen(true)}
                            >
                                <MenuIcon />
                            </IconButton>
                        )}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Breadcrumbs />
                        </Box>
                        <SearchButton
                            onOpen={() => setPaletteOpen(true)}
                            compact={compactBar || isDrawer}
                        />
                        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                            <EnvironmentBadge />
                        </Box>
                        <AccountMenu />
                    </Box>
                    <DemoBanner />

                    <Box
                        component="main"
                        id="main"
                        tabIndex={-1}
                        sx={{
                            outline: 0,
                            flex: 1,
                            width: '100%',
                            maxWidth: layout.contentMaxWidth,
                            mx: 'auto',
                            px: {
                                xs: `${layout.gutter.xs}px`,
                                sm: `${layout.gutter.sm}px`,
                                md: `${layout.gutter.md}px`,
                            },
                            py: { xs: 2, md: 3 },
                        }}
                    >
                        <Box sx={{ display: { xs: 'flex', sm: 'none' }, mb: 1.5 }}>
                            <EnvironmentBadge />
                        </Box>
                        <ErrorBoundary resetKey={location.pathname}>
                            <Suspense fallback={<PageSkeleton />}>
                                <Outlet />
                            </Suspense>
                        </ErrorBoundary>
                    </Box>
                </Box>
                <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
            </Box>
        </CrumbProvider>
    );
}
