// Types for the risk API (helphive-backend /admin/risk, risk-api.md) and the labels the pages share.
import type { Tone } from '@/components/ui';
import { color } from '@/theme/tokens';

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type RuleMode = 'off' | 'observe' | 'enforce';
export type RuleAction =
    'score' | 'open_case' | 'hold_payouts' | 'review_before_payout' | 'suspend';
export type Operator = 'gte' | 'gt' | 'lte' | 'lt' | 'eq';
export type CaseStatus = 'open' | 'in_review' | 'cleared' | 'confirmed';
export type HoldKind = 'hold' | 'review_before_payout';
export type ListKind = 'email' | 'email_domain' | 'device' | 'ip' | 'ip_range' | 'phone';

export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];
export const SEVERITY_LABEL: Record<Severity, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
};
export const SEVERITY_TONE: Record<Severity, Tone> = {
    critical: 'red',
    high: 'red',
    medium: 'amber',
    low: 'grey',
};
/** Fill for score ledger segments and graph nodes: one step per severity, darkest for critical. */
export const SEVERITY_FILL: Record<Severity, string> = {
    critical: color.red700,
    high: color.red500,
    medium: color.amber500,
    low: color.ink300,
};

export const MODE_LABEL: Record<RuleMode, string> = {
    off: 'Off',
    observe: 'Observe',
    enforce: 'Enforce',
};
export const MODE_TONE: Record<RuleMode, Tone> = { off: 'grey', observe: 'blue', enforce: 'red' };
export const MODE_HELP: Record<RuleMode, string> = {
    off: 'Not evaluated.',
    observe: 'Scores and records hits; takes no action.',
    enforce: 'Scores, records hits and carries out its actions.',
};

export const ACTION_LABEL: Record<RuleAction, string> = {
    score: 'Add to score',
    open_case: 'Open a review case',
    hold_payouts: 'Hold payouts',
    review_before_payout: 'Review before next payout',
    suspend: 'Suspend the account',
};

export const OPERATOR_LABEL: Record<Operator, string> = {
    gte: 'at least',
    gt: 'more than',
    lte: 'at most',
    lt: 'less than',
    eq: 'exactly',
};

export const STATUS_LABEL: Record<CaseStatus, string> = {
    open: 'Open',
    in_review: 'In review',
    cleared: 'Cleared',
    confirmed: 'Confirmed fraud',
};
export const STATUS_TONE: Record<CaseStatus, Tone> = {
    open: 'amber',
    in_review: 'blue',
    cleared: 'green',
    confirmed: 'red',
};

export const HOLD_LABEL: Record<HoldKind, string> = {
    hold: 'Payouts held',
    review_before_payout: 'Review before next payout',
};
export const HOLD_EFFECT: Record<HoldKind, string> = {
    hold: 'Payout requests are refused and finished jobs are not released to their Stripe balance.',
    review_before_payout:
        'Payout requests are refused until the hold is released; earnings keep being released.',
};

export const LIST_KIND_LABEL: Record<ListKind, string> = {
    email: 'Email address',
    email_domain: 'Email domain',
    device: 'Device id',
    ip: 'IP address',
    ip_range: 'IP range',
    phone: 'Phone number',
};
export const LIST_KIND_HINT: Record<ListKind, string> = {
    email: 'Case, +tags and Gmail dots are ignored.',
    email_domain: 'Also matches every subdomain.',
    device: 'The app’s device id, as shown on a session.',
    ip: 'IPv4 or IPv6.',
    ip_range: 'CIDR, at most /8 (IPv4) or /32 (IPv6), e.g. 203.0.113.0/24.',
    phone: 'Compared on the last nine digits.',
};

export interface PersonSummary {
    _id: string;
    name: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string | null;
    role: 'customer' | 'provider';
    suspended: boolean;
}

