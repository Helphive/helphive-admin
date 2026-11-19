// Money as the API sends it: dollars (as stored), rounded to cents. Payouts carry their own
// currency; everything else is US dollars.

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string) {
    const key = currency.toUpperCase();
    let f = formatters.get(key);
    if (!f) {
        f = new Intl.NumberFormat('en-US', { style: 'currency', currency: key });
        formatters.set(key, f);
    }
    return f;
}

/** "$80.00"; an em dash for a missing amount. */
export function formatMoney(amount: number | null | undefined, currency = 'usd'): string {
    if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—';
    try {
        return formatter(currency).format(amount);
    } catch {
        return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
    }
}

/** Rounds to cents, the way the API stores money. */
export const cents = (n: number) => Math.round(n * 100) / 100;

/** The amount typed in a money field ("12.5", "$12.50"), or null when it is not a valid amount. */
export function parseMoney(text: string): number | null {
    const t = text.replace(/[$,\s]/g, '');
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
    const n = Number(t);
    return n > 0 ? n : null;
}
