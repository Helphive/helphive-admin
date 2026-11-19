import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Dialog, InputBase, Typography } from '@mui/material';
import { NAV_ITEMS } from '@/app/navigation';
import { useApplicationCommands } from '@/features/applications/commands';
import { useSession } from '@/features/auth/useSession';
import { AccountIcon, LogoutIcon, SearchIcon } from '@/components/ui/icons';
import { color, font, hairline, radius } from '@/theme/tokens';
import { filterCommands, type Command } from './commands';
import { shortcutLabel } from './shortcut';

function Kbd({ children }: { children: string }) {
    return (
        <Box
            component="kbd"
            sx={{
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: 700,
                color: color.ink600,
                bgcolor: color.surface,
                border: hairline,
                borderBottomWidth: 2,
                borderRadius: '4px',
                px: 0.6,
                py: 0.1,
            }}
        >
            {children}
        </Box>
    );
}

function Palette({ onClose }: { onClose: () => void }) {
    const navigate = useNavigate();
    const { can, signOut } = useSession();
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const listId = useId();
    const listRef = useRef<HTMLUListElement>(null);
    const records = useApplicationCommands(query);

    const commands = useMemo<Command[]>(() => {
        const pages: Command[] = NAV_ITEMS.filter((i) => can(i.permission)).map((i) => {
            const Icon = i.icon;
            return {
                id: `page:${i.id}`,
                group: 'Pages',
                label: i.label,
                hint: i.description,
                icon: <Icon />,
                keywords: i.keywords,
                to: i.path,
            };
        });
        const actions: Command[] = [
            {
                id: 'action:account',
                group: 'Account',
                label: 'Your account',
                hint: 'Two-step sign-in, password and sessions',
                icon: <AccountIcon />,
                keywords: ['security', 'two-step', '2fa', 'mfa', 'password', 'sessions', 'profile'],
                to: '/account',
            },
            {
                id: 'action:sign-out',
                group: 'Account',
                label: 'Sign out',
                icon: <LogoutIcon />,
                keywords: ['log out', 'logout'],
                run: () => void signOut(),
            },
        ];
        return [...pages, ...records.views, ...records.items, ...actions];
    }, [can, signOut, records]);

    const results = useMemo(() => filterCommands(commands, query).slice(0, 30), [commands, query]);

    useEffect(() => setActive(0), [query]);
    useEffect(() => {
        listRef.current
            ?.querySelector(`[data-index="${active}"]`)
            ?.scrollIntoView({ block: 'nearest' });
    }, [active]);

    const choose = (c: Command | undefined) => {
        if (!c) return;
        onClose();
        if (c.to) navigate(c.to);
        c.run?.();
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(results.length - 1, i + 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
        } else if (e.key === 'Home') {
            setActive(0);
        } else if (e.key === 'End') {
            setActive(results.length - 1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            choose(results[active]);
        }
    };

    let lastGroup = '';
    return (
        <>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    px: 2,
                    borderBottom: hairline,
                    color: color.ink500,
                }}
            >
                <SearchIcon />
                <InputBase
                    autoFocus
                    fullWidth
                    placeholder="Search pages and applicants"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                    inputProps={{
                        role: 'combobox',
                        'aria-label': 'Search pages and applicants',
                        'aria-expanded': true,
                        'aria-controls': listId,
                        'aria-autocomplete': 'list',
                        'aria-activedescendant': results[active]
                            ? `${listId}-${active}`
                            : undefined,
                    }}
                    sx={{ height: 52, fontSize: font.size.lg, fontWeight: 500 }}
                />
                <Kbd>Esc</Kbd>
            </Box>
            <Box
                component="ul"
                id={listId}
                role="listbox"
                ref={listRef}
                aria-label="Results"
                sx={{ listStyle: 'none', m: 0, p: 0.75, maxHeight: 400, overflowY: 'auto' }}
            >
                {results.length === 0 && (
                    <Box
                        component="li"
                        role="presentation"
                        sx={{ px: 1.5, py: 4, textAlign: 'center' }}
                    >
                        <Typography variant="body2" color="text.secondary">
                            {records.loading
                                ? 'Looking up applicants'
                                : `Nothing matches "${query}". Try a name, an email or a page.`}
                        </Typography>
                    </Box>
                )}
                {results.map((c, i) => {
                    const header = c.group !== lastGroup ? c.group : null;
                    lastGroup = c.group;
                    const selected = i === active;
                    return (
                        <Box component="li" key={c.id} role="presentation">
                            {header && (
                                <Typography
                                    variant="caption"
                                    component="p"
                                    aria-hidden="true"
                                    sx={{ px: 1.25, pt: i === 0 ? 0.5 : 1.25, pb: 0.5 }}
                                >
                                    {header}
                                </Typography>
                            )}
                            <Box
                                id={`${listId}-${i}`}
                                role="option"
                                aria-selected={selected}
                                data-index={i}
                                onMouseMove={() => setActive(i)}
                                onClick={() => choose(c)}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.25,
                                    px: 1.25,
                                    minHeight: 40,
                                    borderRadius: `${radius.sm}px`,
                                    cursor: 'pointer',
                                    color: color.ink700,
                                    bgcolor: selected ? color.canvas : 'transparent',
                                    boxShadow: selected ? `inset 2px 0 0 ${color.ink900}` : 'none',
                                    '& svg': { fontSize: 18, color: color.ink500, flexShrink: 0 },
                                }}
                            >
                                {c.icon}
                                <Box
                                    component="span"
                                    sx={{
                                        fontWeight: 600,
                                        color: color.ink900,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {c.label}
                                </Box>
                                {c.hint && (
                                    <Box
                                        component="span"
                                        sx={{
                                            fontSize: font.size.sm,
                                            color: color.ink500,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            minWidth: 0,
                                        }}
                                    >
                                        {c.hint}
                                    </Box>
                                )}
                            </Box>
                        </Box>
                    );
                })}
            </Box>
            <Box
                sx={{
                    display: { xs: 'none', sm: 'flex' },
                    gap: 2,
                    px: 2,
                    py: 1,
                    borderTop: hairline,
                    bgcolor: color.subtle,
                    fontSize: font.size.xs,
                    fontWeight: 600,
                    color: color.ink500,
                    '& > span': { display: 'inline-flex', gap: 0.75, alignItems: 'center' },
                }}
            >
                <span>
                    <Kbd>↑</Kbd>
                    <Kbd>↓</Kbd> move
                </span>
                <span>
                    <Kbd>Enter</Kbd> open
                </span>
                <span>
                    <Kbd>{shortcutLabel}</Kbd> toggle
                </span>
            </Box>
        </>
    );
}

/** Ctrl/Cmd+K: jump to any page or applicant. Mounted once by the console layout. */
export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            aria-label="Command palette"
            sx={{ '& .MuiDialog-container': { alignItems: 'flex-start' } }}
            slotProps={{ paper: { sx: { mt: { xs: 2, sm: '12vh' }, overflow: 'hidden' } } }}
        >
            {open && <Palette onClose={onClose} />}
        </Dialog>
    );
}
