// Plain-language names for business events (backend lib/eventCatalogue.ts) and booking steps.
import type { Tone } from '@/components/ui';

const EVENT_META: Record<string, { label: string; tone: Tone }> = {
    'user.signed_up': { label: 'Signed up', tone: 'blue' },
    'user.email_verified': { label: 'Email verified', tone: 'green' },
    'user.profile_updated': { label: 'Profile updated', tone: 'grey' },
    'user.suspended': { label: 'Account suspended', tone: 'red' },
    'user.reinstated': { label: 'Account reinstated', tone: 'green' },
    'auth.sign_in_succeeded': { label: 'Signed in', tone: 'grey' },
    'auth.sign_in_failed': { label: 'Sign-in refused', tone: 'amber' },
    'auth.signed_out': { label: 'Signed out', tone: 'grey' },
    'auth.password_reset_requested': { label: 'Asked to reset password', tone: 'grey' },
    'auth.password_reset_completed': { label: 'Reset password', tone: 'grey' },
    'provider.application_submitted': { label: 'Applied to be a provider', tone: 'blue' },
    'provider.application_reviewed': { label: 'Application reviewed', tone: 'blue' },
    'provider.availability_changed': { label: 'Availability changed', tone: 'grey' },
    'booking.created': { label: 'Booking created', tone: 'blue' },
    'booking.paid': { label: 'Booking paid', tone: 'green' },
    'booking.accepted': { label: 'Booking accepted', tone: 'blue' },
    'booking.released': { label: 'Provider removed from booking', tone: 'amber' },
    'booking.start_requested': { label: 'Provider asked to start', tone: 'amber' },
    'booking.start_approved': { label: 'Start approved', tone: 'blue' },
    'booking.started': { label: 'Shift started', tone: 'blue' },
    'booking.completed': { label: 'Booking completed', tone: 'green' },
    'booking.cancelled': { label: 'Booking cancelled', tone: 'red' },
    'booking.expired': { label: 'Booking expired', tone: 'grey' },
    'payment.succeeded': { label: 'Payment succeeded', tone: 'green' },
    'payment.failed': { label: 'Payment failed', tone: 'red' },
    'refund.created': { label: 'Refund started', tone: 'amber' },
    'refund.succeeded': { label: 'Refund succeeded', tone: 'blue' },
    'refund.failed': { label: 'Refund failed', tone: 'red' },
    'earning.created': { label: 'Earning created', tone: 'blue' },
    'earning.released': { label: 'Earning released', tone: 'green' },
    'payout.requested': { label: 'Payout requested', tone: 'blue' },
    'payout.paid': { label: 'Payout paid', tone: 'green' },
    'payout.failed': { label: 'Payout failed', tone: 'red' },
    'security.demo_account_blocked': { label: 'Demo account action blocked', tone: 'grey' },
    'security.rate_limited': { label: 'Rate limited', tone: 'amber' },
    'email.sent': { label: 'Email sent', tone: 'grey' },
    'email.skipped': { label: 'Email not sent', tone: 'amber' },
    'signup.blocked': { label: 'Sign-up blocked', tone: 'amber' },
    'admin.action_taken': { label: 'Admin action', tone: 'grey' },
};

export function eventMeta(type: string): { label: string; tone: Tone } {
    if (EVENT_META[type]) return EVENT_META[type];
    const last = (type.split('.').pop() ?? type).replace(/_/g, ' ');
    return { label: last.charAt(0).toUpperCase() + last.slice(1), tone: 'grey' };
}

/** Steps a booking record itself stores (the timeline's `source: "booking"` entries). */
export const BOOKING_STEP: Record<string, { label: string; tone: Tone }> = {
    created: { label: 'Booked', tone: 'blue' },
    accepted: { label: 'Accepted by the provider', tone: 'blue' },
    start_requested: { label: 'Provider asked to start', tone: 'amber' },
    started: { label: 'Shift started', tone: 'blue' },
    completed: { label: 'Completed', tone: 'green' },
    cancelled: { label: 'Cancelled', tone: 'red' },
};

/** Activity worth an operator's eye in the overview feed: not routine sign-ins or blocked demos. */
export const NOISY_EVENTS = new Set([
    'auth.sign_in_succeeded',
    'auth.signed_out',
    'security.demo_account_blocked',
    'email.sent',
]);

/** "1 h 5 min", "40 s" from milliseconds, for event properties. */
export function formatSpan(ms: number): string {
    const abs = Math.abs(ms);
    if (abs < 60_000) return `${Math.round(abs / 1000)} s`;
    const minutes = Math.round(abs / 60_000);
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h < 48) return m ? `${h} h ${m} min` : `${h} h`;
    return `${Math.round(h / 24)} d`;
}
