import dayjs from 'dayjs';
import { inRange, type ResolvedRange } from '@/components/data';
import { SERVICE_KEYS, SERVICES, type Application } from '@/features/applications/model';

export interface OverviewStats {
    waiting: Application[];
    oldestWaitingMs: number | null;
    received: number;
    receivedPrevious: number | null;
    approved: number;
    rejected: number;
    stillWaiting: number;
    approvalRate: number | null;
    approvalRatePrevious: number | null;
    months: string[];
    monthly: { approved: number[]; rejected: number[]; pending: number[]; total: number[] };
    services: { label: string; value: number }[];
    noService: number;
    heat: { xLabels: string[]; yLabels: string[]; cells: [number, number, number][] };
}

const rate = (list: Application[]) => {
    const approved = list.filter((a) => a.status === 'approved').length;
    const decided = approved + list.filter((a) => a.status === 'rejected').length;
    return decided ? approved / decided : null;
};

const HOUR_BLOCKS = ['00-04', '04-08', '08-12', '12-16', '16-20', '20-24'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Everything on the overview comes from the two application lists. The API stores when an
 * application was submitted but not when it was decided, so periods are by submission date.
 */
export function computeOverview(
    all: Application[],
    range: ResolvedRange,
    now: number
): OverviewStats {
    const waiting = all
        .filter((a) => a.status === 'pending')
        .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    const inPeriod = all.filter((a) => inRange(a.submittedAt, range));
    const previous = range.previous
        ? all.filter((a) => inRange(a.submittedAt, range.previous!))
        : null;

    // Month buckets: the range's months, or from the first submission when the range is open.
    const first = range.start
        ? dayjs(range.start)
        : all.length
          ? dayjs(all.map((a) => a.submittedAt).sort()[0])
          : dayjs(now);
    const last = range.end ? dayjs(range.end).subtract(1, 'ms') : dayjs(now);
    const months: string[] = [];
    const keys: string[] = [];
    for (let m = first.startOf('month'); !m.isAfter(last, 'month'); m = m.add(1, 'month')) {
        months.push(m.format("MMM 'YY"));
        keys.push(m.format('YYYY-MM'));
        if (months.length > 36) break;
    }
    const monthly = {
        approved: keys.map(() => 0),
        rejected: keys.map(() => 0),
        pending: keys.map(() => 0),
        total: keys.map(() => 0),
    };
    for (const a of inPeriod) {
        const i = keys.indexOf(dayjs(a.submittedAt).format('YYYY-MM'));
        if (i < 0) continue;
        monthly[a.status][i] += 1;
        monthly.total[i] += 1;
    }

    const cells: [number, number, number][] = [];
    const grid = WEEKDAYS.map(() => HOUR_BLOCKS.map(() => 0));
    for (const a of inPeriod) {
        const d = dayjs(a.submittedAt);
        grid[(d.day() + 6) % 7][Math.floor(d.hour() / 4)] += 1;
    }
    grid.forEach((row, y) => row.forEach((v, x) => cells.push([x, y, v])));

    return {
        waiting,
        oldestWaitingMs: waiting.length ? now - new Date(waiting[0].submittedAt).getTime() : null,
        received: inPeriod.length,
        receivedPrevious: previous ? previous.length : null,
        approved: inPeriod.filter((a) => a.status === 'approved').length,
        rejected: inPeriod.filter((a) => a.status === 'rejected').length,
        stillWaiting: inPeriod.filter((a) => a.status === 'pending').length,
        approvalRate: rate(inPeriod),
        approvalRatePrevious: previous ? rate(previous) : null,
        months,
        monthly,
        services: SERVICE_KEYS.map((k) => ({
            label: SERVICES[k].label,
            value: inPeriod.filter((a) => a.services.includes(k)).length,
        })),
        noService: inPeriod.filter((a) => !a.services.length).length,
        heat: { xLabels: HOUR_BLOCKS, yLabels: WEEKDAYS, cells },
    };
}
