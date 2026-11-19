import { STRIPE_MODE } from '@/lib/env';
import { isMasked } from '@/lib/safeUrl';

export type StripeKind = 'payment' | 'refund' | 'account' | 'transfer' | 'payout' | 'event';

/** The Stripe dashboard page of an object, or null for a masked or unknown id. */
export function stripeUrl(
    kind: StripeKind,
    id: string | null | undefined,
    account?: string | null
) {
    if (!id || isMasked(id) || !/^[a-z]+_[A-Za-z0-9]+$/.test(id)) return null;
    const base = `https://dashboard.stripe.com${STRIPE_MODE === 'test' ? '/test' : ''}`;
    switch (kind) {
        case 'payment':
            return `${base}/payments/${id}`;
        case 'refund':
            return `${base}/refunds/${id}`;
        case 'account':
            return `${base}/connect/accounts/${id}`;
        case 'transfer':
            return `${base}/connect/transfers/${id}`;
        case 'payout':
            return account && /^acct_[A-Za-z0-9]+$/.test(account)
                ? `${base}/connect/accounts/${account}/payouts/${id}`
                : null;
        case 'event':
            return `${base}/events/${id}`;
    }
}
