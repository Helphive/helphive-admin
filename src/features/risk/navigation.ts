import type { NavItem } from '@/app/navigation';
import { HoldIcon, ListsIcon, ReviewQueueIcon, RiskIcon, RulesIcon } from '@/components/ui/icons';

/** The Risk group in the sidebar and the command palette. */
export const RISK_NAV_ITEMS: NavItem[] = [
    {
        id: 'risk-overview',
        section: 'risk',
        label: 'Risk overview',
        path: '/risk/overview',
        icon: RiskIcon,
        permission: 'risk.read',
        description: 'Open cases, rules firing, payout holds and blocked attempts',
        keywords: ['fraud', 'risk', 'score', 'dashboard'],
    },
    {
        id: 'risk-cases',
        section: 'risk',
        label: 'Review queue',
        path: '/risk/cases',
        icon: ReviewQueueIcon,
        permission: 'risk.read',
        description: 'Fraud review cases to work through',
        keywords: ['fraud', 'cases', 'review', 'investigate', 'collusion'],
    },
    {
        id: 'risk-rules',
        section: 'risk',
        label: 'Rules',
        path: '/risk/rules',
        icon: RulesIcon,
        permission: 'risk.read',
        description: 'Fraud rules, thresholds, enforcement and backtests',
        keywords: ['fraud', 'rules', 'signals', 'thresholds', 'backtest', 'enforce'],
    },
    {
        id: 'risk-lists',
        section: 'risk',
        label: 'Block and allow lists',
        path: '/risk/lists',
        icon: ListsIcon,
        permission: 'risk.read',
        description: 'Blocked and allowed emails, domains, devices, addresses and phones',
        keywords: ['block', 'ban', 'deny', 'allow', 'ip', 'device', 'email', 'domain'],
    },
    {
        id: 'risk-holds',
        section: 'risk',
        label: 'Payout holds',
        path: '/risk/holds',
        icon: HoldIcon,
        permission: 'risk.read',
        description: 'Providers whose payouts are paused',
        keywords: ['hold', 'payout', 'freeze', 'release', 'provider'],
    },
];
