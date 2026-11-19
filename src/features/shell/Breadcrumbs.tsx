import { Link as RouterLink, useLocation, useMatches } from 'react-router-dom';
import {
    Breadcrumbs as MuiBreadcrumbs,
    Link,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { navItemFor, sectionLabel } from '@/app/navigation';
import { ChevronRightIcon } from '@/components/ui/icons';
import { color } from '@/theme/tokens';
import { useCrumbOverride, type RouteHandle } from './crumbContext';

interface Crumb {
    label: string;
    path?: string;
}

/** Section, then each route's crumb. The last is the current page and is not a link. */
export default function Breadcrumbs() {
    const matches = useMatches();
    const { pathname } = useLocation();
    const override = useCrumbOverride();
    const theme = useTheme();
    const compact = useMediaQuery(theme.breakpoints.down('sm'));

    const routeCrumbs: Crumb[] = matches
        .filter((m) => (m.handle as RouteHandle | undefined)?.crumb)
        .map((m) => ({ path: m.pathname, label: (m.handle as RouteHandle).crumb as string }))
        // An index route repeats its parent's path; keep one of each.
        .filter((c, i, all) => all.findIndex((o) => o.path === c.path) === i);
    if (!routeCrumbs.length) return null;
    if (override) routeCrumbs[routeCrumbs.length - 1].label = override;

    const section = navItemFor(pathname)?.section;
    const sectionName = section ? sectionLabel(section) : '';
    const all: Crumb[] = [...(sectionName ? [{ label: sectionName }] : []), ...routeCrumbs];
    const shown = compact ? all.slice(-1) : all;

    return (
        <MuiBreadcrumbs
            aria-label="Breadcrumb"
            separator={<ChevronRightIcon size={12} weight="bold" />}
            sx={{
                minWidth: 0,
                '& ol': { flexWrap: 'nowrap' },
                '& li': { minWidth: 0 },
                '& .MuiBreadcrumbs-separator': { mx: 0.75, color: color.ink300 },
            }}
        >
            {shown.map((c, i) => {
                const last = i === shown.length - 1;
                if (last) {
                    return (
                        <Typography
                            key={c.label + i}
                            aria-current="page"
                            noWrap
                            sx={{ fontSize: 'inherit', fontWeight: 700, color: color.ink900 }}
                        >
                            {c.label}
                        </Typography>
                    );
                }
                return c.path ? (
                    <Link
                        key={c.label + i}
                        component={RouterLink}
                        to={c.path}
                        noWrap
                        sx={{ color: color.ink600 }}
                    >
                        {c.label}
                    </Link>
                ) : (
                    <Typography
                        key={c.label + i}
                        noWrap
                        sx={{ fontSize: 'inherit', fontWeight: 600, color: color.ink500 }}
                    >
                        {c.label}
                    </Typography>
                );
            })}
        </MuiBreadcrumbs>
    );
}
