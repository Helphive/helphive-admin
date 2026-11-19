import { MS } from '@/lib/format';
import type { Application } from './model';

/**
 * How long an application may wait before it reads as late. Console conventions, not API rules:
 * amber from 2 days, red from 5, and the wait bar is full at 7.
 */
export const WAITING = { amberDays: 2, redDays: 5, fullDays: 7 } as const;

export function waitTone(ms: number): 'grey' | 'amber' | 'red' {
    const days = ms / MS.DAY;
    return days >= WAITING.redDays ? 'red' : days >= WAITING.amberDays ? 'amber' : 'grey';
}

export function initials(a: Pick<Application, 'firstName' | 'lastName'>) {
    return `${a.firstName[0] ?? ''}${a.lastName[0] ?? ''}`.toUpperCase();
}