export interface EvidenceValues {
    deviceId?: string[];
    ip?: string[];
    phone?: string[];
    address?: string[];
    last4?: string[];
}
export interface EvidenceRefs {
    userIds?: string[];
    bookingIds?: string[];
    paymentIds?: string[];
    payoutIds?: string[];
    eventIds?: string[];
}
export interface ConditionEvidence {
    signal: string;
    label: string;
    op: Operator;
    threshold: number;
    value: number | null;
    met: boolean;
    explanation: string;
    values?: EvidenceValues;
    refs?: EvidenceRefs;
}
export interface Contribution {
    ruleKey: string;
    title: string;
    weight: number;
    points: number;
    severity: Severity;
    mode: RuleMode;
    actions: RuleAction[];
    evidence: ConditionEvidence[];
}
export interface SignalValue {
    key: string;
    label: string;
    category: string | null;
    value: number | null;
    explanation: string;
}
export interface RiskExplanation {
    score: number;
    band: Severity;
    contributions: Contribution[];
    explanation: string;
    evaluatedAt: string;
    signals: SignalValue[];
}

export interface CaseItem {
    _id: string;
    title: string;
    status: CaseStatus;
    severity: Severity;
    severityRank: number;
    score: number;
    subject: { type: 'user' | 'booking' | 'payment' | 'payout'; id: string };
    userId: string | null;
    person?: PersonSummary | null;
    rules: string[];
    assignee: { id: string; email: string } | null;
    decision: { outcome: 'cleared' | 'confirmed'; at: string } | null;
    createdAt: string;
    updatedAt: string;
}

export interface Hold {
    _id: string;
    userId: string;
    person?: PersonSummary | null;
    kind: HoldKind;
    reason: string;
    source: {
        type: 'rule' | 'admin' | 'case';
        ruleKey: string | null;
        caseId: string | null;
        adminEmail: string | null;
    };
    active: boolean;
    createdAt: string;
    releasedAt: string | null;
    releasedBy: { email: string } | null;
    releaseReason: string | null;
    blocked: { payouts: number; earnings: number };
}

export interface UserRisk {
    user: PersonSummary & { createdAt: string | null };
    risk: RiskExplanation | null;
    stored: { score: number; band: Severity; evaluatedAt: string; exempt: string | null } | null;
    payoutHold: 'hold' | 'review' | null;
    holds: Hold[];
    cases: CaseItem[];
    recentHits: {
        ruleKey: string;
        at: string;
        mode: RuleMode;
        severity: Severity;
        actionsTaken: RuleAction[];
        actionsWouldTake: RuleAction[];
    }[];
}

export interface RuleCondition {
    signal: string;
    op: Operator;
    value: number;
    signalLabel?: string;
}
export interface Rule {
    _id: string;
    key: string;
    title: string;
    explanation: string;
    match: 'all' | 'any';
    conditions: RuleCondition[];
    weight: number;
    severity: Severity;
    actions: RuleAction[];
    mode: RuleMode;
    isDefault: boolean;
    version: number;
    hits: number;
    hits30d?: number;
    lastFiredAt: string | null;
    modeChangedAt: string | null;
    updatedAt: string | null;
    updatedBy: { email: string } | null;
}
export type RuleDraft = Pick<
    Rule,
    'title' | 'explanation' | 'match' | 'conditions' | 'weight' | 'severity' | 'actions' | 'mode'
>;

export interface SignalInfo {
    key: string;
    label: string;
    category: string;
    explanation: string;
    computedFrom: string;
    unit: string;
    windowHours: number | null;
}

export interface BacktestResult {
    rule: { key: string; title: string; mode: RuleMode; actions: RuleAction[] };
    from: string;
    to: string;
    triggers: number;
    evaluations: number;
    hits: number;
    people: number;
    byDay: { day: string; hits: number }[];
    actions: Partial<Record<RuleAction, number>>;
    subjects: {
        userId: string;
        hits: number;
        firstAt: string;
        lastAt: string;
        evidence: ConditionEvidence[];
        actions: RuleAction[];
        person: PersonSummary | null;
    }[];
    subjectLimit: number;
    truncated: boolean;
    tookMs: number;
    note: string;
}

export interface ListEntry {
    _id: string;
    list: 'block' | 'allow';
    kind: ListKind;
    kindLabel: string;
    value: string;
    reason: string;
    status: 'active' | 'expired' | 'removed';
    expiresAt: string | null;
    removedAt: string | null;
    createdAt: string;
    createdBy: { email: string } | null;
    caseId: string | null;
    matches: number;
    lastMatchedAt: string | null;
}

export interface GraphData {
    root: string;
    nodes: {
        id: string;
        depth: number;
        name: string;
        role: 'customer' | 'provider' | null;
        suspended: boolean;
        score: number | null;
        band: Severity | null;
    }[];
    edges: {
        source: string;
        target: string;
        kinds: { kind: string; label: string; count: number }[];
        strength: number;
    }[];
    truncated: boolean;
    limits: { depth: number; maxNodes: number; maxLinksPerNode: number };
}

export interface RiskOverview {
    generatedAt: string;
    days: number;
    openCases: {
        total: number;
        bySeverity: Record<
            Severity,
            {
                count: number;
                ages: { under1d: number; d1to3: number; d3to7: number; over7d: number };
                oldest: string | null;
            }
        >;
        recent: CaseItem[];
    };
    scores: { evaluated: number; histogram: { from: number; to: number; count: number }[] };
    firing: {
        days: string[];
        enforce: number[];
        observe: number[];
        topRules: {
            ruleKey: string;
            title: string;
            mode: RuleMode | null;
            hits: number;
            people: number;
            lastFiredAt: string;
        }[];
    };
    holds: {
        total: number;
        byKind: Record<HoldKind, number>;
        oldest: string | null;
        stopped: { payouts: number; payoutAmount: number; earnings: number; earningAmount: number };
    };
    blocked: { days: string[]; signup: number[]; signin: number[]; booking: number[] };
    trends: Record<
        'hits' | 'casesOpened' | 'blockedAttempts',
        { current: number; previous: number }
    > & { label: string };
    rules: { total: number; byMode: Record<RuleMode, number> };
}

export interface CaseDetail {
    case: CaseItem & {
        evidence: { ruleKey: string; title: string; at: string; conditions: ConditionEvidence[] }[];
        linked: EvidenceRefs;
        notes: { _id: string; body: string; author: { email: string | null }; createdAt: string }[];
        history: {
            at: string;
            action: string;
            by: { type: string; email?: string };
            detail?: Record<string, unknown>;
        }[];
        decision: {
            outcome: 'cleared' | 'confirmed';
            reason: string;
            by: { email: string | null };
            at: string;
        } | null;
        openedBy: { type: 'rule' | 'admin'; ruleKey?: string } | null;
    };
    person: PersonSummary | null;
    linkedPeople: PersonSummary[];
    rules: { key: string; title: string; severity: Severity; mode: RuleMode; weight: number }[];
    risk: RiskExplanation | null;
    hits: {
        _id: string;
        ruleKey: string;
        at: string;
        mode: RuleMode;
        severity: Severity;
        actionsTaken: RuleAction[];
        actionsWouldTake: RuleAction[];
        evidence: ConditionEvidence[];
    }[];
    timeline: {
        _id: string;
        type: string;
        at: string;
        actor: { type: string; id?: string };
        bookingId?: string;
        paymentId?: string;
        payoutId?: string;
        properties: Record<string, unknown>;
    }[];
    bookings: {
        _id: string;
        reference: string;
        status: string;
        service?: { name?: string };
        amount: number;
        hours: number;
        startDate: string;
        createdAt: string;
        acceptedAt: string | null;
        startedAt: string | null;
        completedAt: string | null;
        cancelledAt: string | null;
        role: 'customer' | 'provider';
        customerId: string;
        providerId: string | null;
    }[];
    payments: {
        _id: string;
        bookingId: string;
        amount: number;
        status: string;
        createdAt: string;
        refundStatus: string | null;
        refundAmount: number;
    }[];
    payouts: {
        _id: string;
        amount: number;
        status: string;
        createdAt: string;
        destination: { type: string | null; last4: string | null; country: string | null };
    }[];
    holds: Hold[];
    audit: unknown[] | null;
}

export const money = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

/** The Operations pages for each record (built in the Operations module). */
export const recordPath = {
    user: (id: string) => `/users/${id}`,
    booking: (id: string) => `/bookings/${id}`,
    payment: (id: string) => `/payments/${id}`,
    payout: (id: string) => `/payouts/${id}`,
};

export const SUBJECT_LABEL: Record<CaseItem['subject']['type'], string> = {
    user: 'Person',
    booking: 'Booking',
    payment: 'Payment',
    payout: 'Payout',
};

/** Where a case page's "next" and "previous" come from: the queue as it was when a case was opened. */
export const QUEUE_KEY = 'risk-queue';
